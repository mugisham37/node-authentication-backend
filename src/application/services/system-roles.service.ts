import { Role } from '../../domain/entities/role.entity.js';
import { Permission } from '../../domain/entities/permission.entity.js';
import { IRoleRepository } from '../../domain/repositories/role.repository.js';
import { IPermissionRepository } from '../../domain/repositories/permission.repository.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { randomUUID } from 'crypto';

/**
 * System roles initialization service
 * Creates default admin, user, and moderator roles with appropriate permissions
 * Requirement: 11.6
 */
export class SystemRolesService {
  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly permissionRepository: IPermissionRepository
  ) {}

  /**
   * Initialize all system roles and permissions
   * This should be called during application startup
   * Requirement: 11.6
   */
  async initializeSystemRoles(): Promise<void> {
    try {
      logger.info('Initializing system roles and permissions');

      // Create permissions first
      const permissions = await this.createSystemPermissions();

      // Create roles with their permissions
      await this.createAdminRole(permissions);
      await this.createModeratorRole(permissions);
      await this.createUserRole(permissions);

      logger.info('System roles and permissions initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize system roles', error as Error);
      throw error;
    }
  }

  /**
   * Create all system permissions
   */
  private async createSystemPermissions(): Promise<Map<string, Permission>> {
    const permissionsMap = new Map<string, Permission>();
    const permissionDefinitions = this.getPermissionDefinitions();

    for (const def of permissionDefinitions) {
      const permission = await this.createOrGetPermission(def);
      const key = `${def.resource}:${def.action}`;
      permissionsMap.set(key, permission);
    }

    return permissionsMap;
  }

  /**
   * Get all permission definitions
   */
  private getPermissionDefinitions(): Array<{
    resource: string;
    action: string;
    description: string;
  }> {
    return [
      // User permissions
      { resource: 'users', action: 'read', description: 'Read user information' },
      { resource: 'users', action: 'write', description: 'Create and update users' },
      { resource: 'users', action: 'delete', description: 'Delete users' },
      { resource: 'users', action: '*', description: 'All user operations' },
      // Role permissions
      { resource: 'roles', action: 'read', description: 'Read role information' },
      { resource: 'roles', action: 'write', description: 'Create and update roles' },
      { resource: 'roles', action: 'delete', description: 'Delete roles' },
      { resource: 'roles', action: '*', description: 'All role operations' },
      // Permission permissions
      { resource: 'permissions', action: 'read', description: 'Read permission information' },
      { resource: 'permissions', action: 'write', description: 'Create and update permissions' },
      { resource: 'permissions', action: 'delete', description: 'Delete permissions' },
      { resource: 'permissions', action: '*', description: 'All permission operations' },
      // Session permissions
      { resource: 'sessions', action: 'read', description: 'Read session information' },
      { resource: 'sessions', action: 'write', description: 'Create sessions' },
      { resource: 'sessions', action: 'delete', description: 'Revoke sessions' },
      // Audit log permissions
      { resource: 'audit-logs', action: 'read', description: 'Read audit logs' },
      // Webhook permissions
      { resource: 'webhooks', action: 'read', description: 'Read webhook information' },
      { resource: 'webhooks', action: 'write', description: 'Create and update webhooks' },
      { resource: 'webhooks', action: 'delete', description: 'Delete webhooks' },
      // Device permissions
      { resource: 'devices', action: 'read', description: 'Read device information' },
      { resource: 'devices', action: 'write', description: 'Register devices' },
      { resource: 'devices', action: 'delete', description: 'Remove devices' },
      // Profile permissions
      { resource: 'profile', action: 'read', description: 'Read own profile' },
      { resource: 'profile', action: 'write', description: 'Update own profile' },
      // Wildcard permission (admin only)
      { resource: '*', action: '*', description: 'All operations on all resources' },
    ];
  }

  /**
   * Create or get existing permission
   */
  private async createOrGetPermission(def: {
    resource: string;
    action: string;
    description: string;
  }): Promise<Permission> {
    const existing = await this.permissionRepository.findByResourceAndAction(
      def.resource,
      def.action
    );

    if (existing) {
      logger.debug('Permission already exists', { resource: def.resource, action: def.action });
      return existing;
    }

    const permission = new Permission({
      id: randomUUID(),
      resource: def.resource,
      action: def.action,
      description: def.description,
    });

    const saved = await this.permissionRepository.save(permission);
    logger.debug('Permission created', { resource: def.resource, action: def.action });
    return saved;
  }

  /**
   * Create admin role with all permissions
   * Requirement: 11.6
   */
  private async createAdminRole(permissions: Map<string, Permission>): Promise<void> {
    const roleName = 'admin';

    // Check if role already exists
    const existing = await this.roleRepository.findByName(roleName);
    if (existing) {
      logger.info('Admin role already exists', { roleId: existing.id });
      return;
    }

    // Create admin role with wildcard permission
    const adminRole = new Role({
      id: randomUUID(),
      name: roleName,
      description: 'System administrator with full access to all resources',
      isSystem: true,
    });

    // Add wildcard permission (grants all access)
    const wildcardPermission = permissions.get('*:*');
    if (wildcardPermission) {
      adminRole.addPermission(wildcardPermission);
    }

    const saved = await this.roleRepository.save(adminRole);

    // Associate permission with role in database
    if (wildcardPermission) {
      await this.roleRepository.addPermission(saved.id, wildcardPermission.id);
    }

    logger.info('Admin role created', { roleId: saved.id });
  }

  /**
   * Create moderator role with limited administrative permissions
   * Requirement: 11.6
   */
  private async createModeratorRole(permissions: Map<string, Permission>): Promise<void> {
    const roleName = 'moderator';

    // Check if role already exists
    const existing = await this.roleRepository.findByName(roleName);
    if (existing) {
      logger.info('Moderator role already exists', { roleId: existing.id });
      return;
    }

    // Create moderator role
    const moderatorRole = new Role({
      id: randomUUID(),
      name: roleName,
      description: 'Moderator with limited administrative access',
      isSystem: true,
    });

    // Add moderator permissions
    const moderatorPermissions = [
      'users:read',
      'users:write',
      'sessions:read',
      'sessions:delete',
      'audit-logs:read',
      'devices:read',
      'profile:read',
      'profile:write',
    ];

    for (const permKey of moderatorPermissions) {
      const permission = permissions.get(permKey);
      if (permission) {
        moderatorRole.addPermission(permission);
      }
    }

    const saved = await this.roleRepository.save(moderatorRole);

    // Associate permissions with role in database
    for (const permKey of moderatorPermissions) {
      const permission = permissions.get(permKey);
      if (permission) {
        await this.roleRepository.addPermission(saved.id, permission.id);
      }
    }

    logger.info('Moderator role created', { roleId: saved.id });
  }

  /**
   * Create user role with basic permissions
   * Requirement: 11.6
   */
  private async createUserRole(permissions: Map<string, Permission>): Promise<void> {
    const roleName = 'user';

    // Check if role already exists
    const existing = await this.roleRepository.findByName(roleName);
    if (existing) {
      logger.info('User role already exists', { roleId: existing.id });
      return;
    }

    // Create user role
    const userRole = new Role({
      id: randomUUID(),
      name: roleName,
      description: 'Standard user with basic access',
      isSystem: true,
    });

    // Add user permissions
    const userPermissions = [
      'profile:read',
      'profile:write',
      'sessions:read',
      'sessions:write',
      'sessions:delete',
      'devices:read',
      'devices:write',
      'devices:delete',
      'webhooks:read',
      'webhooks:write',
      'webhooks:delete',
    ];

    for (const permKey of userPermissions) {
      const permission = permissions.get(permKey);
      if (permission) {
        userRole.addPermission(permission);
      }
    }

    const saved = await this.roleRepository.save(userRole);

    // Associate permissions with role in database
    for (const permKey of userPermissions) {
      const permission = permissions.get(permKey);
      if (permission) {
        await this.roleRepository.addPermission(saved.id, permission.id);
      }
    }

    logger.info('User role created', { roleId: saved.id });
  }
}
