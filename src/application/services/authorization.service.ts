import { Role } from '../../domain/entities/role.entity.js';
import { Permission } from '../../domain/entities/permission.entity.js';
import { IRoleRepository } from '../../domain/repositories/role.repository.js';
import { IPermissionRepository } from '../../domain/repositories/permission.repository.js';
import { NotFoundError } from '../../core/errors/types/application-error.js';
import * as cache from '../../core/cache/redis.js';
import { log } from '../../core/logging/logger.js';

/**
 * Authorization service interface
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4
 */
export interface IAuthorizationService {
  /**
   * Check if a user has permission to perform an action on a resource
   * Requirement: 12.1, 12.3
   */
  checkPermission(userId: string, resource: string, action: string): Promise<boolean>;

  /**
   * Get all permissions for a user (from all their roles)
   * Requirement: 11.3
   */
  getUserPermissions(userId: string): Promise<Permission[]>;

  /**
   * Assign a role to a user
   * Requirement: 11.1
   */
  assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void>;

  /**
   * Remove a role from a user
   * Requirement: 11.2
   */
  removeRole(userId: string, roleId: string): Promise<void>;

  /**
   * Get all roles for a user
   * Requirement: 11.3
   */
  getUserRoles(userId: string): Promise<Role[]>;

  /**
   * Invalidate permission cache for a user
   * Requirement: 11.5
   */
  invalidateUserPermissionCache(userId: string): Promise<void>;

  /**
   * Invalidate permission cache for all users with a specific role
   * Requirement: 11.5
   */
  invalidateRolePermissionCache(roleId: string): Promise<void>;
}

/**
 * Authorization service implementation
 * Handles permission checking, role assignment, and caching
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4
 */
export class AuthorizationService implements IAuthorizationService {
  private readonly PERMISSION_CACHE_TTL = 300; // 5 minutes (Requirement: 11.4)
  private readonly PERMISSION_CACHE_PREFIX = 'user:permissions:';
  private readonly USER_ROLES_CACHE_PREFIX = 'user:roles:';

  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly permissionRepository: IPermissionRepository
  ) {}

  /**
   * Check if a user has permission to perform an action on a resource
   * Uses caching for performance (Requirement: 11.4, 12.5)
   * Supports wildcard permissions (Requirement: 12.4)
   * Requirements: 12.1, 12.3
   */
  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Get user permissions (from cache or database)
      const permissions = await this.getUserPermissions(userId);

      // Check if any permission matches the requested resource and action
      const hasPermission = permissions.some((permission) => permission.matches(resource, action));

      const duration = Date.now() - startTime;
      log.debug('Permission check completed', {
        userId,
        resource,
        action,
        hasPermission,
        duration,
      });

      return hasPermission;
    } catch (error) {
      log.error('Permission check failed', error as Error, {
        userId,
        resource,
        action,
      });
      throw error;
    }
  }

  /**
   * Get all permissions for a user from all their roles
   * Uses caching with 5-minute TTL (Requirement: 11.4)
   * Returns union of permissions from all roles (Requirement: 11.3)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Try to get from cache first
    const cacheKey = `${this.PERMISSION_CACHE_PREFIX}${userId}`;

    try {
      const cached = await cache.get<Permission[]>(cacheKey);
      if (cached) {
        log.debug('Permission cache hit', { userId });
        // Reconstruct Permission instances from cached data
        return cached.map(
          (p) =>
            new Permission({
              id: p.id,
              resource: p.resource,
              action: p.action,
              description: p.description,
              createdAt: new Date(p.createdAt),
            })
        );
      }
    } catch (error) {
      // Cache failure should not prevent authorization
      log.warn('Permission cache read failed, falling back to database', {
        userId,
        error: (error as Error).message,
      });
    }

    // Cache miss - fetch from database
    log.debug('Permission cache miss', { userId });
    const permissions = await this.permissionRepository.findByUserId(userId);

    // Store in cache
    try {
      await cache.set(cacheKey, permissions, this.PERMISSION_CACHE_TTL);
    } catch (error) {
      // Cache write failure should not prevent authorization
      log.warn('Permission cache write failed', {
        userId,
        error: (error as Error).message,
      });
    }

    return permissions;
  }

  /**
   * Assign a role to a user
   * Invalidates permission cache after assignment (Requirement: 11.5)
   * Requirement: 11.1
   */
  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    try {
      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new NotFoundError('Role', { roleId });
      }

      // Assign role to user
      await this.roleRepository.assignToUser(userId, roleId, assignedBy);

      // Invalidate permission cache
      await this.invalidateUserPermissionCache(userId);

      log.info('Role assigned to user', {
        userId,
        roleId,
        roleName: role.name,
        assignedBy,
      });
    } catch (error) {
      log.error('Failed to assign role to user', error as Error, {
        userId,
        roleId,
        assignedBy,
      });
      throw error;
    }
  }

  /**
   * Remove a role from a user
   * Invalidates permission cache after removal (Requirement: 11.5)
   * Requirement: 11.2
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    try {
      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new NotFoundError('Role', { roleId });
      }

      // Remove role from user
      await this.roleRepository.removeFromUser(userId, roleId);

      // Invalidate permission cache
      await this.invalidateUserPermissionCache(userId);

      log.info('Role removed from user', {
        userId,
        roleId,
        roleName: role.name,
      });
    } catch (error) {
      log.error('Failed to remove role from user', error as Error, {
        userId,
        roleId,
      });
      throw error;
    }
  }

  /**
   * Get all roles for a user
   * Requirement: 11.3
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const roles = await this.roleRepository.findByUserId(userId);

      log.debug('Retrieved user roles', {
        userId,
        roleCount: roles.length,
      });

      return roles;
    } catch (error) {
      log.error('Failed to get user roles', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Invalidate permission cache for a specific user
   * Requirement: 11.5
   */
  async invalidateUserPermissionCache(userId: string): Promise<void> {
    const cacheKey = `${this.PERMISSION_CACHE_PREFIX}${userId}`;
    const rolesCacheKey = `${this.USER_ROLES_CACHE_PREFIX}${userId}`;

    try {
      await cache.del(cacheKey);
      await cache.del(rolesCacheKey);

      log.debug('User permission cache invalidated', { userId });
    } catch (error) {
      log.warn('Failed to invalidate user permission cache', {
        userId,
        error: (error as Error).message,
      });
      // Don't throw - cache invalidation failure should not break the operation
    }
  }

  /**
   * Invalidate permission cache for all users with a specific role
   * This is called when role permissions are modified
   * Requirement: 11.5
   */
  async invalidateRolePermissionCache(roleId: string): Promise<void> {
    try {
      // We need to invalidate cache for all users with this role
      // Since we don't have a reverse index, we'll use a pattern delete
      // This is acceptable because role permission changes are infrequent
      const pattern = `${this.PERMISSION_CACHE_PREFIX}*`;

      await cache.delPattern(pattern);

      log.info('Role permission cache invalidated for all users', { roleId });
    } catch (error) {
      log.warn('Failed to invalidate role permission cache', {
        roleId,
        error: (error as Error).message,
      });
      // Don't throw - cache invalidation failure should not break the operation
    }
  }
}
