import { logger } from '../logging/logger.js';
import * as redis from './redis.js';
import { withRetry, REDIS_RETRY_CONFIG } from '../resilience/retry.js';

/**
 * Session Consistency Service
 * Requirement: 20.6 - Use Redis for distributed session storage and ensure session consistency across instances
 *
 * This service ensures that sessions are consistently accessible across multiple
 * application instances by using Redis as a centralized session store with
 * proper retry logic and consistency guarantees.
 */

export interface SessionConsistencyConfig {
  enableStrictConsistency: boolean; // Whether to enforce strict read-after-write consistency
  sessionLockTTL: number; // TTL for session locks in seconds
  maxLockWaitTime: number; // Maximum time to wait for a lock in milliseconds
  enableSessionReplication: boolean; // Whether to replicate sessions to backup Redis
}

const DEFAULT_CONFIG: SessionConsistencyConfig = {
  enableStrictConsistency: true,
  sessionLockTTL: 5, // 5 seconds
  maxLockWaitTime: 1000, // 1 second
  enableSessionReplication: false,
};

const SESSION_LOCK_PREFIX = 'lock:session:';
const SESSION_VERSION_PREFIX = 'version:session:';

/**
 * Acquire a distributed lock for a session
 * Requirement: 20.6 - Ensure session consistency across instances
 *
 * @param sessionId Session ID to lock
 * @param lockId Unique lock identifier
 * @param ttlSeconds Lock TTL in seconds
 * @returns True if lock acquired
 */
