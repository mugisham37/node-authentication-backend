/**
 * Cleanup Job Processor
 * Processes cleanup jobs for expired sessions, tokens, and devices
 * Requirements: 7.5, 15.6
 */

import { Job } from 'bullmq';
import { logger } from '../../logging/logger.js';
import {
  SessionCleanupJobData,
  TokenCleanupJobData,
  DeviceCleanupJobData,
  CLEANUP_JOB_TYPES,
} from '../jobs/cleanup-jobs.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { IDeviceRepository } from '../../../domain/repositories/device.repository.js';
import { getRedis } from '../../cache/redis.js';

export interface CleanupResult {
  deletedCount: number;
  processedAt: Date;
}

export class CleanupProcessor {
  constructor(
    private readonly sessionRepository?: ISessionRepository,
    private readonly deviceRepository?: IDeviceRepository
  ) {}

  /**
   * Process cleanup jobs based on job type
   */
  async process(job: Job): Promise<CleanupResult> {
    const { name } = job;

    logger.info('Processing cleanup job', {
      jobId: job.id,
      jobType: name,
    });

    try {
      let result: CleanupResult;

      switch (name) {
        case CLEANUP_JOB_TYPES.SESSION:
          result = await this.processSessionCleanup(job.data as SessionCleanupJobData);
          break;

        case CLEANUP_JOB_TYPES.TOKEN:
          result = await this.processTokenCleanup(job.data as TokenCleanupJobData);
          break;

        case CLEANUP_JOB_TYPES.DEVICE:
          result = await this.processDeviceCleanup(job.data as DeviceCleanupJobData);
          break;

        default:
          logger.warn('Unknown cleanup job type', { jobType: name });
          throw new Error(`Unknown cleanup job type: ${name}`);
      }

      logger.info('Cleanup job completed successfully', {
        jobId: job.id,
        jobType: name,
        deletedCount: result.deletedCount,
      });

      return result;
    } catch (error) {
      logger.error('Cleanup job processing failed', {
        jobId: job.id,
        jobType: name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process expired session cleanup
   * Requirement: 7.5
   */
  private async processSessionCleanup(data: SessionCleanupJobData): Promise<CleanupResult> {
    if (!this.sessionRepository) {
      throw new Error('Session repository not provided');
    }

    const batchSize = data.batchSize || 1000;

    logger.info('Starting expired session cleanup', { batchSize });

    try {
      // Delete expired sessions
      const deletedCount = await this.sessionRepository.deleteExpired(batchSize);

      logger.info('Expired sessions cleaned up', {
        deletedCount,
      });

      return {
        deletedCount,
        processedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to clean up expired sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process expired token cleanup
   * Cleans up revoked tokens from Redis
   * Requirement: 6.3
   */
  private async processTokenCleanup(data: TokenCleanupJobData): Promise<CleanupResult> {
    const batchSize = data.batchSize || 1000;

    logger.info('Starting expired token cleanup', { batchSize });

    try {
      const redis = getRedis();

      // Get all revoked token keys
      const pattern = 'revoked:*';
      const keys = await redis.keys(pattern);

      let deletedCount = 0;
      const now = Date.now();

      // Check each key and delete if expired
      for (const key of keys) {
        const ttl = await redis.ttl(key);

        // If TTL is -1 (no expiration) or -2 (key doesn't exist), skip
        if (ttl === -1 || ttl === -2) {
          continue;
        }

        // If TTL is 0 or negative, delete the key
        if (ttl <= 0) {
          await redis.del(key);
          deletedCount++;
        }

        // Process in batches to avoid blocking
        if (deletedCount >= batchSize) {
          break;
        }
      }

      logger.info('Expired tokens cleaned up', {
        deletedCount,
      });

      return {
        deletedCount,
        processedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to clean up expired tokens', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process unused device cleanup
   * Requirement: 15.6
   */
  private async processDeviceCleanup(data: DeviceCleanupJobData): Promise<CleanupResult> {
    if (!this.deviceRepository) {
      throw new Error('Device repository not provided');
    }

    const batchSize = data.batchSize || 1000;
    const inactiveDays = data.inactiveDays || 90;

    logger.info('Starting unused device cleanup', {
      batchSize,
      inactiveDays,
    });

    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

      // Delete devices not seen since cutoff date
      const deletedCount = await this.deviceRepository.deleteInactive(cutoffDate, batchSize);

      logger.info('Unused devices cleaned up', {
        deletedCount,
        cutoffDate,
      });

      return {
        deletedCount,
        processedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to clean up unused devices', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
