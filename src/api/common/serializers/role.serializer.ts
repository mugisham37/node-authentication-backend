import { Role } from '../../../domain/entities/role.entity.js';
import { BaseSerializer } from './base.serializer.js';
import { PermissionSerializer, PermissionDTO } from './permission.serializer.js';

/**
 * Role DTO for responses
 */
export interface RoleDTO {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionDTO[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Role DTO without permissions (for list responses)
 */
export interface RoleSummaryDTO {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Role serializer for transforming Role entities to DTOs
 */
export class RoleSerializer extends BaseSerializer {
  /**
   * Serialize role to DTO (with permissions)
   */
  static toDTO(role: Role): RoleDTO {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: PermissionSerializer.toDTOList(role.permissions),
      createdAt: this.formatDate(role.createdAt) as string,
      updatedAt: this.formatDate(role.updatedAt) as string,
    };
  }

  /**
   * Serialize role to summary DTO (without permissions)
   */
  static toSummary(role: Role): RoleSummaryDTO {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: this.formatDate(role.createdAt) as string,
      updatedAt: this.formatDate(role.updatedAt) as string,
    };
  }

  /**
   * Serialize multiple roles to DTOs
   */
  static toDTOList(roles: Role[]): RoleDTO[] {
    return roles.map((role) => this.toDTO(role));
  }

  /**
   * Serialize multiple roles to summary DTOs
   */
  static toSummaryList(roles: Role[]): RoleSummaryDTO[] {
    return roles.map((role) => this.toSummary(role));
  }
}
