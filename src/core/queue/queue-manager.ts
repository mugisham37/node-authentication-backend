/**
 * Queue Manager
 * Central manager for all BullMQ queues
 * Coordinates queue initialization, worker startup, and shutdown
 */

import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';
import { EmailQueue } from './email-queue.js';
import { WebhookQueue } from './webhook-queue.js';
import { AuditLogQueue } from './audit-log-queue.js';
import { CleanupQueue } from './cleanup-queue.js';
import type { IEmailService } from '../../application/services/email.service.js';
import type { IAuditLogRepository } from '../../domain/repositories/audit-log.repository.js';
import type { ISessionRepository } from '../../domain/repositories/session.repository.js';
import type { IDeviceRepository } from '../../domain/repositories/device.repository.js';

export interface QueueManagerConfig {
  redisConnection: Redis;
  emailService?: IEmailService;
  auditLogRepository?: IAuditLogRepository;
  sessionRepository?: ISessionRepository;
  deviceRepository?: IDeviceRepository;
}

export class QueueManager {
  private emailQueue: EmailQueue;
  private webhookQueue: WebhookQueue;
  private auditLogQueue: AuditLogQueue;
  private cleanupQueue: CleanupQueue;
  private isInitialized = false;

  constructor(private readonly config: QueueManagerConfig) {
    // Initialize queues
    this.emailQueue = new EmailQueue(config.redisConnection, config.emailService);
    this.webhookQueue = new WebhookQueue(config.redisConnection);
    this.auditLogQueue = new AuditLogQueue(config.redisConnection, config.auditLogRepository);
    this.cleanupQueue = new CleanupQueue(
      config.redisConnection,
      config.sessionRepository,
      config.deviceRepository
    );
  }

  /**
   * Initialize all queues and start workers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      logger.info('Initializing queue manager...');

      // Start workers
      if (this.config.emailService) {
        this.emailQueue.startWorker();
      }

      this.webhookQueue.startWorker();

      if (this.config.auditLogRepository) {
        this.auditLogQueue.startWorker();
      }

      if (this.config.sessionRepository || this.config.deviceRepository) {
        this.cleanupQueue.startWorker();
        await this.cleanupQueue.scheduleCleanupJobs();
      }

      this.isInitialized = true;
      logger.info('Queue manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue manager', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Queue manager not initialized');
      return;
    }

    try {
      logger.info('Shutting down queue manager...');

      await Promise.all([
        this.emailQueue.close(),
        this.webhookQueue.close(),
        this.auditLogQueue.close(),
        this.cleanupQueue.close(),
      ]);

      this.isInitialized = false;
      logger.info('Queue manager shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown queue manager', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get email queue instance
   */
  getEmailQueue(): EmailQueue {
    return this.emailQueue;
  }

  /**
   * Get webhook queue instance
   */
  getWebhookQueue(): WebhookQueue {
    return this.webhookQueue;
  }

  /**
   * Get audit log queue instance
   */
  getAuditLogQueue(): AuditLogQueue {
    return this.auditLogQueue;
  }

  /**
   * Get cleanup queue instance
   */
  getCleanupQueue(): CleanupQueue {
    return this.cleanupQueue;
  }

  /**
   * Get metrics for all queues
   */
  async getAllQueueMetrics(): Promise<{
    email: Awaited<ReturnType<EmailQueue['getQueueMetrics']>>;
    webhook: Awaited<ReturnType<WebhookQueue['getQueueMetrics']>>;
    auditLog: Awaited<ReturnType<AuditLogQueue['getQueueMetrics']>>;
    cleanup: Awaited<ReturnType<CleanupQueue['getQueueMetrics']>>;
  }> {
    const [email, webhook, auditLog, cleanup] = await Promise.all([
      this.emailQueue.getQueueMetrics(),
      this.webhookQueue.getQueueMetrics(),
      this.auditLogQueue.getQueueMetrics(),
      this.cleanupQueue.getQueueMetrics(),
    ]);

    return {
      email,
      webhook,
      auditLog,
      cleanup,
    };
  }

  /**
   * Check if queue manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
