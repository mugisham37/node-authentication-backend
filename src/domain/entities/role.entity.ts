import { Permission } from './permission.entity.js';

/**
 * Role entity representing a named collection of permissions.
 * Requirements: 11.1, 11.2, 11.3, 11.6
 */
export class Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;

  constructor(props: {
    id: string;
    name: string;
    description: string;
    isSystem?: boolean;
    permissions?: Permission[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.isSystem = props.isSystem ?? false;
    this.permissions = props.permissions ?? [];
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Adds a permission to the role
   * Requirement: 11.1
   */
  addPermission(permission: Permission): void {
    // Check if permission already exists
    const exists = this.permissions.some((p) => p.equals(permission));
    if (!exists) {
      this.permissions.push(permission);
      this.updatedAt = new Date();
    }
  }

  /**
   * Removes a permission from the role
   * Requirement: 11.2
   */
  removePermission(permissionId: string): void {
    const initialLength = this.permissions.length;
    this.permissions = this.permissions.filter((p) => p.id !== permissionId);

    if (this.permissions.length !== initialLength) {
      this.updatedAt = new Date();
    }
  }

  /**
   * Checks if the role has a specific permission
   * Requirement: 11.3, 12.3
   */
  hasPermission(resource: string, action: string): boolean {
    return this.permissions.some((p) => p.matches(resource, action));
  }

  /**
   * Gets all permissions for this role
   * Requirement: 11.3
   */
  getPermissions(): Permission[] {
    return [...this.permissions];
  }

  /**
   * Checks if this is a system role (cannot be deleted)
   * Requirement: 11.6
   */
  isSystemRole(): boolean {
    return this.isSystem;
  }

  /**
   * Marks the role as a system role
   * Requirement: 11.6
   */
  markAsSystem(): void {
    this.isSystem = true;
    this.updatedAt = new Date();
  }
}
