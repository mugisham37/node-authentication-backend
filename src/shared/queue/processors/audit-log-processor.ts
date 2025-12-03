/**
 * Audit Log Job Processor
 * Processes audit log creation jobs from the queue
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6
 */

import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { logger } from '../../logging/logger.js';
import { AuditLog } from '../../../modules/compliance/domain/entities/audit-log.entity.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import type { IAuditLogRepository } from '../../domain/repositories/audit-log.repository.js';
import { AuditLogJobData } from '../jobs/audit-log-jobs.js';

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

export class AuditLogProcessor {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}

  /**
   * Process audit log creation job
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6
   */
  async process(job: Job<AuditLogJobData>): Promise<void> {
    const input = job.data;

    logger.info('Processing audit log job', {
      jobId: job.id,
      action: input.action,
      userId: input.userId,
      attempt: job.attemptsMade + 1,
    });

    try {
      // Parse IP address if provided
      let ipAddress: IPAddress | null = null;
      if (input.ipAddress) {
        try {
          ipAddress = new IPAddress(input.ipAddress);
        } catch (error) {
          logger.warn('Invalid IP address in audit log', {
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

      logger.info('Audit log created', {
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
      logger.error('Failed to process audit log job', {
        jobId: job.id,
        action: input.action,
        userId: input.userId,
        error: error instanceof Error ? error.message : String(error),
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

      logger.warn('Security alert generated', {
        alertId: alert.auditLogId,
        userId: alert.userId,
        action: alert.action,
        riskScore: alert.riskScore,
        riskLevel: alert.riskLevel,
      });

      // For now, just log the alert
      // In production, integrate with alerting services
    } catch (error) {
      logger.error('Failed to generate security alert', {
        auditLogId: auditLog.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - alert generation failure should not break audit logging
    }
  }
}
