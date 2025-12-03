/**
 * Audit Log Service Interface
 * Re-exported from compliance module for use in shared middleware
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

export interface IAuditLogService {
  createAuditLog(input: CreateAuditLogInput): Promise<void>;
}
