import { randomUUID } from 'crypto';
import { Device } from '../../domain/entities/device.entity.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { IDeviceRepository } from '../../domain/repositories/device.repository.js';
import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import { NotFoundError } from '../../shared/errors/types/application-error.js';
import { log } from '../../infrastructure/logging/logger.js';

/**
 * Input for device registration
 * Requirement: 15.1
 */
export interface RegisterDeviceInput {
  userId: string;
  fingerprint: DeviceFingerprint;
  name: string;
  type: string;
}

/**
 * Output for device registration
 * Requirement: 15.1
 */
export interface RegisterDeviceOutput {
  device: {
    id: string;
    name: string;
    type: string;
    isTrusted: boolean;
    lastSeenAt: Date;
    createdAt: Date;
  };
  isNew: boolean;
}

/**
 * Device list item
 * Requirement: 15.2
 */
export interface DeviceListItem {
  id: string;
  name: string;
  type: string;
  isTrusted: boolean;
  lastSeenAt: Date;
  createdAt: Date;
}

/**
 * Device Service Interface
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.6
 */
export interface IDeviceService {
  /**
   * Register a device on new login
   * Requirement: 15.1
   */
  registerDevice(input: RegisterDeviceInput): Promise<RegisterDeviceOutput>;

  /**
   * Get all devices for a user
   * Requirement: 15.2
   */
  listDevices(userId: string): Promise<DeviceListItem[]>;

  /**
   * Mark a device as trusted
   * Requirement: 15.3
   */
  markDeviceAsTrusted(userId: string, deviceId: string): Promise<void>;

  /**
   * Remove a device and terminate its sessions
   * Requirement: 15.4
   */
  removeDevice(userId: string, deviceId: string): Promise<void>;

  /**
   * Clean up unused devices (not seen in 90+ days)
   * Requirement: 15.6
   */
  cleanupUnusedDevices(): Promise<number>;

  /**
   * Update device last seen timestamp
   * Requirement: 15.1
   */
  updateDeviceLastSeen(deviceId: string): Promise<void>;
}

/**
 * Device Service Implementation
 * Manages user devices including registration, trust marking, and cleanup
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.6
 */
export class DeviceService implements IDeviceService {
  private readonly UNUSED_DEVICE_THRESHOLD_DAYS = 90;

  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly sessionRepository: ISessionRepository
  ) {}

  /**
   * Register a device on new login
   * If device already exists (by fingerprint), updates last seen
   * Requirement: 15.1
   */
  async registerDevice(input: RegisterDeviceInput): Promise<RegisterDeviceOutput> {
    try {
      // Check if device already exists by fingerprint
      const existingDevice = await this.deviceRepository.findByFingerprint(
        input.fingerprint.toString()
      );

      if (existingDevice) {
        // Device already registered - update last seen
        existingDevice.updateLastSeen();
        const updatedDevice = await this.deviceRepository.update(existingDevice);

        log.info('Device last seen updated', {
          deviceId: updatedDevice.id,
          userId: input.userId,
          deviceName: updatedDevice.name,
        });

        return {
          device: this.mapDeviceToOutput(updatedDevice),
          isNew: false,
        };
      }

      // Create new device
      const device = new Device({
        id: randomUUID(),
        userId: input.userId,
        fingerprint: input.fingerprint,
        name: input.name,
        type: input.type,
        isTrusted: false,
        lastSeenAt: new Date(),
        createdAt: new Date(),
      });

      const savedDevice = await this.deviceRepository.create(device);

      log.info('New device registered', {
        deviceId: savedDevice.id,
        userId: input.userId,
        deviceName: savedDevice.name,
        deviceType: savedDevice.type,
      });

      return {
        device: this.mapDeviceToOutput(savedDevice),
        isNew: true,
      };
    } catch (error) {
      log.error('Failed to register device', error as Error, {
        userId: input.userId,
        deviceName: input.name,
      });
      throw error;
    }
  }

  /**
   * Get all devices for a user
   * Requirement: 15.2
   */
  async listDevices(userId: string): Promise<DeviceListItem[]> {
    try {
      const devices = await this.deviceRepository.findByUserId(userId);

      log.debug('Retrieved user devices', {
        userId,
        deviceCount: devices.length,
      });

      return devices.map((device) => this.mapDeviceToOutput(device));
    } catch (error) {
      log.error('Failed to list devices', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Mark a device as trusted
   * Requirement: 15.3
   */
  async markDeviceAsTrusted(userId: string, deviceId: string): Promise<void> {
    try {
      const device = await this.deviceRepository.findById(deviceId);

      if (!device) {
        throw new NotFoundError('Device', { deviceId });
      }

      // Verify device belongs to user
      if (device.userId !== userId) {
        throw new NotFoundError('Device', { deviceId, userId });
      }

      // Mark as trusted
      device.markAsTrusted();
      await this.deviceRepository.update(device);

      log.info('Device marked as trusted', {
        deviceId,
        userId,
        deviceName: device.name,
      });
    } catch (error) {
      log.error('Failed to mark device as trusted', error as Error, {
        userId,
        deviceId,
      });
      throw error;
    }
  }

  /**
   * Remove a device and terminate its sessions
   * Requirement: 15.4
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const device = await this.deviceRepository.findById(deviceId);

      if (!device) {
        throw new NotFoundError('Device', { deviceId });
      }

      // Verify device belongs to user
      if (device.userId !== userId) {
        throw new NotFoundError('Device', { deviceId, userId });
      }

      // Terminate all sessions from this device
      // Sessions are identified by device fingerprint
      const sessions = await this.sessionRepository.findByUserId(userId);
      const deviceSessions = sessions.filter(
        (session) => session.deviceFingerprint.toString() === device.fingerprint.toString()
      );

      for (const session of deviceSessions) {
        session.revoke();
        await this.sessionRepository.update(session);
      }

      // Delete the device
      await this.deviceRepository.delete(deviceId);

      log.info('Device removed and sessions terminated', {
        deviceId,
        userId,
        deviceName: device.name,
        terminatedSessions: deviceSessions.length,
      });
    } catch (error) {
      log.error('Failed to remove device', error as Error, {
        userId,
        deviceId,
      });
      throw error;
    }
  }

  /**
   * Clean up unused devices (not seen in 90+ days)
   * Requirement: 15.6
   */
  async cleanupUnusedDevices(): Promise<number> {
    try {
      const deletedCount = await this.deviceRepository.deleteUnusedDevices(
        this.UNUSED_DEVICE_THRESHOLD_DAYS
      );

      log.info('Unused devices cleaned up', {
        deletedCount,
        thresholdDays: this.UNUSED_DEVICE_THRESHOLD_DAYS,
      });

      return deletedCount;
    } catch (error) {
      log.error('Failed to cleanup unused devices', error as Error);
      throw error;
    }
  }

  /**
   * Update device last seen timestamp
   * Requirement: 15.1
   */
  async updateDeviceLastSeen(deviceId: string): Promise<void> {
    try {
      const device = await this.deviceRepository.findById(deviceId);

      if (!device) {
        // Device not found - log warning but don't throw
        log.warn('Device not found for last seen update', { deviceId });
        return;
      }

      device.updateLastSeen();
      await this.deviceRepository.update(device);

      log.debug('Device last seen updated', {
        deviceId,
        lastSeenAt: device.lastSeenAt,
      });
    } catch (error) {
      log.error('Failed to update device last seen', error as Error, { deviceId });
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Helper: Map Device entity to output format
   */
  private mapDeviceToOutput(device: Device): DeviceListItem {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      isTrusted: device.isTrusted,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    };
  }
}
