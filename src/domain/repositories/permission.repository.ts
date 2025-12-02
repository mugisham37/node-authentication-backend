import { Permission } from '../entities/permission.entity.js';

/**
 * Repository interface for Permission entity operations
 * Requirements: 11.1, 12.1, 12.3
 */
export interface IPermissionRepository {
  /**
   * Find a permission by its unique ID
   */
  findById(id: string): Promise<Permission | null>;

  /**
   * Find a permission by resource and action
   */
  findByResourceAndAction(resource: string, action: string): Promise<Permission | null>;

  /**
   * Find all permissions
   */
  findAll(): Promise<Permission[]>;

  /**
   * Find permissions by user ID (through roles)
   * Requirement: 11.3
   */
  findByUserId(userId: string): Promise<Permission[]>;

  /**
   * Find permissions by role ID
   * Requirement: 11.3
   */
  findByRoleId(roleId: string): Promise<Permission[]>;

  /**
   * Save a new permission to the database
   */
  save(permission: Permission): Promise<Permission>;

  /**
   * Update an existing permission
   */
  update(permission: Permission): Promise<Permission>;

  /**
   * Delete a permission by ID
   */
  delete(id: string): Promise<void>;
}
