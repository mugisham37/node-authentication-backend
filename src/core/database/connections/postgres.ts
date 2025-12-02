import { Pool, PoolClient } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { databaseConfig } from '../config.js';
import { log } from '../../logging/logger.js';
import { databaseConnectionPool } from '../../monitoring/metrics.js';

let pool: Pool | null = null;
let db: NodePgDatabase | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
export async function initializePostgres(): Promise<void> {
  if (pool) {
    log.warn('PostgreSQL pool already initialized');
    return;
  }

  try {
    pool = new Pool(databaseConfig);

    // Set up event listeners
    pool.on('connect', () => {
      log.info('New PostgreSQL client connected');
      updateConnectionMetrics();
    });

    pool.on('acquire', () => {
      updateConnectionMetrics();
    });

    pool.on('remove', () => {
      log.info('PostgreSQL client removed from pool');
      updateConnectionMetrics();
    });

    pool.on('error', (err) => {
      log.error('Unexpected PostgreSQL pool error', err);
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    // Initialize Drizzle ORM
    db = drizzle(pool);

    log.info('PostgreSQL connection pool initialized', {
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      maxConnections: databaseConfig.max,
    });
  } catch (error) {
    log.error('Failed to initialize PostgreSQL connection pool', error as Error);
    throw error;
  }
}

/**
 * Get the PostgreSQL pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initializePostgres() first.');
  }
  return pool;
}

/**
 * Get the Drizzle database instance
 */
export function getDatabase(): NodePgDatabase {
  if (!db) {
    throw new Error('Drizzle database not initialized. Call initializePostgres() first.');
  }
  return db;
}

/**
 * Execute a query with a client from the pool
 */
export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update connection pool metrics
 */
function updateConnectionMetrics(): void {
  if (!pool) {
    return;
  }

  databaseConnectionPool.set({ state: 'total' }, pool.totalCount);
  databaseConnectionPool.set({ state: 'idle' }, pool.idleCount);
  databaseConnectionPool.set({ state: 'waiting' }, pool.waitingCount);
}

/**
 * Check database connection health
 * Requirement: 19.4
 */
export async function checkHealth(): Promise<{
  healthy: boolean;
  latency: number;
  poolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  const startTime = Date.now();

  try {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('SELECT 1');
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
        poolStats: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      };
    } finally {
      client.release();
    }
  } catch (error) {
    log.error('Database health check failed', error as Error);
    return {
      healthy: false,
      latency: Date.now() - startTime,
      poolStats: {
        total: 0,
        idle: 0,
        waiting: 0,
      },
    };
  }
}

/**
 * Get connection pool statistics
 * Requirement: 19.4
 */
export function getPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
  max: number;
} {
  if (!pool) {
    return { total: 0, idle: 0, waiting: 0, max: 0 };
  }

  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: databaseConfig.max,
  };
}

/**
 * Close the PostgreSQL connection pool
 */
export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    log.info('PostgreSQL connection pool closed');
  }
}

export default {
  initializePostgres,
  getPool,
  getDatabase,
  query,
  transaction,
  checkHealth,
  getPoolStats,
  closePostgres,
};
