import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';
import type { WebhookEvent } from '../../application/services/webhook-delivery.service.js';

export interface WebhookJobData extends WebhookEvent {
  attemptCount: number;
}

export class WebhookQueue {
  private queue: Queue<WebhookJobData>;
  private worker: Worker<WebhookJobData> | null = null;
  private connection: Redis;

  constructor(redisConnection: Redis) {
    this.connection = redisConnection;

    this.queue = new Queue<WebhookJobData>('webhook', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 5,
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

  async addWebhookJob(data: WebhookJobData): Promise<void> {
    try {
      await this.queue.add('deliver-webhook', data, {
        priority: 5, // Default priority
      });

      logger.info('Webhook job added to queue', {
        webhookId: data.webhookId,
        eventType: data.type,
        url: data.webhookUrl,
      });
    } catch (error) {
      logger.error('Failed to add webhook job to queue', {
        error,
        webhookId: data.webhookId,
        eventType: data.type,
      });
      throw error;
    }
  }

  startWorker(processor: (job: Job<WebhookJobData>) => Promise<void>): void {
    if (this.worker) {
      logger.warn('Webhook worker already started');
      return;
    }

    this.worker = new Worker<WebhookJobData>(
      'webhook',
      async (job: Job<WebhookJobData>) => {
        try {
          logger.info('Processing webhook job', {
            jobId: job.id,
            webhookId: job.data.webhookId,
            eventType: job.data.type,
            url: job.data.webhookUrl,
            attempt: job.attemptsMade + 1,
          });

          await processor(job);

          logger.info('Webhook job completed', {
            jobId: job.id,
            webhookId: job.data.webhookId,
          });
        } catch (error) {
          logger.error('Webhook job failed', {
            jobId: job.id,
            webhookId: job.data.webhookId,
            error,
            attempt: job.attemptsMade + 1,
          });
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency: 10, // Process up to 10 webhooks concurrently
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Webhook worker completed job', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Webhook worker failed job', {
        jobId: job?.id,
        error,
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
