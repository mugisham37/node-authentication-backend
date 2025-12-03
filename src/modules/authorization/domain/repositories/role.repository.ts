import { Role } from '../entities/role.entity.js';
import { Permission } from '../entities/permission.entity.js';

/**
 * Repository interface for Role entity operations
 * Requirements: 11.1, 11.2, 11.3, 11.6
 */
export interface IRoleRepository {
  /**
   * Find a role by its unique ID
   */
  findById(id: string): Promise<Role | null>;

  /**
   * Find a role by its name
   */
  findByName(name: string): Promise<Role | null>;

  /**
   * Find all roles
   */
  findAll(): Promise<Role[]>;

  /**
   * Find roles by user ID
   */
  findByUserId(userId: string): Promise<Role[]>;

  /**
   * Save a new role to the database
   */
  save(role: Role): Promise<Role>;

  /**
   * Update an existing role
   */
  update(role: Role): Promise<Role>;

  /**
   * Delete a role by ID
   * Should fail if role is marked as system role
   */
  delete(id: string): Promise<void>;

  /**
   * Assign a role to a user
   * Requirement: 11.1
   */
  assignToUser(userId: string, roleId: string, assignedBy?: string): Promise<void>;

  /**
   * Remove a role from a user
   * Requirement: 11.2
   */
  removeFromUser(userId: string, roleId: string): Promise<void>;

  /**
   * Add a permission to a role
   * Requirement: 11.1
   */
  addPermission(roleId: string, permissionId: string): Promise<void>;

  /**
   * Remove a permission from a role
   * Requirement: 11.2
   */
  removePermission(roleId: string, permissionId: string): Promise<void>;

  /**
   * Get all permissions for a role
   * Requirement: 11.3
   */
  getPermissions(roleId: string): Promise<Permission[]>;
}
