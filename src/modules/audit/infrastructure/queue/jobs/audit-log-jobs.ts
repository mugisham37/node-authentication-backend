/**
 * Audit Log Job Definitions
 * Requirements: 13.1
 */

export interface AuditLogJobData {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  status: 'success' | 'failure' | 'pending';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export const AUDIT_LOG_JOB_TYPES = {
  CREATE: 'audit-log:create',
} as const;

export type AuditLogJobType = (typeof AUDIT_LOG_JOB_TYPES)[keyof typeof AUDIT_LOG_JOB_TYPES];
