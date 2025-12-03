import { randomUUID } from 'crypto';
import { Queue, Worker, Job } from 'bullmq';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import {
  IAuditLogRepository,
  AuditLogFilters,
} from '../../domain/repositories/audit-log.repository.js';
import { log } from '../../core/logging/logger.js';
import { getRedisConnection } from '../../core/cache/redis.js';

/**
 * Input for creating an audit log
 * Requirement: 13.1, 13.2
 */
export interface CreateAuditLogInput {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  status: 'success' | 'failure' | 'pending';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Security alert for high-risk events
 * Requirement: 13.4
 */
export interface SecurityAlert {
  auditLogId: string;
  userId: string | null;
  action: string;
  riskScore: number;
  riskLevel: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Audit log query result
 * Requirement: 13.5
 */
export interface AuditLogQueryResult {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Audit Log Service Interface
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */
export interface IAuditLogService {
  /**
   * Create an audit log entry asynchronously
   * Requirement: 13.1
   */
  createAuditLog(input: CreateAuditLogInput): Promise<void>;

  /**
   * Query audit logs with filtering
   * Requirement: 13.5
   */
  queryAuditLogs(filters: AuditLogFilters): Promise<AuditLogQueryResult>;

  /**
   * Get audit log by ID
   */
  getAuditLogById(id: string): Promise<AuditLog | null>;

  /**
   * Get recent audit logs for a user
   */
  getRecentUserAuditLogs(userId: string, limit: number): Promise<AuditLog[]>;

  /**
   * Start the audit log worker
   * Processes queued audit log creation jobs
   */
  startWorker(): void;

  /**
   * Stop the audit log worker
   */
  stopWorker(): Promise<void>;
}

/**
 * Audit Log Service Implementation
 * Handles async audit log creation, risk scoring, and security alerts
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */
export class AuditLogService implements IAuditLogService {
  private queue: Queue;
  private worker: Worker | null = null;
  private readonly QUEUE_NAME = 'audit-logs';

  constructor(private readonly auditLogRepository: IAuditLogRepository) {
    // Initialize BullMQ queue
    const connection = getRedisConnection();
    this.queue = new Queue(this.QUEUE_NAME, { connection });
  }

  /**
   * Create an audit log entry asynchronously
   * Adds job to queue for processing by worker
   * Requirement: 13.1
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<void> {
    try {
      // Add job to queue for async processing
      await this.queue.add('create-audit-log', input, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      log.debug('Audit log job queued', {
        action: input.action,
        userId: input.userId,
        status: input.status,
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break main flow
      log.error('Failed to queue audit log', error as Error, {
        action: input.action,
        userId: input.userId,
      });
    }
  }

  /**
   * Query audit logs with filtering
   * Requirement: 13.5
   */
  async queryAuditLogs(filters: AuditLogFilters): Promise<AuditLogQueryResult> {
    try {
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      // Query logs and count total
      const [logs, total] = await Promise.all([
        this.auditLogRepository.query(filters),
        this.auditLogRepository.count(filters),
      ]);

      log.debug('Audit logs queried', {
        filters,
        resultCount: logs.length,
        total,
      });

      return {
        logs,
        total,
        page,
        pageSize: limit,
      };
    } catch (error) {
      log.error('Failed to query audit logs', error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    try {
      return await this.auditLogRepository.findById(id);
    } catch (error) {
      log.error('Failed to get audit log by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Get recent audit logs for a user
   */
  async getRecentUserAuditLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.findRecentByUserId(userId, limit);
    } catch (error) {
      log.error('Failed to get recent user audit logs', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Start the audit log worker
   * Processes queued audit log creation jobs
   */
  startWorker(): void {
    if (this.worker) {
      log.warn('Audit log worker already running');
      return;
    }

    const connection = getRedisConnection();

    this.worker = new Worker<CreateAuditLogInput>(
      this.QUEUE_NAME,
      async (job: Job<CreateAuditLogInput>) => {
        await this.processAuditLogJob(job);
      },
      {
        connection,
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      log.debug('Audit log job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      log.error('Audit log job failed', error, {
        jobId: job?.id,
        attempts: job?.attemptsMade,
      });
    });

    log.info('Audit log worker started');
  }

  /**
   * Stop the audit log worker
   */
  async stopWorker(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = null;

    log.info('Audit log worker stopped');
  }

  /**
   * Process an audit log creation job
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6
   */
  private async processAuditLogJob(job: Job<CreateAuditLogInput>): Promise<void> {
    const input = job.data;

    try {
      // Parse IP address if provided
      let ipAddress: IPAddress | null = null;
      if (input.ipAddress) {
        try {
          ipAddress = new IPAddress(input.ipAddress);
        } catch (error) {
          log.warn('Invalid IP address in audit log', {
            ipAddress: input.ipAddress,
            error: (error as Error).message,
          });
        }
      }

      // Calculate risk score (Requirement: 13.3)
      const riskScore = AuditLog.calculateRiskScore(input.action, input.status, input.metadata);

      // Create audit log entity
      const auditLog = new AuditLog({
        id: randomUUID(),
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        status: input.status,
        ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata || {},
        riskScore,
        createdAt: new Date(),
      });

      // Save to database (Requirement: 13.1, 13.6)
      await this.auditLogRepository.create(auditLog);

      log.info('Audit log created', {
        id: auditLog.id,
        action: auditLog.action,
        userId: auditLog.userId,
        status: auditLog.status,
        riskScore: auditLog.riskScore,
        riskLevel: auditLog.getRiskLevel(),
      });

      // Generate security alert for high-risk events (Requirement: 13.4)
      if (auditLog.isHighRisk()) {
        this.generateSecurityAlert(auditLog);
      }
    } catch (error) {
      log.error('Failed to process audit log job', error as Error, {
        jobId: job.id,
        action: input.action,
        userId: input.userId,
      });
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Generate security alert for high-risk events
   * Requirement: 13.4
   */
  private generateSecurityAlert(auditLog: AuditLog): void {
    try {
      const alert: SecurityAlert = {
        auditLogId: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        riskScore: auditLog.riskScore,
        riskLevel: auditLog.getRiskLevel(),
        timestamp: auditLog.createdAt,
        metadata: {
          resource: auditLog.resource,
          resourceId: auditLog.resourceId,
          status: auditLog.status,
          ipAddress: auditLog.ipAddress?.toString(),
          userAgent: auditLog.userAgent,
          ...auditLog.metadata,
        },
      };

      // In production, this would:
      // 1. Send to monitoring system (Prometheus, Datadog, etc.)
      // 2. Send notifications (email, Slack, PagerDuty, etc.)
      // 3. Trigger automated responses (rate limiting, account lockout, etc.)

      log.warn('Security alert generated', {
        alertId: alert.auditLogId,
        userId: alert.userId,
        action: alert.action,
        riskScore: alert.riskScore,
        riskLevel: alert.riskLevel,
      });

      // For now, just log the alert
      // In production, integrate with alerting services
    } catch (error) {
      log.error('Failed to generate security alert', error as Error, {
        auditLogId: auditLog.id,
      });
      // Don't throw - alert generation failure should not break audit logging
    }
  }
}
