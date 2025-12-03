import { Permission } from '../../../domain/entities/permission.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * Permission DTO for responses
 */
export interface PermissionDTO {
  id: string;
  resource: string;
  action: string;
  description: string;
  createdAt: string;
}

/**
 * Permission serializer for transforming Permission entities to DTOs
 */
export class PermissionSerializer extends BaseSerializer {
  /**
   * Serialize permission to DTO
   */
  static toDTO(permission: Permission): PermissionDTO {
    return {
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      createdAt: this.formatDate(permission.createdAt) as string,
    };
  }

  /**
   * Serialize multiple permissions to DTOs
   */
  static toDTOList(permissions: Permission[]): PermissionDTO[] {
    return permissions.map((permission) => this.toDTO(permission));
  }
}
