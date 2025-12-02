import { AuditLog } from '../entities/audit-log.entity.js';

/**
 * Audit log query filters
 * Requirement: 13.5
 */
export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  status?: 'success' | 'failure' | 'pending';
  minRiskScore?: number;
  maxRiskScore?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit Log Repository Interface
 * Requirements: 13.1, 13.5, 13.6
 */
export interface IAuditLogRepository {
  /**
   * Create a new audit log entry (append-only)
   * Requirement: 13.1, 13.6
   */
  create(auditLog: AuditLog): Promise<AuditLog>;

  /**
   * Find audit log by ID
   */
  findById(id: string): Promise<AuditLog | null>;

  /**
   * Query audit logs with filters
   * Requirement: 13.5
   */
  query(filters: AuditLogFilters): Promise<AuditLog[]>;

  /**
   * Count audit logs matching filters
   * Requirement: 13.5
   */
  count(filters: AuditLogFilters): Promise<number>;

  /**
   * Find high-risk audit logs
   * Requirement: 13.4
   */
  findHighRisk(minRiskScore: number, limit?: number): Promise<AuditLog[]>;

  /**
   * Find recent audit logs for a user
   */
  findRecentByUserId(userId: string, limit: number): Promise<AuditLog[]>;
}
