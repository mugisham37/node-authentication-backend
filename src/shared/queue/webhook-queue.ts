import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../../shared/logging/logger.js';
import { WEBHOOK_JOB_TYPES, WebhookJobData } from './jobs/webhook-jobs.js';
import { WebhookProcessor } from './processors/webhook-processor.js';

export class WebhookQueue {
  private queue: Queue<WebhookJobData>;
  private worker: Worker<WebhookJobData> | null = null;
  private connection: Redis;
  private processor: WebhookProcessor;

  constructor(redisConnection: Redis) {
    this.connection = redisConnection;
    this.processor = new WebhookProcessor();

    this.queue = new Queue<WebhookJobData>('webhook', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 5, // Requirement: 16.3 - retry up to 5 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }

  /**
   * Add webhook delivery job
   * Requirement: 16.2
   */

  async addWebhookJob(data: WebhookJobData): Promise<void> {
    try {
      await this.queue.add(WEBHOOK_JOB_TYPES.DELIVER, data, {
        priority: 5, // Default priority
        backoff: {
          type: 'custom',
        },
      });

      logger.info('Webhook job added to queue', {
        webhookId: data.webhookId,
        eventType: data.eventType,
        url: data.webhookUrl,
      });
    } catch (error) {
      logger.error('Failed to add webhook job to queue', {
        error,
        webhookId: data.webhookId,
        eventType: data.eventType,
      });
      throw error;
    }
  }

  /**
   * Start the webhook worker
   * Processes webhook delivery jobs from the queue
   * Requirement: 16.2, 16.3
   */
  startWorker(): void {
    if (this.worker) {
      logger.warn('Webhook worker already started');
      return;
    }

    this.worker = new Worker<WebhookJobData>(
      'webhook',
      async (job: Job<WebhookJobData>) => {
        await this.processor.process(job);
      },
      {
        connection: this.connection,
        concurrency: 10, // Process up to 10 webhooks concurrently
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            // Custom exponential backoff (Requirement: 16.3)
            return WebhookProcessor.calculateRetryDelay(attemptsMade);
          },
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Webhook worker completed job', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Webhook worker failed job', {
        jobId: job?.id,
        error,
        attempts: job?.attemptsMade,
      });
    });

    logger.info('Webhook worker started');
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info('Webhook queue closed');
  }

  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
