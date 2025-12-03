import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IRoleRepository } from '../../domain/repositories/role.repository.js';
import { Role } from '../../domain/entities/role.entity.js';
import { Permission } from '../../domain/entities/permission.entity.js';
import {
  roles,
  permissions,
  userRoles,
  rolePermissions,
  type Role as RoleRow,
  type Permission as PermissionRow,
} from '../database/schema/roles.schema.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../shared/errors/types/application-error.js';

/**
 * Role Repository Implementation using Drizzle ORM
 * Requirements: 11.1, 11.2, 11.3, 11.6
 */
export class RoleRepository implements IRoleRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Find a role by its unique ID
   */
  async findById(id: string): Promise<Role | null> {
    try {
      const result = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1);

      const role = result[0];
      if (!role) {
        return null;
      }

      // Load permissions for the role
      const rolePermissions = await this.getPermissions(id);

      return this.mapToEntity(role, rolePermissions);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findById',
      });
    }
  }

  /**
   * Find a role by its name
   */
  async findByName(name: string): Promise<Role | null> {
    try {
      const result = await this.db.select().from(roles).where(eq(roles.name, name)).limit(1);

      if (result.length === 0 || !result[0]) {
        return null;
      }

      // Load permissions for the role
      const firstRole = result[0];
      if (!firstRole) {
        return null;
      }

      const rolePerms = await this.getPermissions(firstRole.id);

      return this.mapToEntity(firstRole, rolePerms);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByName',
      });
    }
  }

  /**
   * Find all roles
   */
  async findAll(): Promise<Role[]> {
    try {
      const result = await this.db.select().from(roles);

      const rolesWithPermissions: Role[] = [];
      for (const roleRow of result) {
        const rolePerms = await this.getPermissions(roleRow.id);
        rolesWithPermissions.push(this.mapToEntity(roleRow, rolePerms));
      }

      return rolesWithPermissions;
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findAll',
      });
    }
  }

  /**
   * Find roles by user ID
   * Requirement: 11.3
   */
  async findByUserId(userId: string): Promise<Role[]> {
    try {
      const result = await this.db
        .select({
          role: roles,
        })
        .from(roles)
        .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId));

      const rolesWithPermissions: Role[] = [];
      for (const row of result) {
        const rolePerms = await this.getPermissions(row.role.id);
        rolesWithPermissions.push(this.mapToEntity(row.role, rolePerms));
      }

      return rolesWithPermissions;
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByUserId',
      });
    }
  }

  /**
   * Save a new role to the database
   */
  async save(role: Role): Promise<Role> {
    try {
      const result = await this.db
        .insert(roles)
        .values({
          id: role.id,
          name: role.name,
          description: role.description || null,
          isSystem: role.isSystem,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        })
        .returning();

      if (!result[0]) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'No result returned from insert',
          operation: 'save',
        });
      }

      // Add permissions if any
      if (role.permissions.length > 0) {
        for (const permission of role.permissions) {
          await this.addPermission(role.id, permission.id);
        }
      }

      return this.mapToEntity(result[0], role.permissions);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      // Handle unique constraint violation
      if (err.code === '23505') {
        throw new ConflictError('Role name already exists', {
          name: role.name,
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
        operation: 'save',
      });
    }
  }

  /**
   * Update an existing role
   */
  async update(role: Role): Promise<Role> {
    try {
      const result = await this.db
        .update(roles)
        .set({
          name: role.name,
          description: role.description || null,
          isSystem: role.isSystem,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, role.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Role');
      }

      if (!result[0]) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'No result returned from update',
          operation: 'update',
        });
      }

      return this.mapToEntity(result[0], role.permissions);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      const err = error as { code?: string; message?: string };
      // Handle unique constraint violation
      if (err.code === '23505') {
        throw new ConflictError('Role name already exists', {
          name: role.name,
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
        operation: 'update',
      });
    }
  }

  /**
   * Delete a role by ID
   * Should fail if role is marked as system role
   * Requirement: 11.6
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if role is a system role
      const role = await this.findById(id);
      if (!role) {
        throw new NotFoundError('Role');
      }

      if (role.isSystemRole()) {
        throw new ValidationError('Cannot delete system role', {
          roleId: id,
          roleName: role.name,
        });
      }

      const result = await this.db.delete(roles).where(eq(roles.id, id)).returning();

      if (result.length === 0) {
        throw new NotFoundError('Role');
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      const err = error as { message?: string };
      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
        operation: 'delete',
      });
    }
  }

  /**
   * Assign a role to a user
   * Requirement: 11.1
   */
  async assignToUser(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    try {
      await this.db.insert(userRoles).values({
        userId,
        roleId,
        assignedBy: assignedBy || null,
        assignedAt: new Date(),
      });
    } catch (error) {
      const err = error as { code?: string; message?: string };
      // Handle unique constraint violation (already assigned)
      if (err.code === '23505') {
        // Role already assigned, ignore
        return;
      }

      // Handle foreign key violation
      if (err.code === '23503') {
        throw new NotFoundError('User or Role');
      }

      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
        operation: 'assignToUser',
      });
    }
  }

  /**
   * Remove a role from a user
   * Requirement: 11.2
   */
  async removeFromUser(userId: string, roleId: string): Promise<void> {
    try {
      await this.db
        .delete(userRoles)
        .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'removeFromUser',
      });
    }
  }

  /**
   * Add a permission to a role
   * Requirement: 11.1
   */
  async addPermission(roleId: string, permissionId: string): Promise<void> {
    try {
      await this.db.insert(rolePermissions).values({
        roleId,
        permissionId,
        createdAt: new Date(),
      });
    } catch (error) {
      const err = error as { code?: string; message?: string };
      // Handle unique constraint violation (already added)
      if (err.code === '23505') {
        // Permission already added, ignore
        return;
      }

      // Handle foreign key violation
      if (err.code === '23503') {
        throw new NotFoundError('Role or Permission');
      }

      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
        operation: 'addPermission',
      });
    }
  }

  /**
   * Remove a permission from a role
   * Requirement: 11.2
   */
  async removePermission(roleId: string, permissionId: string): Promise<void> {
    try {
      await this.db
        .delete(rolePermissions)
        .where(
          and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
        );
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'removePermission',
      });
    }
  }

  /**
   * Get all permissions for a role
   * Requirement: 11.3
   */
  async getPermissions(roleId: string): Promise<Permission[]> {
    try {
      const result = await this.db
        .select({
          permission: permissions,
        })
        .from(permissions)
        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));

      return result.map((row) => this.mapPermissionToEntity(row.permission));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'getPermissions',
      });
    }
  }

  /**
   * Maps database row to Role entity
   */
  private mapToEntity(row: RoleRow, permissions: Permission[]): Role {
    return new Role({
      id: row.id,
      name: row.name,
      description: row.description || '',
      isSystem: row.isSystem,
      permissions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * Maps database row to Permission entity
   */
  private mapPermissionToEntity(row: PermissionRow): Permission {
    return new Permission({
      id: row.id,
      resource: row.resource,
      action: row.action,
      description: row.description || '',
      createdAt: row.createdAt,
    });
  }
}
