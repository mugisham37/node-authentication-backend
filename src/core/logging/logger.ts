import winston from 'winston';
import { randomUUID } from 'crypto';

// Correlation ID storage using AsyncLocalStorage
import { AsyncLocalStorage } from 'async_hooks';

export const correlationIdStorage = new AsyncLocalStorage<string>();

// Custom format for adding correlation ID
const correlationIdFormat = winston.format((info) => {
  const correlationId = correlationIdStorage.getStore();
  if (correlationId) {
    info['correlationId'] = correlationId;
  }
  return info;
});

// Create Winston logger with JSON formatting
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
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
          const corrId = correlationId ? `[${correlationId}]` : '';
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} ${level} ${corrId}: ${message} ${metaStr}`;
        })
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/application/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Generate correlation ID
export function generateCorrelationId(): string {
  return randomUUID();
}

// Run function with correlation ID context
export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}

// Run async function with correlation ID context
export async function withCorrelationIdAsync<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return correlationIdStorage.run(correlationId, fn);
}

// Structured logging utilities
export const log = {
  info: (message: string, meta?: Record<string, any>) => {
    logger.info(message, meta);
  },

  error: (message: string, error?: Error | unknown, meta?: Record<string, any>) => {
    const errorMeta =
      error instanceof Error
        ? {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            ...meta,
          }
        : { error, ...meta };

    logger.error(message, errorMeta);
  },

  warn: (message: string, meta?: Record<string, any>) => {
    logger.warn(message, meta);
  },

  debug: (message: string, meta?: Record<string, any>) => {
    logger.debug(message, meta);
  },

  // Security-specific logging
  security: (action: string, meta?: Record<string, any>) => {
    logger.info(`Security: ${action}`, {
      ...meta,
      category: 'security',
    });
  },

  // Audit logging
  audit: (action: string, userId: string, meta?: Record<string, unknown>) => {
    logger.info(`Audit: ${action}`, {
      ...meta,
      userId,
      category: 'audit',
    });
  },
};

export default logger;
