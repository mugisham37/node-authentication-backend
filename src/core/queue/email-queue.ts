import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';
import type { SendEmailInput } from '../../application/services/email.service.js';

export interface EmailJobData extends SendEmailInput {
  retryCount?: number;
}

export class EmailQueue {
  private queue: Queue<EmailJobData>;
  private worker: Worker<EmailJobData> | null = null;
  private connection: Redis;

  constructor(redisConnection: Redis) {
    this.connection = redisConnection;

    this.queue = new Queue<EmailJobData>('email', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
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

  async addEmailJob(data: EmailJobData): Promise<void> {
    try {
      await this.queue.add('send-email', data, {
        priority: this.getPriority(data),
      });

      logger.info('Email job added to queue', {
        to: data.to,
        subject: data.subject,
      });
    } catch (error) {
      logger.error('Failed to add email job to queue', {
        error,
        to: data.to,
        subject: data.subject,
      });
      throw error;
    }
  }

  startWorker(processor: (job: Job<EmailJobData>) => Promise<void>): void {
    if (this.worker) {
      logger.warn('Email worker already started');
      return;
    }

    this.worker = new Worker<EmailJobData>(
      'email',
      async (job: Job<EmailJobData>) => {
        try {
          logger.info('Processing email job', {
            jobId: job.id,
            to: job.data.to,
            subject: job.data.subject,
            attempt: job.attemptsMade + 1,
          });

          await processor(job);

          logger.info('Email job completed', {
            jobId: job.id,
            to: job.data.to,
          });
        } catch (error) {
          logger.error('Email job failed', {
            jobId: job.id,
            to: job.data.to,
            error,
            attempt: job.attemptsMade + 1,
          });
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency: 5, // Process up to 5 emails concurrently
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Email worker completed job', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Email worker failed job', {
        jobId: job?.id,
        error,
      });
    });

    logger.info('Email worker started');
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info('Email queue closed');
  }

  private getPriority(data: EmailJobData): number {
    // Higher priority for security alerts and verification emails
    if (data.subject.toLowerCase().includes('security')) {
      return 1; // Highest priority
    }
    if (data.subject.toLowerCase().includes('verify')) {
      return 2;
    }
    if (data.subject.toLowerCase().includes('reset')) {
      return 3;
    }
    return 5; // Default priority
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
