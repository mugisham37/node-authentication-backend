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
  const errorWithCode = error as { code?: string; statusCode?: number };
  const errorCode = errorWithCode.code?.toUpperCase();

  return config.retryableErrors.some((retryableError) => {
    const upperRetryable = retryableError.toUpperCase();
    return (
      errorMessage.includes(upperRetryable) ||
      errorCode === upperRetryable ||
      errorWithCode.statusCode === parseInt(retryableError, 10)
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
/**
 * Extract error details safely
 */
function getErrorDetails(error: Error): { name: string; message: string; code?: string } {
  const errorWithCode = error as Error & { code?: string };
  return {
    name: error.name,
    message: error.message,
    code: errorWithCode.code,
  };
}

/**
 * Log retry failure
 */
function logRetryFailure(
  context: string,
  attempt: number,
  totalAttempts: number,
  duration: number,
  error: Error,
  retryable: boolean
): void {
  logger.error('Operation failed after retries', {
    context,
    attempt,
    totalAttempts,
    duration,
    error: getErrorDetails(error),
    retryable,
  });
}

/**
 * Log retry attempt
 */
function logRetryAttempt(
  context: string,
  attempt: number,
  totalAttempts: number,
  delay: number,
  error: Error
): void {
  logger.warn('Operation failed, retrying', {
    context,
    attempt,
    totalAttempts,
    nextRetryIn: delay,
    error: getErrorDetails(error),
  });
}

/**
 * Execute retry callback safely
 */
function executeRetryCallback(
  callback: ((error: Error, attempt: number) => void) | undefined,
  error: Error,
  attempt: number,
  context: string
): void {
  if (!callback) {
    return;
  }

  try {
    callback(error, attempt);
  } catch (callbackError) {
    logger.error('Error in retry callback', {
      context,
      error: callbackError,
    });
  }
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

      const isLastAttempt = attempt === config.maxAttempts - 1;
      const shouldRetry = isRetryableError(lastError, config);

      if (isLastAttempt || !shouldRetry) {
        logRetryFailure(
          context,
          attempt + 1,
          config.maxAttempts,
          Date.now() - startTime,
          lastError,
          shouldRetry
        );
        throw lastError;
      }

      const delay = calculateDelay(attempt, config);
      logRetryAttempt(context, attempt + 1, config.maxAttempts, delay, lastError);
      executeRetryCallback(config.onRetry, lastError, attempt + 1, context);
      await sleep(delay);
    }
  }

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const originalMethod = descriptor.value;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const methodContext = context || `${target.constructor.name}.${String(propertyKey)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
