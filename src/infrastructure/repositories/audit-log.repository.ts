import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IAuditLogRepository,
  AuditLogFilters,
} from '../../domain/repositories/audit-log.repository.js';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import { auditLogs } from '../../core/database/schema/audit.schema.js';
import {
  NotFoundError,
  ServiceUnavailableError,
} from '../../core/errors/types/application-error.js';

/**
 * Audit Log Repository Implementation using Drizzle ORM
 * Requirements: 13.1, 13.5, 13.6
 */
export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Create a new audit log entry (append-only)
   * Requirement: 13.1, 13.6
   */
  async create(auditLog: AuditLog): Promise<AuditLog> {
    try {
      const result = await this.db
        .insert(auditLogs)
        .values({
          id: auditLog.id,
          userId: auditLog.userId,
          action: auditLog.action,
          resource: auditLog.resource,
          resourceId: auditLog.resourceId,
          status: auditLog.status,
          ipAddress: auditLog.ipAddress?.toString() || null,
          userAgent: auditLog.userAgent,
          metadata: auditLog.metadata,
          riskScore: auditLog.riskScore,
          createdAt: auditLog.createdAt,
        })
        .returning();

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'create',
      });
    }
  }

  /**
   * Find audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    try {
      const result = await this.db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findById',
      });
    }
  }

  /**
   * Query audit logs with filters
   * Requirement: 13.5
   */
  async query(filters: AuditLogFilters): Promise<AuditLog[]> {
    try {
      let query = this.db.select().from(auditLogs);

      // Build WHERE conditions
      const conditions: any[] = [];

      if (filters.userId) {
        conditions.push(eq(auditLogs.userId, filters.userId));
      }

      if (filters.action) {
        conditions.push(eq(auditLogs.action, filters.action));
      }

      if (filters.resource) {
        conditions.push(eq(auditLogs.resource, filters.resource));
      }

      if (filters.status) {
        conditions.push(eq(auditLogs.status, filters.status));
      }

      if (filters.minRiskScore !== undefined) {
        conditions.push(gte(auditLogs.riskScore, filters.minRiskScore));
      }

      if (filters.maxRiskScore !== undefined) {
        conditions.push(lte(auditLogs.riskScore, filters.maxRiskScore));
      }

      if (filters.startDate) {
        conditions.push(gte(auditLogs.createdAt, filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(lte(auditLogs.createdAt, filters.endDate));
      }

      // Apply WHERE conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      // Order by created date descending (most recent first)
      query = query.orderBy(desc(auditLogs.createdAt)) as any;

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit) as any;
      }

      if (filters.offset) {
        query = query.offset(filters.offset) as any;
      }

      const result = await query;

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'query',
      });
    }
  }

  /**
   * Count audit logs matching filters
   * Requirement: 13.5
   */
  async count(filters: AuditLogFilters): Promise<number> {
    try {
      // Build WHERE conditions
      const conditions: any[] = [];

      if (filters.userId) {
        conditions.push(eq(auditLogs.userId, filters.userId));
      }

      if (filters.action) {
        conditions.push(eq(auditLogs.action, filters.action));
      }

      if (filters.resource) {
        conditions.push(eq(auditLogs.resource, filters.resource));
      }

      if (filters.status) {
        conditions.push(eq(auditLogs.status, filters.status));
      }

      if (filters.minRiskScore !== undefined) {
        conditions.push(gte(auditLogs.riskScore, filters.minRiskScore));
      }

      if (filters.maxRiskScore !== undefined) {
        conditions.push(lte(auditLogs.riskScore, filters.maxRiskScore));
      }

      if (filters.startDate) {
        conditions.push(gte(auditLogs.createdAt, filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(lte(auditLogs.createdAt, filters.endDate));
      }

      let query = this.db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);

      // Apply WHERE conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const result = await query;

      return result[0]?.count || 0;
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'count',
      });
    }
  }

  /**
   * Find high-risk audit logs
   * Requirement: 13.4
   */
  async findHighRisk(minRiskScore: number, limit: number = 100): Promise<AuditLog[]> {
    try {
      const result = await this.db
        .select()
        .from(auditLogs)
        .where(gte(auditLogs.riskScore, minRiskScore))
        .orderBy(desc(auditLogs.riskScore), desc(auditLogs.createdAt))
        .limit(limit);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findHighRisk',
      });
    }
  }

  /**
   * Find recent audit logs for a user
   */
  async findRecentByUserId(userId: string, limit: number): Promise<AuditLog[]> {
    try {
      const result = await this.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findRecentByUserId',
      });
    }
  }

  /**
   * Maps database row to AuditLog entity
   */
  private mapToEntity(row: any): AuditLog {
    return new AuditLog({
      id: row.id,
      userId: row.userId,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      status: row.status,
      ipAddress: row.ipAddress ? new IPAddress(row.ipAddress) : null,
      userAgent: row.userAgent,
      metadata: row.metadata || {},
      riskScore: row.riskScore,
      createdAt: row.createdAt,
    });
  }
}
