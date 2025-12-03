import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IPermissionRepository } from '../../domain/repositories/permission.repository.js';
import { Permission } from '../../domain/entities/permission.entity.js';
import {
  permissions,
  rolePermissions,
  userRoles,
} from '../../core/database/schema/roles.schema.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../core/errors/types/application-error.js';

/**
 * Permission Repository Implementation using Drizzle ORM
 * Requirements: 11.1, 12.1, 12.3
 */
export class PermissionRepository implements IPermissionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Find a permission by its unique ID
   */
  async findById(id: string): Promise<Permission | null> {
    try {
      const result = await this.db
        .select()
        .from(permissions)
        .where(eq(permissions.id, id))
        .limit(1);

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
   * Find a permission by resource and action
   * Requirement: 12.3
   */
  async findByResourceAndAction(resource: string, action: string): Promise<Permission | null> {
    try {
      const result = await this.db
        .select()
        .from(permissions)
        .where(and(eq(permissions.resource, resource), eq(permissions.action, action)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByResourceAndAction',
      });
    }
  }

  /**
   * Find all permissions
   */
  async findAll(): Promise<Permission[]> {
    try {
      const result = await this.db.select().from(permissions);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findAll',
      });
    }
  }

  /**
   * Find permissions by user ID (through roles)
   * Requirement: 11.3
   */
  async findByUserId(userId: string): Promise<Permission[]> {
    try {
      const result = await this.db
        .selectDistinct({
          permission: permissions,
        })
        .from(permissions)
        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
        .innerJoin(userRoles, eq(userRoles.roleId, rolePermissions.roleId))
        .where(eq(userRoles.userId, userId));

      return result.map((row) => this.mapToEntity(row.permission));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByUserId',
      });
    }
  }

  /**
   * Find permissions by role ID
   * Requirement: 11.3
   */
  async findByRoleId(roleId: string): Promise<Permission[]> {
    try {
      const result = await this.db
        .select({
          permission: permissions,
        })
        .from(permissions)
        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));

      return result.map((row) => this.mapToEntity(row.permission));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByRoleId',
      });
    }
  }

  /**
   * Save a new permission to the database
   */
  async save(permission: Permission): Promise<Permission> {
    try {
      const result = await this.db
        .insert(permissions)
        .values({
          id: permission.id,
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
          createdAt: permission.createdAt,
        })
        .returning();

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictError('Permission already exists', {
          resource: permission.resource,
          action: permission.action,
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'save',
      });
    }
  }

  /**
   * Update an existing permission
   */
  async update(permission: Permission): Promise<Permission> {
    try {
      const result = await this.db
        .update(permissions)
        .set({
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
        })
        .where(eq(permissions.id, permission.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Permission');
      }

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictError('Permission already exists', {
          resource: permission.resource,
          action: permission.action,
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'update',
      });
    }
  }

  /**
   * Delete a permission by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.delete(permissions).where(eq(permissions.id, id)).returning();

      if (result.length === 0) {
        throw new NotFoundError('Permission');
      }
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'delete',
      });
    }
  }

  /**
   * Maps database row to Permission entity
   */
  private mapToEntity(row: any): Permission {
    return new Permission({
      id: row.id,
      resource: row.resource,
      action: row.action,
      description: row.description,
      createdAt: row.createdAt,
    });
  }
}
