import * as redis from './redis.js';
import { log } from '../logging/logger.js';

/**
 * Cache service for managing application-level caching
 * Requirements: 11.4, 19.5
 */
export class CacheService {
  // Cache key prefixes
  private static readonly USER_PROFILE_PREFIX = 'user:profile:';
  private static readonly USER_PERMISSIONS_PREFIX = 'user:permissions:';
  private static readonly FREQUENTLY_ACCESSED_PREFIX = 'frequent:';

  // Cache TTLs (in seconds)
  private static readonly USER_PROFILE_TTL = 300; // 5 minutes
  private static readonly PERMISSION_TTL = 300; // 5 minutes (Requirement: 11.4)
  private static readonly FREQUENT_DATA_TTL = 600; // 10 minutes

  /**
   * Get user profile from cache
   * Requirement: 19.5
   */
  static async getUserProfile<T>(userId: string): Promise<T | null> {
    const key = `${this.USER_PROFILE_PREFIX}${userId}`;
    try {
      const cached = await redis.get<T>(key);
      if (cached) {
        log.debug('User profile cache hit', { userId });
      } else {
        log.debug('User profile cache miss', { userId });
      }
      return cached;
    } catch (error) {
      log.warn('Failed to get user profile from cache', {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Set user profile in cache
   * Requirement: 19.5
   */
  static async setUserProfile(userId: string, profile: unknown): Promise<void> {
    const key = `${this.USER_PROFILE_PREFIX}${userId}`;
    try {
      await redis.set(key, profile, this.USER_PROFILE_TTL);
      log.debug('User profile cached', { userId });
    } catch (error) {
      log.warn('Failed to cache user profile', {
        userId,
        error: (error as Error).message,
      });
      // Don't throw - cache write failure should not break the operation
    }
  }

  /**
   * Invalidate user profile cache
   * Requirement: 19.5
   */
  static async invalidateUserProfile(userId: string): Promise<void> {
    const key = `${this.USER_PROFILE_PREFIX}${userId}`;
    try {
      await redis.del(key);
      log.debug('User profile cache invalidated', { userId });
    } catch (error) {
      log.warn('Failed to invalidate user profile cache', {
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user permissions from cache
   * Requirement: 11.4
   */
  static async getUserPermissions<T>(userId: string): Promise<T | null> {
    const key = `${this.USER_PERMISSIONS_PREFIX}${userId}`;
    try {
      const cached = await redis.get<T>(key);
      if (cached) {
        log.debug('User permissions cache hit', { userId });
      } else {
        log.debug('User permissions cache miss', { userId });
      }
      return cached;
    } catch (error) {
      log.warn('Failed to get user permissions from cache', {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Set user permissions in cache
   * Requirement: 11.4
   */
  static async setUserPermissions(userId: string, permissions: unknown): Promise<void> {
    const key = `${this.USER_PERMISSIONS_PREFIX}${userId}`;
    try {
      await redis.set(key, permissions, this.PERMISSION_TTL);
      log.debug('User permissions cached', { userId });
    } catch (error) {
      log.warn('Failed to cache user permissions', {
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Invalidate user permissions cache
   * Requirement: 11.4
   */
  static async invalidateUserPermissions(userId: string): Promise<void> {
    const key = `${this.USER_PERMISSIONS_PREFIX}${userId}`;
    try {
      await redis.del(key);
      log.debug('User permissions cache invalidated', { userId });
    } catch (error) {
      log.warn('Failed to invalidate user permissions cache', {
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Invalidate all permission caches (when role permissions change)
   * Requirement: 11.5
   */
  static async invalidateAllPermissions(): Promise<void> {
    const pattern = `${this.USER_PERMISSIONS_PREFIX}*`;
    try {
      await redis.delPattern(pattern);
      log.info('All user permissions cache invalidated');
    } catch (error) {
      log.warn('Failed to invalidate all permissions cache', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Cache frequently accessed data
   * Requirement: 19.5
   */
  static async setFrequentData(key: string, data: unknown, ttl?: number): Promise<void> {
    const cacheKey = `${this.FREQUENTLY_ACCESSED_PREFIX}${key}`;
    const cacheTTL = ttl || this.FREQUENT_DATA_TTL;
    try {
      await redis.set(cacheKey, data, cacheTTL);
      log.debug('Frequent data cached', { key });
    } catch (error) {
      log.warn('Failed to cache frequent data', {
        key,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get frequently accessed data from cache
   * Requirement: 19.5
   */
  static async getFrequentData<T>(key: string): Promise<T | null> {
    const cacheKey = `${this.FREQUENTLY_ACCESSED_PREFIX}${key}`;
    try {
      const cached = await redis.get<T>(cacheKey);
      if (cached) {
        log.debug('Frequent data cache hit', { key });
      } else {
        log.debug('Frequent data cache miss', { key });
      }
      return cached;
    } catch (error) {
      log.warn('Failed to get frequent data from cache', {
        key,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Warm cache with frequently accessed data
   * This should be called on application startup or periodically
   * Requirement: 19.5
   */
  static async warmCache(dataLoader: () => Promise<Map<string, unknown>>): Promise<void> {
    try {
      log.info('Starting cache warming...');
      const data = await dataLoader();

      let warmedCount = 0;
      for (const [key, value] of data.entries()) {
        await this.setFrequentData(key, value);
        warmedCount++;
      }

      log.info('Cache warming completed', { itemsWarmed: warmedCount });
    } catch (error) {
      log.error('Cache warming failed', error as Error);
      // Don't throw - cache warming failure should not prevent startup
    }
  }

  /**
   * Invalidate cache by pattern
   * Requirement: 19.5
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      await redis.delPattern(pattern);
      log.debug('Cache pattern invalidated', { pattern });
    } catch (error) {
      log.warn('Failed to invalidate cache pattern', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Clear all application caches
   * Use with caution - typically only for testing or maintenance
   */
  static async clearAll(): Promise<void> {
    try {
      await redis.delPattern('user:*');
      await redis.delPattern('frequent:*');
      log.info('All application caches cleared');
    } catch (error) {
      log.error('Failed to clear all caches', error as Error);
    }
  }
}
