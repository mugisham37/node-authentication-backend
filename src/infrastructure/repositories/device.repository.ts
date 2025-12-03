import { eq, lt, count, desc, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IDeviceRepository,
  DevicePaginationOptions,
  PaginatedDevices,
} from '../../domain/repositories/device.repository.js';
import { Device } from '../../domain/entities/device.entity.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { devices, type Device as DeviceRow } from '../database/schema/devices.schema.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../shared/errors/types/application-error.js';

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
          deviceId: device.fingerprint.toString(),
          deviceName: device.name || null,
          deviceType: device.type || null,
          isTrusted: device.isTrusted,
          lastSeenAt: device.lastSeenAt,
          createdAt: device.createdAt,
        })
        .returning();

      const createdDevice = result[0];
      if (!createdDevice) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'No result returned from insert',
          operation: 'create',
        });
      }

      return this.mapToEntity(createdDevice);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      // Handle unique constraint violation (duplicate fingerprint)
      if (err.code === '23505') {
        throw new ConflictError('Device fingerprint already exists', {
          fingerprint: device.fingerprint.toString(),
        });
      }

      // Handle foreign key violation
      if (err.code === '23503') {
        throw new NotFoundError('User');
      }

      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
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

      const device = result[0];
      if (!device) {
        return null;
      }

      return this.mapToEntity(device);
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
        .where(eq(devices.deviceId, fingerprint))
        .limit(1);

      const device = result[0];
      if (!device) {
        return null;
      }

      return this.mapToEntity(device);
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
          deviceName: device.name || null,
          deviceType: device.type || null,
          isTrusted: device.isTrusted,
          lastSeenAt: device.lastSeenAt,
        })
        .where(eq(devices.id, device.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Device');
      }

      const updatedDevice = result[0];
      if (!updatedDevice) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'No result returned from update',
          operation: 'update',
        });
      }

      return this.mapToEntity(updatedDevice);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      const err = error as { message?: string };
      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
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
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      const err = error as { message?: string };
      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
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
   * Find devices with pagination and filtering
   * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6
   */
  async findPaginated(options: DevicePaginationOptions): Promise<PaginatedDevices> {
    try {
      // Build where conditions
      const conditions = [];

      if (options.userId) {
        conditions.push(eq(devices.userId, options.userId));
      }

      if (options.isTrusted !== undefined) {
        conditions.push(eq(devices.isTrusted, options.isTrusted));
      }

      const whereClause = conditions.length > 0 ? eq(devices.userId, options.userId!) : undefined;

      // Get total count
      const countResult = await this.db
        .select({ count: count() })
        .from(devices)
        .where(whereClause);

      const total = countResult[0]?.count ?? 0;

      // Get paginated results
      const sortColumn =
        options.sortBy === 'name'
          ? devices.deviceName
          : options.sortBy === 'lastSeenAt'
            ? devices.lastSeenAt
            : devices.createdAt;
      const sortDirection = options.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      const result = await this.db
        .select()
        .from(devices)
        .where(whereClause)
        .orderBy(sortDirection)
        .limit(options.limit)
        .offset(options.offset);

      const deviceEntities = result.map((row) => this.mapToEntity(row));

      return {
        devices: deviceEntities,
        total: Number(total),
      };
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findPaginated',
      });
    }
  }

  /**
   * Maps database row to Device entity
   */
  private mapToEntity(row: DeviceRow): Device {
    return new Device({
      id: row.id,
      userId: row.userId,
      fingerprint: new DeviceFingerprint({
        userAgent: row.userAgent || '',
        screenResolution: undefined,
        timezone: undefined,
        canvasFingerprint: undefined,
      }),
      name: row.deviceName || 'Unknown Device',
      type: row.deviceType || 'unknown',
      isTrusted: row.isTrusted,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
    });
  }
}
