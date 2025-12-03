import { eq, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IDeviceRepository } from '../../domain/repositories/device.repository.js';
import { Device } from '../../domain/entities/device.entity.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { devices } from '../../core/database/schema/devices.schema.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../core/errors/types/application-error.js';

/**
 * Device Repository Implementation using Drizzle ORM
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */
export class DeviceRepository implements IDeviceRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Create a new device
   * Requirement: 15.1
   */
  async create(device: Device): Promise<Device> {
    try {
      const result = await this.db
        .insert(devices)
        .values({
          id: device.id,
          userId: device.userId,
          fingerprint: device.fingerprint.toString(),
          name: device.name,
          type: device.type,
          isTrusted: device.isTrusted,
          lastSeenAt: device.lastSeenAt,
          createdAt: device.createdAt,
        })
        .returning();

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      // Handle unique constraint violation (duplicate fingerprint)
      if (error.code === '23505') {
        throw new ConflictError('Device fingerprint already exists', {
          fingerprint: device.fingerprint.toString(),
        });
      }

      // Handle foreign key violation
      if (error.code === '23503') {
        throw new NotFoundError('User');
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'create',
      });
    }
  }

  /**
   * Find device by ID
   */
  async findById(id: string): Promise<Device | null> {
    try {
      const result = await this.db.select().from(devices).where(eq(devices.id, id)).limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findById',
      });
    }
  }

  /**
   * Find device by fingerprint
   * Requirement: 15.1
   */
  async findByFingerprint(fingerprint: string): Promise<Device | null> {
    try {
      const result = await this.db
        .select()
        .from(devices)
        .where(eq(devices.fingerprint, fingerprint))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByFingerprint',
      });
    }
  }

  /**
   * Find all devices for a user
   * Requirement: 15.2
   */
  async findByUserId(userId: string): Promise<Device[]> {
    try {
      const result = await this.db.select().from(devices).where(eq(devices.userId, userId));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByUserId',
      });
    }
  }

  /**
   * Update device
   * Requirement: 15.3
   */
  async update(device: Device): Promise<Device> {
    try {
      const result = await this.db
        .update(devices)
        .set({
          name: device.name,
          type: device.type,
          isTrusted: device.isTrusted,
          lastSeenAt: device.lastSeenAt,
        })
        .where(eq(devices.id, device.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Device');
      }

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'update',
      });
    }
  }

  /**
   * Delete device
   * Requirement: 15.4
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.delete(devices).where(eq(devices.id, id)).returning();

      if (result.length === 0) {
        throw new NotFoundError('Device');
      }
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'delete',
      });
    }
  }

  /**
   * Delete all devices for a user
   */
  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.db.delete(devices).where(eq(devices.userId, userId));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'deleteByUserId',
      });
    }
  }

  /**
   * Find unused devices (not seen in 90+ days)
   * Requirement: 15.6
   */
  async findUnusedDevices(daysThreshold: number): Promise<Device[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const result = await this.db
        .select()
        .from(devices)
        .where(lt(devices.lastSeenAt, thresholdDate));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findUnusedDevices',
      });
    }
  }

  /**
   * Delete unused devices
   * Requirement: 15.6
   */
  async deleteUnusedDevices(daysThreshold: number): Promise<number> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const result = await this.db
        .delete(devices)
        .where(lt(devices.lastSeenAt, thresholdDate))
        .returning();

      return result.length;
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'deleteUnusedDevices',
      });
    }
  }

  /**
   * Maps database row to Device entity
   */
  private mapToEntity(row: unknown): Device {
    return new Device({
      id: row.id,
      userId: row.userId,
      fingerprint: new DeviceFingerprint(row.fingerprint),
      name: row.name,
      type: row.type,
      isTrusted: row.isTrusted,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
    });
  }
}
