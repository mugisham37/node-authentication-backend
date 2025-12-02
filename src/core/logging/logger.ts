import winston from 'winston';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export const correlationIdStorage = new AsyncLocalStorage<string>();
export const userContextStorage = new AsyncLocalStorage<{ userId?: string; email?: string }>();

const correlationIdFormat = winston.format((info) => {
  const correlationId = correlationIdStorage.getStore();
  if (correlationId) {
    info['correlationId'] = correlationId;
  }

  // Add user context if available (Requirement 22.2)
  const userContext = userContextStorage.getStore();
  if (userContext) {
    if (userContext.userId) {
      info['userId'] = userContext.userId;
    }
    if (userContext.email) {
      info['userEmail'] = userContext.email;
    }
  }

  return info;
});

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    correlationIdFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'enterprise-auth-system',
    environment: process.env['NODE_ENV'] || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const correlationId = meta['correlationId'] as string | undefined;
          const corrId = correlationId ? `[${correlationId}]` : '';
          const { correlationId: _, ...restMeta } = meta;
          const metaStr = Object.keys(restMeta).length ? JSON.stringify(restMeta) : '';
          return `${String(timestamp)} ${String(level)} ${corrId}: ${String(message)} ${metaStr}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error/error.log',
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/application/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

export function generateCorrelationId(): string {
  return randomUUID();
}

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}

export async function withCorrelationIdAsync<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return correlationIdStorage.run(correlationId, fn);
}

export function setUserContext(userId?: string, email?: string): void {
  const context = userContextStorage.getStore() || {};
  if (userId) context.userId = userId;
  if (email) context.email = email;
}

export function withUserContext<T>(userId: string, email: string, fn: () => T): T {
  return userContextStorage.run({ userId, email }, fn);
}

export async function withUserContextAsync<T>(
  userId: string,
  email: string,
  fn: () => Promise<T>
): Promise<T> {
  return userContextStorage.run({ userId, email }, fn);
}

/**
 * Sample rate tracker for high-volume logs
 * Requirement 22.2 - Implement log sampling for high-volume logs
 */
const sampleCounters = new Map<string, number>();

function shouldSample(key: string, sampleRate: number): boolean {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;

  const count = (sampleCounters.get(key) || 0) + 1;
  sampleCounters.set(key, count);

  // Reset counter periodically to prevent memory growth
  if (count > 10000) {
    sampleCounters.set(key, 0);
  }

  return count % Math.floor(1 / sampleRate) === 0;
}

export const log = {
  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
  },

  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    const errorMeta = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          ...meta,
        }
      : meta;

    logger.error(message, errorMeta);
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
  },

  security: (action: string, meta?: Record<string, unknown>) => {
    logger.info(`Security: ${action}`, {
      ...meta,
      category: 'security',
    });
  },

  audit: (action: string, userId: string, meta?: Record<string, unknown>) => {
    logger.info(`Audit: ${action}`, {
      ...meta,
      userId,
      category: 'audit',
    });
  },

  /**
   * Log with sampling for high-volume operations
   * Requirement 22.2 - Implement log sampling for high-volume logs
   * @param key - Unique key for this log type
   * @param sampleRate - Rate to sample (0.1 = 10%, 0.01 = 1%)
   * @param message - Log message
   * @param meta - Additional metadata
   */
  sampled: (
    key: string,
    sampleRate: number,
    message: string,
    meta?: Record<string, unknown>
  ) => {
    if (shouldSample(key, sampleRate)) {
      logger.info(message, { ...meta, sampled: true, sampleRate });
    }
  },
};

export default logger;
