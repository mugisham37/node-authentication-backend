/**
 * Cleanup Queue
 * Manages scheduled cleanup jobs for expired sessions, tokens, and devices
 * Requirements: 7.5, 15.6
 */

import { Queue, Worker, Job } from 'bullmq';
import type { RepeatableJob } from 'bullmq';
import { Redis } from 'ioredis';
import { log as logger } from '../logging/logger.js';
import {
  CLEANUP_JOB_TYPES,
  SessionCleanupJobData,
  TokenCleanupJobData,
  DeviceCleanupJobData,
} from './jobs/cleanup-jobs.js';
import { CleanupProcessor } from './processors/cleanup-processor.js';
import type { ISessionRepository } from '../../domain/repositories/session.repository.js';
import type { IDeviceRepository } from '../../domain/repositories/device.repository.js';

export class CleanupQueue {
  private queue: Queue;
  private worker: Worker | null = null;
  private connection: Redis;
  private processor: CleanupProcessor;

  constructor(
    redisConnection: Redis,
    sessionRepository?: ISessionRepository,
    deviceRepository?: IDeviceRepository
  ) {
    this.connection = redisConnection;
    this.processor = new CleanupProcessor(sessionRepository, deviceRepository);

    this.queue = new Queue('cleanup', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // Keep completed jobs for 7 days
          count: 100,
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // Keep failed jobs for 30 days
        },
      },
    });
  }

  /**
   * Schedule cleanup jobs with cron patterns
   * Requirement: 7.5, 15.6
   */
  async scheduleCleanupJobs(): Promise<void> {
    try {
      // Schedule expired session cleanup - every hour
      await this.queue.add(
        CLEANUP_JOB_TYPES.SESSION,
        { batchSize: 1000 } as SessionCleanupJobData,
        {
          repeat: {
            pattern: '0 * * * *', // Every hour at minute 0
          },
          jobId: 'session-cleanup-hourly',
        }
      );

      logger.info('Scheduled session cleanup job', {
        pattern: '0 * * * *',
      });

      // Schedule expired token cleanup - every 6 hours
      await this.queue.add(CLEANUP_JOB_TYPES.TOKEN, { batchSize: 1000 } as TokenCleanupJobData, {
        repeat: {
          pattern: '0 */6 * * *', // Every 6 hours
        },
        jobId: 'token-cleanup-6hourly',
      });

      logger.info('Scheduled token cleanup job', {
        pattern: '0 */6 * * *',
      });

      // Schedule unused device cleanup - daily at 2 AM
      await this.queue.add(
        CLEANUP_JOB_TYPES.DEVICE,
        { batchSize: 1000, inactiveDays: 90 } as DeviceCleanupJobData,
        {
          repeat: {
            pattern: '0 2 * * *', // Daily at 2 AM
          },
          jobId: 'device-cleanup-daily',
        }
      );

      logger.info('Scheduled device cleanup job', {
        pattern: '0 2 * * *',
      });

      logger.info('All cleanup jobs scheduled successfully');
    } catch (error) {
      logger.error('Failed to schedule cleanup jobs', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Manually trigger session cleanup
   * Requirement: 7.5
   */
  async triggerSessionCleanup(batchSize: number = 1000): Promise<void> {
    await this.queue.add(CLEANUP_JOB_TYPES.SESSION, { batchSize } as SessionCleanupJobData);
    logger.info('Manual session cleanup triggered', { batchSize });
  }

  /**
   * Manually trigger token cleanup
   */
  async triggerTokenCleanup(batchSize: number = 1000): Promise<void> {
    await this.queue.add(CLEANUP_JOB_TYPES.TOKEN, { batchSize } as TokenCleanupJobData);
    logger.info('Manual token cleanup triggered', { batchSize });
  }

  /**
   * Manually trigger device cleanup
   * Requirement: 15.6
   */
  async triggerDeviceCleanup(inactiveDays: number = 90, batchSize: number = 1000): Promise<void> {
    await this.queue.add(CLEANUP_JOB_TYPES.DEVICE, {
      batchSize,
      inactiveDays,
    } as DeviceCleanupJobData);
    logger.info('Manual device cleanup triggered', { inactiveDays, batchSize });
  }

  /**
   * Start the cleanup worker
   * Processes cleanup jobs from the queue
   */
  startWorker(): void {
    if (this.worker) {
      logger.warn('Cleanup worker already started');
      return;
    }

    this.worker = new Worker(
      'cleanup',
      async (job: Job) => {
        await this.processor.process(job);
      },
      {
        connection: this.connection,
        concurrency: 1, // Process cleanup jobs one at a time to avoid resource contention
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Cleanup worker completed job', {
        jobId: job.id,
        jobType: job.name,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Cleanup worker failed job', {
        jobId: job?.id,
        jobType: job?.name,
        error,
      });
    });

    logger.info('Cleanup worker started');
  }

  /**
   * Stop the cleanup worker
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info('Cleanup queue closed');
  }

  /**
   * Get queue metrics
   */
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

  /**
   * Get scheduled jobs
   */
  async getScheduledJobs(): Promise<RepeatableJob[]> {
    return await this.queue.getRepeatableJobs();
  }

  /**
   * Remove a scheduled job
   */
  async removeScheduledJob(jobId: string): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.id === jobId);

    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
      logger.info('Scheduled job removed', { jobId });
    } else {
      logger.warn('Scheduled job not found', { jobId });
    }
  }
}
