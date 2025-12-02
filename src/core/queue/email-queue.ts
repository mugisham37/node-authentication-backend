import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';
import {
  EMAIL_JOB_TYPES,
  EmailJobType,
  EmailVerificationJobData,
  PasswordResetJobData,
  SecurityAlertJobData,
  WelcomeEmailJobData,
} from './jobs/email-jobs.js';
import { EmailProcessor } from './processors/email-processor.js';
import type { IEmailService } from '../../application/services/email.service.js';

export type EmailJobData =
  | EmailVerificationJobData
  | PasswordResetJobData
  | SecurityAlertJobData
  | WelcomeEmailJobData;

export class EmailQueue {
  private queue: Queue<EmailJobData>;
  private worker: Worker<EmailJobData> | null = null;
  private connection: Redis;
  private processor: EmailProcessor | null = null;

  constructor(redisConnection: Redis, emailService?: IEmailService) {
    this.connection = redisConnection;
    if (emailService) {
      this.processor = new EmailProcessor(emailService);
    }

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

  /**
   * Add email verification job
   * Requirement: 1.6, 2.1
   */
  async addVerificationEmail(data: EmailVerificationJobData): Promise<void> {
    await this.addJob(EMAIL_JOB_TYPES.VERIFICATION, data, 2);
  }

  /**
   * Add password reset email job
   * Requirement: 10.1
   */
  async addPasswordResetEmail(data: PasswordResetJobData): Promise<void> {
    await this.addJob(EMAIL_JOB_TYPES.PASSWORD_RESET, data, 3);
  }

  /**
   * Add security alert email job
   * Requirement: 13.4
   */
  async addSecurityAlertEmail(data: SecurityAlertJobData): Promise<void> {
    await this.addJob(EMAIL_JOB_TYPES.SECURITY_ALERT, data, 1); // Highest priority
  }

  /**
   * Add welcome email job
   * Requirement: 1.6
   */
  async addWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    await this.addJob(EMAIL_JOB_TYPES.WELCOME, data, 5); // Lowest priority
  }

  /**
   * Internal method to add job to queue
   */
  private async addJob(jobType: EmailJobType, data: EmailJobData, priority: number): Promise<void> {
    try {
      await this.queue.add(jobType, data, {
        priority,
      });

      logger.info('Email job added to queue', {
        jobType,
        to: data.to,
      });
    } catch (error) {
      logger.error('Failed to add email job to queue', {
        error,
        jobType,
        to: data.to,
      });
      throw error;
    }
  }

  /**
   * Start the email worker
   * Processes email jobs from the queue
   */
  startWorker(): void {
    if (this.worker) {
      logger.warn('Email worker already started');
      return;
    }

    if (!this.processor) {
      throw new Error('Email processor not initialized. Provide emailService in constructor.');
    }

    this.worker = new Worker<EmailJobData>(
      'email',
      async (job: Job<EmailJobData>) => {
        await this.processor!.process(job);
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
