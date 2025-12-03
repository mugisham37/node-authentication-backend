import { Device } from '../entities/device.entity.js';

/**
 * Pagination options for device queries
 */
export interface DevicePaginationOptions {
  offset: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  userId?: string;
  isTrusted?: boolean;
}

/**
 * Paginated device result
 */
export interface PaginatedDevices {
  devices: Device[];
  total: number;
}

/**
 * Device Repository Interface
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */
export interface IDeviceRepository {
  /**
   * Create a new device
   * Requirement: 15.1
   */
  create(device: Device): Promise<Device>;

  /**
   * Find device by ID
   */
  findById(id: string): Promise<Device | null>;

  /**
   * Find device by fingerprint
   * Requirement: 15.1
   */
  findByFingerprint(fingerprint: string): Promise<Device | null>;

  /**
   * Find all devices for a user
   * Requirement: 15.2
   */
  findByUserId(userId: string): Promise<Device[]>;

  /**
   * Find devices with pagination and filtering
   * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6
   */
  findPaginated(options: DevicePaginationOptions): Promise<PaginatedDevices>;

  /**
   * Update device
   * Requirement: 15.3
   */
  update(device: Device): Promise<Device>;

  /**
   * Delete device
   * Requirement: 15.4
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all devices for a user
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Find unused devices (not seen in 90+ days)
   * Requirement: 15.6
   */
  findUnusedDevices(daysThreshold: number): Promise<Device[]>;

  /**
   * Delete unused devices
   * Requirement: 15.6
   */
  deleteUnusedDevices(daysThreshold: number): Promise<number>;
}
