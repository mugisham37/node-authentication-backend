import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    memory: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Check database connectivity
 */
export async function checkDatabase(db: Pool): Promise<HealthCheck> {
  const start = Date.now();

  try {
    await db.query('SELECT 1');
    const responseTime = Date.now() - start;

    return {
      status: 'up',
      responseTime,
      details: {
        totalConnections: db.totalCount,
        idleConnections: db.idleCount,
        waitingClients: db.waitingCount,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis cache connectivity
 */
export async function checkCache(redis: Redis): Promise<HealthCheck> {
  const start = Date.now();

  try {
    await redis.ping();
    const responseTime = Date.now() - start;

    return {
      status: 'up',
      responseTime,
      details: {
        mode: redis.mode,
        connected: redis.status === 'ready',
      },
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check memory usage
 */
export function checkMemory(): HealthCheck {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  return {
    status: memoryUsagePercent < 90 ? 'up' : 'down',
    details: {
      heapUsed: Math.round(usedMemory / 1024 / 1024),
      heapTotal: Math.round(totalMemory / 1024 / 1024),
      usagePercent: Math.round(memoryUsagePercent),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(db: Pool, redis: Redis): Promise<HealthCheckResult> {
  const [databaseCheck, cacheCheck, memoryCheck] = await Promise.all([
    checkDatabase(db),
    checkCache(redis),
    Promise.resolve(checkMemory()),
  ]);

  // Determine overall status
  let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  if (databaseCheck.status === 'down' || cacheCheck.status === 'down') {
    status = 'unhealthy';
  } else if (memoryCheck.status === 'down') {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: databaseCheck,
      cache: cacheCheck,
      memory: memoryCheck,
    },
  };
}

export default {
  checkDatabase,
  checkCache,
  checkMemory,
  performHealthCheck,
};
