import { config } from 'dotenv';

config();

/**
 * PostgreSQL connection pool configuration
 * Requirement: 19.4 - Configure PostgreSQL connection pool (max 20 connections)
 */
export const databaseConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432', 10),
  database: process.env['DB_NAME'] || 'enterprise_auth',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || 'postgres',
  ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,

  // Connection pool settings (Requirement: 19.4)
  max: parseInt(process.env['DB_POOL_MAX'] || '20', 10), // Maximum 20 connections
  min: parseInt(process.env['DB_POOL_MIN'] || '2', 10), // Minimum 2 connections
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000', 10), // 30 seconds
  connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '5000', 10), // 5 seconds

  // Statement timeout to prevent long-running queries
  statement_timeout: parseInt(process.env['DB_STATEMENT_TIMEOUT'] || '30000', 10), // 30 seconds

  // Query timeout
  query_timeout: parseInt(process.env['DB_QUERY_TIMEOUT'] || '30000', 10), // 30 seconds

  // Application name for monitoring
  application_name: process.env['DB_APPLICATION_NAME'] || 'enterprise-auth-system',
};

/**
 * Redis connection pool configuration
 * Requirement: 19.4 - Configure Redis connection pool
 */
export const redisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  password: process.env['REDIS_PASSWORD'] || undefined,
  db: parseInt(process.env['REDIS_DB'] || '0', 10),
  keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'auth:',

  // Connection pool settings (Requirement: 19.4)
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 5000, // 5 seconds
  commandTimeout: 5000, // 5 seconds
  keepAlive: 30000, // 30 seconds

  // Retry strategy with exponential backoff
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },

  // Reconnect on specific errors
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect when Redis is in readonly mode
      return true;
    }
    return false;
  },

  // Lazy connect - don't connect until first command
  lazyConnect: false,

  // Auto-pipelining for better performance
  enableAutoPipelining: true,
  autoPipeliningIgnoredCommands: ['ping'],
};

export default {
  database: databaseConfig,
  redis: redisConfig,
};
