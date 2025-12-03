import { Device } from '../../../domain/entities/device.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * Device DTO for responses
 */
export interface DeviceDTO {
  id: string;
  name: string;
  type: string;
  isTrusted: boolean;
  lastSeenAt: string;
  createdAt: string;
}

/**
 * Device serializer for transforming Device entities to DTOs
 */
export class DeviceSerializer extends BaseSerializer {
  /**
   * Serialize device to DTO
   */
  static toDTO(device: Device): DeviceDTO {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      isTrusted: device.isTrusted,
      lastSeenAt: this.formatDate(device.lastSeenAt) as string,
      createdAt: this.formatDate(device.createdAt) as string,
    };
  }

  /**
   * Serialize multiple devices to DTOs
   */
  static toDTOList(devices: Device[]): DeviceDTO[] {
    return devices.map((device) => this.toDTO(device));
  }
}