async function acquireLock(
  sessionId: string,
  lockId: string,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const client = redis.getRedis();
    const lockKey = `${SESSION_LOCK_PREFIX}${sessionId}`;

    // Use SET with NX (only set if not exists) and EX (expiration)
    const result = await client.set(lockKey, lockId, 'EX', ttlSeconds, 'NX');

    return result === 'OK';
  } catch (error) {
    logger.error('Failed to acquire session lock', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Release a distributed lock for a session
 * Requirement: 20.6 - Ensure session consistency across instances
 *
 * @param sessionId Session ID to unlock
 * @param lockId Unique lock identifier (must match the one used to acquire)
 */
async function releaseLock(sessionId: string, lockId: string): Promise<void> {
  try {
    const client = redis.getRedis();
    const lockKey = `${SESSION_LOCK_PREFIX}${sessionId}`;

    // Use Lua script to ensure we only delete the lock if we own it
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await client.eval(script, 1, lockKey, lockId);
  } catch (error) {
    logger.error('Failed to release session lock', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Execute a function with a distributed lock
 * Requirement: 20.6 - Ensure session consistency across instances
 *
 * @param sessionId Session ID to lock
 * @param fn Function to execute while holding the lock
 * @returns Result of the function
 */
export async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  if (!DEFAULT_CONFIG.enableStrictConsistency) {
    // If strict consistency is disabled, just execute the function
    return fn();
  }

  const lockId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();
  let lockAcquired = false;

  try {
    // Try to acquire lock with retries
    while (Date.now() - startTime < DEFAULT_CONFIG.maxLockWaitTime) {
      lockAcquired = await acquireLock(sessionId, lockId, DEFAULT_CONFIG.sessionLockTTL);

      if (lockAcquired) {
        break;
      }

      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (!lockAcquired) {
      logger.warn('Failed to acquire session lock within timeout', {
        sessionId,
        timeout: DEFAULT_CONFIG.maxLockWaitTime,
      });

      // Proceed without lock (degraded mode)
      return fn();
    }

    // Execute function while holding lock
    const result = await fn();

    return result;
  } finally {
    if (lockAcquired) {
      await releaseLock(sessionId, lockId);
    }
  }
}

/**
 * Get session with retry logic for consistency
 * Requirement: 20.6 - Maintain session consistency across instances
 *
 * @param sessionKey Redis key for the session
 * @returns Session data or null
 */
export async function getSessionWithRetry<T>(sessionKey: string): Promise<T | null> {
  return withRetry(
    async () => {
      return redis.get<T>(sessionKey);
    },
    REDIS_RETRY_CONFIG,
    `getSession:${sessionKey}`
  );
}

/**
 * Set session with retry logic for consistency
 * Requirement: 20.6 - Maintain session consistency across instances
 *
 * @param sessionKey Redis key for the session
 * @param sessionData Session data to store
 * @param ttlSeconds TTL in seconds
 */
export async function setSessionWithRetry<T>(
  sessionKey: string,
  sessionData: T,
  ttlSeconds?: number
): Promise<void> {
  return withRetry(
    async () => {
      await redis.set(sessionKey, sessionData, ttlSeconds);
    },
    REDIS_RETRY_CONFIG,
    `setSession:${sessionKey}`
  );
}

/**
 * Delete session with retry logic for consistency
 * Requirement: 20.6 - Maintain session consistency across instances
 *
 * @param sessionKey Redis key for the session
 */
export async function deleteSessionWithRetry(sessionKey: string): Promise<void> {
  return withRetry(
    async () => {
      await redis.del(sessionKey);
    },
    REDIS_RETRY_CONFIG,
    `deleteSession:${sessionKey}`
  );
}

/**
 * Increment session version for optimistic locking
 * Requirement: 20.6 - Ensure session consistency across instances
 *
 * @param sessionId Session ID
 * @returns New version number
 */
export async function incrementSessionVersion(sessionId: string): Promise<number> {
  try {
    const versionKey = `${SESSION_VERSION_PREFIX}${sessionId}`;
    const version = await redis.incr(versionKey);

    // Set expiration on version key (same as session TTL)
    await redis.expire(versionKey, 7 * 24 * 60 * 60); // 7 days

    return version;
  } catch (error) {
    logger.error('Failed to increment session version', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return 0 to indicate version tracking failed
    return 0;
  }
}

/**
 * Get session version
 * Requirement: 20.6 - Ensure session consistency across instances
 *
 * @param sessionId Session ID
 * @returns Current version number
 */
export async function getSessionVersion(sessionId: string): Promise<number> {
  try {
    const versionKey = `${SESSION_VERSION_PREFIX}${sessionId}`;
    const versionStr = await redis.get<string>(versionKey);

    return versionStr ? parseInt(versionStr, 10) : 0;
  } catch (error) {
    logger.error('Failed to get session version', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return 0;
  }
}

/**
 * Verify session consistency across instances
 * Requirement: 20.6 - Maintain session consistency across instances
 *
 * This function checks if a session can be read consistently by verifying
 * that the session data is available and not corrupted.
 *
 * @param sessionId Session ID to verify
 * @returns True if session is consistent
 */
export async function verifySessionConsistency(sessionId: string): Promise<boolean> {
  try {
    const sessionKey = `session:${sessionId}`;

    // Try to read session with retry
    const sessionData = await getSessionWithRetry(sessionKey);

    if (!sessionData) {
      return false;
    }

    // Verify session data structure
    const session = sessionData as Record<string, unknown>;
    const requiredFields = ['id', 'userId', 'tokenHash', 'expiresAt'];

    for (const field of requiredFields) {
      if (!session[field]) {
        logger.warn('Session data missing required field', {
          sessionId,
          missingField: field,
        });
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Failed to verify session consistency', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return false;
  }
}

/**
 * Replicate session to backup Redis instance
 * Requirement: 20.6 - Implement session replication
 *
 * @param sessionKey Redis key for the session
 * @param sessionData Session data to replicate
 * @param ttlSeconds TTL in seconds
 */
export async function replicateSession<T>(
  sessionKey: string,
  _sessionData: T,
  ttlSeconds?: number
): Promise<void> {
  if (!DEFAULT_CONFIG.enableSessionReplication) {
    return;
  }

  try {
    // In a production environment, this would replicate to a backup Redis instance
    // For now, we'll just log the replication attempt
    logger.debug('Session replication requested', {
      sessionKey,
      ttlSeconds,
    });

    // TODO: Implement actual replication to backup Redis instance
    // This would involve:
    // 1. Connecting to backup Redis instance
    // 2. Writing session data to backup
    // 3. Handling replication failures gracefully

    // Simulate async operation
    await Promise.resolve();
  } catch (error) {
    logger.error('Failed to replicate session', {
      sessionKey,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Don't throw - replication failure should not break the main operation
  }
}

/**
 * Batch get multiple sessions with retry logic
 * Requirement: 20.6 - Maintain session consistency across instances
 *
 * @param sessionKeys Array of Redis keys for sessions
 * @returns Array of session data (null for missing sessions)
 */
export async function batchGetSessionsWithRetry<T>(sessionKeys: string[]): Promise<(T | null)[]> {
  return withRetry(
    async () => {
      const client = redis.getRedis();
      const pipeline = client.pipeline();

      // Add all GET commands to pipeline
      for (const key of sessionKeys) {
        pipeline.get(key);
      }

      // Execute pipeline
      const results = await pipeline.exec();

      if (!results) {
        return sessionKeys.map(() => null);
      }

      // Parse results
      return results.map(([error, value]) => {
        if (error || !value) {
          return null;
        }

        try {
          return JSON.parse(value as string) as T;
        } catch {
          return null;
        }
      });
    },
    REDIS_RETRY_CONFIG,
    'batchGetSessions'
  );
}

/**
 * Configure session consistency behavior
 */
export function configureSessionConsistency(config: Partial<SessionConsistencyConfig>): void {
  Object.assign(DEFAULT_CONFIG, config);
  logger.info('Session consistency configuration updated', { config: DEFAULT_CONFIG });
}

/**
 * Get session consistency statistics
 */
export function getSessionConsistencyStats(): {
  strictConsistencyEnabled: boolean;
  sessionLockTTL: number;
  maxLockWaitTime: number;
  replicationEnabled: boolean;
} {
  return {
    strictConsistencyEnabled: DEFAULT_CONFIG.enableStrictConsistency,
    sessionLockTTL: DEFAULT_CONFIG.sessionLockTTL,
    maxLockWaitTime: DEFAULT_CONFIG.maxLockWaitTime,
    replicationEnabled: DEFAULT_CONFIG.enableSessionReplication,
  };
}

export default {
  withSessionLock,
  getSessionWithRetry,
  setSessionWithRetry,
  deleteSessionWithRetry,
  incrementSessionVersion,
  getSessionVersion,
  verifySessionConsistency,
  replicateSession,
  batchGetSessionsWithRetry,
  configureSessionConsistency,
  getSessionConsistencyStats,
};
