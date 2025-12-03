import { logger } from '../logging/logger.js';

export interface RetryConfig {
  maxAttempts: number; // Maximum number of retry attempts
  initialDelayMs: number; // Initial delay before first retry
  maxDelayMs: number; // Maximum delay between retries
  backoffMultiplier: number; // Multiplier for exponential backoff
  retryableErrors?: string[]; // List of error codes/messages that should trigger retry
  onRetry?: (error: Error, attempt: number) => void; // Callback on each retry
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

/**
 * Default retry configuration
 * Requirement: 20.2 - Database retry with exponential backoff up to 3 attempts
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Database-specific retry configuration
 * Requirement: 20.2 - Database retry with exponential backoff up to 3 attempts
 */
export const DATABASE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    '57P01', // PostgreSQL: admin_shutdown
    '57P02', // PostgreSQL: crash_shutdown
    '57P03', // PostgreSQL: cannot_connect_now
    '08000', // PostgreSQL: connection_exception
    '08003', // PostgreSQL: connection_does_not_exist
    '08006', // PostgreSQL: connection_failure
    '08001', // PostgreSQL: sqlclient_unable_to_establish_sqlconnection
    '08004', // PostgreSQL: sqlserver_rejected_establishment_of_sqlconnection
  ],
};

/**
 * Redis-specific retry configuration
 * Requirement: 20.2 - Redis retry logic
 */
export const REDIS_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 50,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'READONLY',
    'LOADING',
    'MASTERDOWN',
    'NOREPLICAS',
  ],
};

/**
 * External service retry configuration
 * Requirement: 20.2 - External service retry
 */
export const EXTERNAL_SERVICE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'ESOCKETTIMEDOUT',
    '429', // Too Many Requests
    '500', // Internal Server Error
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504', // Gateway Timeout
  ],
};

/**
 * Calculate delay for exponential backoff with jitter
 * @param attempt Current attempt number (0-indexed)
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter (random value between 0 and 25% of delay) to prevent thundering herd
  const jitter = Math.random() * cappedDelay * 0.25;

  return Math.floor(cappedDelay + jitter);
}

/**
 * Check if an error is retryable based on configuration
 * @param error Error to check
 * @param config Retry configuration
 * @returns True if error should trigger retry
 */
function isRetryableError(error: Error, config: RetryConfig): boolean {
  if (!config.retryableErrors || config.retryableErrors.length === 0) {
    // If no specific errors configured, retry all errors
    return true;
  }

  const errorMessage = error.message.toUpperCase();
  const errorCode = (error as any).code?.toUpperCase();

  return config.retryableErrors.some((retryableError) => {
    const upperRetryable = retryableError.toUpperCase();
    return (
      errorMessage.includes(upperRetryable) ||
      errorCode === upperRetryable ||
      (error as any).statusCode === parseInt(retryableError, 10)
    );
  });
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 * Requirement: 20.2 - Implement retry with exponential backoff
 *
 * @param fn Function to execute
 * @param config Retry configuration
 * @param context Context name for logging
 * @returns Promise with the result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<T> {
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (attempt > 0) {
        logger.info('Operation succeeded after retry', {
          context,
          attempt: attempt + 1,
          totalAttempts: config.maxAttempts,
          duration: Date.now() - startTime,
        });
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Check if this is the last attempt
      const isLastAttempt = attempt === config.maxAttempts - 1;

      // Check if error is retryable
      const shouldRetry = isRetryableError(lastError, config);

      if (isLastAttempt || !shouldRetry) {
        logger.error('Operation failed after retries', {
          context,
          attempt: attempt + 1,
          totalAttempts: config.maxAttempts,
          duration: Date.now() - startTime,
          error: {
            name: lastError.name,
            message: lastError.message,
            code: (lastError as any).code,
          },
          retryable: shouldRetry,
        });
        throw lastError;
      }

      // Calculate delay for next retry
      const delay = calculateDelay(attempt, config);

      logger.warn('Operation failed, retrying', {
        context,
        attempt: attempt + 1,
        totalAttempts: config.maxAttempts,
        nextRetryIn: delay,
        error: {
          name: lastError.name,
          message: lastError.message,
          code: (lastError as any).code,
        },
      });

      // Call onRetry callback if provided
      if (config.onRetry) {
        try {
          config.onRetry(lastError, attempt + 1);
        } catch (callbackError) {
          logger.error('Error in retry callback', {
            context,
            error: callbackError,
          });
        }
      }

      // Wait before next retry
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Execute a function with retry logic and return detailed result
 * Useful for monitoring and metrics
 *
 * @param fn Function to execute
 * @param config Retry configuration
 * @param context Context name for logging
 * @returns Promise with detailed retry result
 */
export async function withRetryDetailed<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const result = await withRetry(fn, config, context);
    attempts = 1; // If successful on first try

    return {
      success: true,
      result,
      attempts,
      totalDuration: Date.now() - startTime,
    };
  } catch (error) {
    attempts = config.maxAttempts;

    return {
      success: false,
      error: error as Error,
      attempts,
      totalDuration: Date.now() - startTime,
    };
  }
}

/**
 * Create a retry wrapper for a function
 * Returns a new function that automatically retries on failure
 *
 * @param fn Function to wrap
 * @param config Retry configuration
 * @param context Context name for logging
 * @returns Wrapped function with retry logic
 */
export function createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): T {
  return (async (...args: any[]) => {
    return withRetry(() => fn(...args), config, context);
  }) as T;
}

/**
 * Retry decorator for class methods
 * Usage: @retry(config, context)
 *
 * @param config Retry configuration
 * @param context Context name for logging
 */
export function retry(
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const methodContext = context || `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), config, methodContext);
    };

    return descriptor;
  };
}

export default {
  withRetry,
  withRetryDetailed,
  createRetryWrapper,
  retry,
  DEFAULT_RETRY_CONFIG,
  DATABASE_RETRY_CONFIG,
  REDIS_RETRY_CONFIG,
  EXTERNAL_SERVICE_RETRY_CONFIG,
};
