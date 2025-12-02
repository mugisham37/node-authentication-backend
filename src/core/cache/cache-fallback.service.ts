import { logger } from '../logging/logger.js';
import * as redis from './redis.js';

/**
 * Cache Fallback Service
 * Requirement: 19.6 - Handle cache unavailability gracefully
 *
 * This service provides graceful degradation when Redis is unavailable.
 * It allows the application to continue operating without cache, falling back
 * to direct database queries when necessary.
 */

export interface CacheFallbackConfig {
  enableFallback: boolean; // Whether to enable fallback mode
  fallbackTTL: number; // TTL for in-memory fallback cache (ms)
  maxFallbackSize: number; // Maximum number of items in fallback cache
  logWarnings: boolean; // Whether to log cache unavailability warnings
}

const DEFAULT_CONFIG: CacheFallbackConfig = {
  enableFallback: true,
  fallbackTTL: 60000, // 1 minute
  maxFallbackSize: 1000,
  logWarnings: true,
};

// In-memory fallback cache
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const fallbackCache = new Map<string, CacheEntry<any>>();
let cacheAvailable = true;
let lastCacheCheckTime = 0;
const CACHE_CHECK_INTERVAL = 5000; // Check cache health every 5 seconds

/**
 * Check if Redis cache is available
 * Requirement: 19.6 - Continue operation without Redis when possible
 */
async function isCacheAvailable(): Promise<boolean> {
  const now = Date.now();

  // Don't check too frequently
  if (now - lastCacheCheckTime < CACHE_CHECK_INTERVAL) {
    return cacheAvailable;
  }

  lastCacheCheckTime = now;

  try {
    const health = await redis.checkHealth();
    cacheAvailable = health.healthy;

    if (!cacheAvailable && DEFAULT_CONFIG.logWarnings) {
      logger.warn('Redis cache is unavailable, using fallback mode', {
        latency: health.latency,
      });
    }

    return cacheAvailable;
  } catch (error) {
    cacheAvailable = false;

    if (DEFAULT_CONFIG.logWarnings) {
      logger.warn('Redis cache health check failed, using fallback mode', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return false;
  }
}

/**
 * Clean up expired entries from fallback cache
 */
function cleanupFallbackCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of fallbackCache.entries()) {
    if (entry.expiresAt <= now) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    fallbackCache.delete(key);
  }

  if (keysToDelete.length > 0) {
    logger.debug('Cleaned up expired fallback cache entries', {
      count: keysToDelete.length,
    });
  }
}

/**
 * Enforce maximum size of fallback cache using LRU eviction
 */
function enforceFallbackCacheSize(): void {
  if (fallbackCache.size <= DEFAULT_CONFIG.maxFallbackSize) {
    return;
  }

  // Remove oldest entries (first entries in Map)
  const entriesToRemove = fallbackCache.size - DEFAULT_CONFIG.maxFallbackSize;
  const keys = Array.from(fallbackCache.keys());

  for (let i = 0; i < entriesToRemove; i++) {
    fallbackCache.delete(keys[i]);
  }

  logger.debug('Evicted entries from fallback cache', {
    count: entriesToRemove,
  });
}

/**
 * Get value from cache with fallback support
 * Requirement: 19.6 - Handle cache unavailability gracefully
 *
 * @param key Cache key
 * @param fallbackFn Function to call if cache miss or unavailable
 * @param ttlSeconds TTL in seconds for cache entry
 * @returns Cached or computed value
 */
