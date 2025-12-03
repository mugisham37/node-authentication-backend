import { AuditLog } from '../../../domain/entities/audit-log.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * Audit log DTO for responses
 */
export interface AuditLogDTO {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  riskScore: number | null;
  createdAt: string;
}

/**
 * Audit log serializer for transforming AuditLog entities to DTOs
 */
export class AuditLogSerializer extends BaseSerializer {
  /**
   * Serialize audit log to DTO
   */
  static toDTO(auditLog: AuditLog): AuditLogDTO {
    return {
      id: auditLog.id,
      userId: auditLog.userId,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      status: auditLog.status,
      ipAddress: auditLog.ipAddress ? (this.extractValue(auditLog.ipAddress) as string) : null,
      userAgent: auditLog.userAgent,
      metadata: auditLog.metadata,
      riskScore: auditLog.riskScore,
      createdAt: this.formatDate(auditLog.createdAt) as string,
    };
  }

  /**
   * Serialize multiple audit logs to DTOs
   */
  static toDTOList(auditLogs: AuditLog[]): AuditLogDTO[] {
    return auditLogs.map((auditLog) => this.toDTO(auditLog));
  }
}
