import { initializePostgres, closePostgres, getPool, getDatabase } from './connections/postgres.js';
import { initializeRedis, closeRedis, getRedis } from '../cache/redis.js';
import { log } from '../logging/logger.js';

/**
 * Initialize all database and cache connections
 */
export async function initializeDatabase(): Promise<void> {
  try {
    log.info('Initializing database and cache connections...');

    // Initialize PostgreSQL with Drizzle
    await initializePostgres();

    // Initialize Redis
    await initializeRedis();

    log.info('Database and cache connections initialized successfully');
  } catch (error) {
    log.error('Failed to initialize database and cache connections', error as Error);
    throw error;
  }
}

/**
 * Close all database and cache connections
 */
export async function closeDatabase(): Promise<void> {
  try {
    log.info('Closing database and cache connections...');

    await Promise.all([closePostgres(), closeRedis()]);

    log.info('Database and cache connections closed successfully');
  } catch (error) {
    log.error('Failed to close database and cache connections', error as Error);
    throw error;
  }
}

// Export connection getters
export { getPool, getDatabase, getRedis };

// Export schemas
export * from './schema/index.js';

// Export config
export * from './config.js';

export default {
  initializeDatabase,
  closeDatabase,
  getPool,
  getDatabase,
  getRedis,
};
