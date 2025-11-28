import winston from 'winston';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export const correlationIdStorage = new AsyncLocalStorage<string>();

const correlationIdFormat = winston.format((info) => {
  const correlationId = correlationIdStorage.getStore();
  if (correlationId) {
    info['correlationId'] = correlationId;
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
};

export default logger;
