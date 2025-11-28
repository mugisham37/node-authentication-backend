import { config } from 'dotenv';

config();

export const databaseConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432', 10),
  database: process.env['DB_NAME'] || 'enterprise_auth',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || 'postgres',
  ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env['DB_POOL_MAX'] || '20', 10),
  min: parseInt(process.env['DB_POOL_MIN'] || '2', 10),
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '5000', 10),
};

export const redisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  password: process.env['REDIS_PASSWORD'] || undefined,
  db: parseInt(process.env['REDIS_DB'] || '0', 10),
  keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'auth:',
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect when Redis is in readonly mode
      return true;
    }
    return false;
  },
};

export default {
  database: databaseConfig,
  redis: redisConfig,
};
