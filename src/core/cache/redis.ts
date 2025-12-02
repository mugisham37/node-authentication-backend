import Redis, { Redis as RedisClient, Cluster } from 'ioredis';
import { redisConfig } from '../database/config.js';
import { log } from '../logging/logger.js';
import { cacheOperations } from '../monitoring/metrics.js';

let redis: RedisClient | Cluster | null = null;
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Initialize single Redis instance
 */
function initializeSingleRedis(): void {
  redis = new Redis(redisConfig);

  log.info('Redis connection initialized', {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db,
  });
}

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  if (redis) {
    log.warn('Redis connection already initialized');
    return;
  }

  try {
    // Check if cluster mode is enabled
    const clusterNodes = process.env['REDIS_CLUSTER_NODES'];

    if (clusterNodes && clusterNodes.length > 0) {
      // Initialize Redis Cluster
      const nodes = clusterNodes.split(',').map((node: string) => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port || '6379', 10) };
      });

      redis = new Redis.Cluster(nodes, {
        redisOptions: {
          password: redisConfig.password,
          keyPrefix: redisConfig.keyPrefix,
        },
        clusterRetryStrategy: redisConfig.retryStrategy,
      });

      log.info('Redis Cluster connection initialized', {
        nodes: nodes.length,
      });
    } else {
      initializeSingleRedis();
    }

    if (redis) {
      // Set up event listeners
      redis.on('connect', () => {
        log.info('Redis client connected');
      });

      redis.on('ready', () => {
        log.info('Redis client ready');
      });

      redis.on('error', (err: Error) => {
        log.error('Redis client error', err);
      });

      redis.on('close', () => {
        log.warn('Redis connection closed');
      });

      redis.on('reconnecting', () => {
        log.info('Redis client reconnecting');
      });

      // Test connection
      await redis.ping();
    }
  } catch (error) {
    log.error('Failed to initialize Redis connection', error as Error);
    throw error;
  }
}

/**
 * Get the Redis client instance
 */
export function getRedis(): RedisClient | Cluster {
  if (!redis) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redis;
}

/**
 * Get Redis connection configuration for BullMQ
 * Returns connection options compatible with BullMQ
 */
export function getRedisConnection(): {
  host: string;
  port: number;
  password?: string;
  db?: number;
} {
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
  };
}

/**
 * Get a value from cache
 */
export async function get<T = string>(key: string): Promise<T | null> {
  const client = getRedis();

  try {
    const value = await client.get(key);

    if (value) {
      cacheHits++;
      cacheOperations.inc({ operation: 'get', status: 'hit' });
      updateCacheHitRate();
      return JSON.parse(value) as T;
    }

    cacheMisses++;
    cacheOperations.inc({ operation: 'get', status: 'miss' });
    updateCacheHitRate();
    return null;
  } catch (error) {
    cacheOperations.inc({ operation: 'get', status: 'error' });
    log.error('Redis GET error', error as Error, { key });
    throw error;
  }
}

/**
 * Set a value in cache
 */
export async function set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const client = getRedis();

  try {
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }

    cacheOperations.inc({ operation: 'set', status: 'success' });
  } catch (error) {
    cacheOperations.inc({ operation: 'set', status: 'error' });
    log.error('Redis SET error', error as Error, { key });
    throw error;
  }
}

/**
 * Delete a value from cache
 */
export async function del(key: string): Promise<void> {
  const client = getRedis();

  try {
    await client.del(key);
    cacheOperations.inc({ operation: 'del', status: 'success' });
  } catch (error) {
    cacheOperations.inc({ operation: 'del', status: 'error' });
    log.error('Redis DEL error', error as Error, { key });
    throw error;
  }
}

/**
 * Delete multiple keys matching a pattern
 */
export async function delPattern(pattern: string): Promise<void> {
  const client = getRedis();

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    cacheOperations.inc({ operation: 'del_pattern', status: 'success' });
  } catch (error) {
    cacheOperations.inc({ operation: 'del_pattern', status: 'error' });
    log.error('Redis DEL pattern error', error as Error, { pattern });
    throw error;
  }
}

/**
 * Check if a key exists
 */
export async function exists(key: string): Promise<boolean> {
  const client = getRedis();

  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    log.error('Redis EXISTS error', error as Error, { key });
    throw error;
  }
}

/**
 * Set expiration on a key
 */
export async function expire(key: string, ttlSeconds: number): Promise<void> {
  const client = getRedis();

  try {
    await client.expire(key, ttlSeconds);
  } catch (error) {
    log.error('Redis EXPIRE error', error as Error, { key, ttlSeconds });
    throw error;
  }
}

/**
 * Increment a counter
 */
export async function incr(key: string): Promise<number> {
  const client = getRedis();

  try {
    const result = await client.incr(key);
    cacheOperations.inc({ operation: 'incr', status: 'success' });
    return result;
  } catch (error) {
    cacheOperations.inc({ operation: 'incr', status: 'error' });
    log.error('Redis INCR error', error as Error, { key });
    throw error;
  }
}

/**
 * Decrement a counter
 */
export async function decr(key: string): Promise<number> {
  const client = getRedis();

  try {
    const result = await client.decr(key);
    cacheOperations.inc({ operation: 'decr', status: 'success' });
    return result;
  } catch (error) {
    cacheOperations.inc({ operation: 'decr', status: 'error' });
    log.error('Redis DECR error', error as Error, { key });
    throw error;
  }
}

/**
 * Add item to a set
 */
export async function sadd(key: string, ...members: string[]): Promise<number> {
  const client = getRedis();

  try {
    const result = await client.sadd(key, ...members);
    cacheOperations.inc({ operation: 'sadd', status: 'success' });
    return result;
  } catch (error) {
    cacheOperations.inc({ operation: 'sadd', status: 'error' });
    log.error('Redis SADD error', error as Error, { key });
    throw error;
  }
}

/**
 * Check if item is in a set
 */
export async function sismember(key: string, member: string): Promise<boolean> {
  const client = getRedis();

  try {
    const result = await client.sismember(key, member);
    return result === 1;
  } catch (error) {
    log.error('Redis SISMEMBER error', error as Error, { key, member });
    throw error;
  }
}

/**
 * Get all members of a set
 */
export async function smembers(key: string): Promise<string[]> {
  const client = getRedis();

  try {
    return await client.smembers(key);
  } catch (error) {
    log.error('Redis SMEMBERS error', error as Error, { key });
    throw error;
  }
}

/**
 * Update cache hit rate metric
 */
function updateCacheHitRate(): void {
  const total = cacheHits + cacheMisses;
  if (total > 0) {
    const hitRate = (cacheHits / total) * 100;
    cacheOperations.inc({ operation: 'hit_rate', status: String(hitRate) });
  }
}

/**
 * Close the Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    log.info('Redis connection closed');
  }
}

export default {
  initializeRedis,
  getRedis,
  get,
  set,
  del,
  delPattern,
  exists,
  expire,
  incr,
  decr,
  sadd,
  sismember,
  smembers,
  closeRedis,
};
