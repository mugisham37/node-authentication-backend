import { Device } from '../entities/device.entity.js';

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