export async function getWithFallback<T>(
  key: string,
  fallbackFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  const available = await isCacheAvailable();

  if (available) {
    try {
      // Try to get from Redis
      const cached = await redis.get<T>(key);

      if (cached !== null) {
        return cached;
      }

      // Cache miss - compute value
      const value = await fallbackFn();

      // Store in Redis (fire and forget)
      redis.set(key, value, ttlSeconds).catch((error) => {
        logger.warn('Failed to store value in Redis cache', {
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      return value;
    } catch (error) {
      logger.warn('Redis operation failed, falling back to direct computation', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fall through to fallback mode
    }
  }

  // Redis unavailable or operation failed - use fallback
  if (DEFAULT_CONFIG.enableFallback) {
    // Check in-memory fallback cache
    const fallbackEntry = fallbackCache.get(key);

    if (fallbackEntry && fallbackEntry.expiresAt > Date.now()) {
      logger.debug('Serving from fallback cache', { key });
      return fallbackEntry.value;
    }

    // Compute value
    const value = await fallbackFn();

    // Store in fallback cache
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : DEFAULT_CONFIG.fallbackTTL;
    fallbackCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    // Cleanup and enforce size limits
    cleanupFallbackCache();
    enforceFallbackCacheSize();

    return value;
  }

  // No fallback - just compute value
  return fallbackFn();
}

/**
 * Set value in cache with fallback support
 * Requirement: 19.6 - Continue operation without Redis when possible
 *
 * @param key Cache key
 * @param value Value to cache
 * @param ttlSeconds TTL in seconds
 */
export async function setWithFallback<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const available = await isCacheAvailable();

  if (available) {
    try {
      await redis.set(key, value, ttlSeconds);
      return;
    } catch (error) {
      logger.warn('Failed to set value in Redis, using fallback', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Use fallback cache
  if (DEFAULT_CONFIG.enableFallback) {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : DEFAULT_CONFIG.fallbackTTL;
    fallbackCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    enforceFallbackCacheSize();
  }
}

/**
 * Delete value from cache with fallback support
 * Requirement: 19.6 - Handle cache unavailability gracefully
 *
 * @param key Cache key
 */
export async function deleteWithFallback(key: string): Promise<void> {
  const available = await isCacheAvailable();

  if (available) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn('Failed to delete value from Redis', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Also delete from fallback cache
  fallbackCache.delete(key);
}

/**
 * Delete pattern from cache with fallback support
 * Requirement: 19.6 - Handle cache unavailability gracefully
 *
 * @param pattern Key pattern
 */
export async function deletePatternWithFallback(pattern: string): Promise<void> {
  const available = await isCacheAvailable();

  if (available) {
    try {
      await redis.delPattern(pattern);
    } catch (error) {
      logger.warn('Failed to delete pattern from Redis', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Delete matching keys from fallback cache
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  const keysToDelete: string[] = [];

  for (const key of fallbackCache.keys()) {
    if (regex.test(key)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    fallbackCache.delete(key);
  }
}

/**
 * Check if key exists in cache with fallback support
 * Requirement: 19.6 - Continue operation without Redis when possible
 *
 * @param key Cache key
 * @returns True if key exists
 */
export async function existsWithFallback(key: string): Promise<boolean> {
  const available = await isCacheAvailable();

  if (available) {
    try {
      return await redis.exists(key);
    } catch (error) {
      logger.warn('Failed to check key existence in Redis', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Check fallback cache
  const entry = fallbackCache.get(key);
  return entry !== undefined && entry.expiresAt > Date.now();
}

/**
 * Increment counter with fallback support
 * Requirement: 19.6 - Handle cache unavailability gracefully
 *
 * @param key Cache key
 * @returns New counter value
 */
export async function incrWithFallback(key: string): Promise<number> {
  const available = await isCacheAvailable();

  if (available) {
    try {
      return await redis.incr(key);
    } catch (error) {
      logger.warn('Failed to increment counter in Redis, using fallback', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Use fallback cache
  const entry = fallbackCache.get(key);
  const currentValue = entry && entry.expiresAt > Date.now() ? (entry.value as number) : 0;
  const newValue = currentValue + 1;

  fallbackCache.set(key, {
    value: newValue,
    expiresAt: Date.now() + DEFAULT_CONFIG.fallbackTTL,
  });

  return newValue;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  redisAvailable: boolean;
  fallbackCacheSize: number;
  fallbackCacheMaxSize: number;
} {
  return {
    redisAvailable: cacheAvailable,
    fallbackCacheSize: fallbackCache.size,
    fallbackCacheMaxSize: DEFAULT_CONFIG.maxFallbackSize,
  };
}

/**
 * Clear fallback cache
 */
export function clearFallbackCache(): void {
  fallbackCache.clear();
  logger.info('Fallback cache cleared');
}

/**
 * Configure cache fallback behavior
 */
export function configureFallback(config: Partial<CacheFallbackConfig>): void {
  Object.assign(DEFAULT_CONFIG, config);
  logger.info('Cache fallback configuration updated', { config: DEFAULT_CONFIG });
}

// Periodic cleanup of fallback cache
setInterval(() => {
  cleanupFallbackCache();
}, 60000); // Every minute

export default {
  getWithFallback,
  setWithFallback,
  deleteWithFallback,
  deletePatternWithFallback,
  existsWithFallback,
  incrWithFallback,
  getCacheStats,
  clearFallbackCache,
  configureFallback,
};
