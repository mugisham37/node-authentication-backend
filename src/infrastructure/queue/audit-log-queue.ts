/**
 * Audit Log Queue
 * Manages async audit log creation jobs
 * Requirements: 13.1
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';
import { AUDIT_LOG_JOB_TYPES, AuditLogJobData } from './jobs/audit-log-jobs.js';
import { AuditLogProcessor } from './processors/audit-log-processor.js';
import type { IAuditLogRepository } from '../domain/repositories/audit-log.repository.js';

export class AuditLogQueue {
  private queue: Queue<AuditLogJobData>;
  private worker: Worker<AuditLogJobData> | null = null;
  private connection: Redis;
  private processor: AuditLogProcessor | null = null;

  constructor(redisConnection: Redis, auditLogRepository?: IAuditLogRepository) {
    this.connection = redisConnection;
    if (auditLogRepository) {
      this.processor = new AuditLogProcessor(auditLogRepository);
    }

    this.queue = new Queue<AuditLogJobData>('audit-logs', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // Keep completed jobs for 7 days
          count: 10000,
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // Keep failed jobs for 30 days
        },
      },
    });
  }

  /**
   * Add audit log creation job
   * Requirement: 13.1
   */
  async addAuditLog(data: AuditLogJobData): Promise<void> {
    try {
      await this.queue.add(AUDIT_LOG_JOB_TYPES.CREATE, data, {
        priority: this.getPriority(data),
      });

      logger.debug('Audit log job added to queue', {
        action: data.action,
        userId: data.userId,
        status: data.status,
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break main flow
      logger.error('Failed to add audit log job to queue', {
        error,
        action: data.action,
        userId: data.userId,
      });
    }
  }

  /**
   * Start the audit log worker
   * Processes audit log jobs from the queue
   */
  startWorker(): void {
    if (this.worker) {
      logger.warn('Audit log worker already started');
      return;
    }

    if (!this.processor) {
      throw new Error(
        'Audit log processor not initialized. Provide auditLogRepository in constructor.'
      );
    }

    const processor = this.processor;
    this.worker = new Worker<AuditLogJobData>(
      'audit-logs',
      async (job: Job<AuditLogJobData>) => {
        await processor.process(job);
      },
      {
        connection: this.connection,
        concurrency: 10, // Process up to 10 audit logs concurrently
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Audit log worker completed job', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Audit log worker failed job', {
        jobId: job?.id,
        error,
      });
    });

    logger.info('Audit log worker started');
  }

  /**
   * Stop the audit log worker
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info('Audit log queue closed');
  }

  /**
   * Get priority based on action and status
   * Higher priority for failures and security-critical actions
   */
  private getPriority(data: AuditLogJobData): number {
    // Highest priority for failures
    if (data.status === 'failure') {
      return 1;
    }

    // High priority for security-critical actions
    const criticalActions = [
      'login',
      'logout',
      'password_change',
      'mfa_enable',
      'mfa_disable',
      'role_assign',
      'permission_grant',
    ];

    if (criticalActions.some((action) => data.action.toLowerCase().includes(action))) {
      return 2;
    }

    // Default priority
    return 5;
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
}
