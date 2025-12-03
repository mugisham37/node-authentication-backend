import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IAuditLogRepository,
  AuditLogFilters,
} from '../../../domain/repositories/audit-log.repository.js';
import { AuditLog } from '../../../domain/entities/audit-log.entity.js';
import { IPAddress } from '../../../domain/value-objects/ip-address.value-object.js';
import { auditLogs } from '../../database/schema/audit.schema.js';
import { ServiceUnavailableError } from '../../../shared/errors/types/application-error.js';

type AuditLogRow = typeof auditLogs.$inferSelect;

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
          userId: auditLog.userId,
          action: auditLog.action,
          resource: auditLog.resource ?? '',
          resourceId: auditLog.resourceId,
          status: auditLog.status,
          ipAddress: auditLog.ipAddress?.toString() ?? null,
          userAgent: auditLog.userAgent,
          metadata: auditLog.metadata,
          riskScore: auditLog.riskScore,
        })
        .returning();

      if (result.length === 0) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'Insert returned no rows',
          operation: 'create',
        });
      }

      const insertedRow = result[0];
      if (!insertedRow) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'Insert returned undefined row',
          operation: 'create',
        });
      }

      return this.mapToEntity(insertedRow);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError('Database', {
        originalError: errorMessage,
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

      if (result.length === 0 || !result[0]) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError('Database', {
        originalError: errorMessage,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      let query: any = this.db.select().from(auditLogs);

      // Build WHERE conditions
      const conditions: SQL[] = [];

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        query = query.where(and(...conditions));
      }

      // Order by created date descending (most recent first)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      query = query.orderBy(desc(auditLogs.createdAt));

      // Apply pagination
      if (filters.limit) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        query = query.offset(filters.offset);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await query;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return result.map((row: AuditLogRow) => this.mapToEntity(row));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError('Database', {
        originalError: errorMessage,
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
      const conditions: SQL[] = [];

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      let query: any = this.db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);

      // Apply WHERE conditions
      if (conditions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        query = query.where(and(...conditions));
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await query;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return result[0]?.count || 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError('Database', {
        originalError: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError('Database', {
        originalError: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError('Database', {
        originalError: errorMessage,
        operation: 'findRecentByUserId',
      });
    }
  }

  /**
   * Maps database row to AuditLog entity
   */
  private mapToEntity(row: AuditLogRow): AuditLog {
    return new AuditLog({
      id: row.id,
      userId: row.userId ?? null,
      action: row.action,
      resource: row.resource ?? null,
      resourceId: row.resourceId ?? null,
      status: row.status as 'success' | 'failure' | 'pending',
      ipAddress: row.ipAddress ? new IPAddress(row.ipAddress) : null,
      userAgent: row.userAgent ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      riskScore: row.riskScore,
      createdAt: row.createdAt,
    });
  }
}
