import {
  ConflictError,
  ValidationError,
  ServiceUnavailableError,
} from '../types/application-error.js';

interface DatabaseError {
  code?: string;
  constraint?: string;
  detail?: string;
  column?: string;
  message?: string;
}

/**
 * Transform database errors into application errors
 */
export function transformDatabaseError(error: unknown): Error {
  const dbError = error as DatabaseError;

  // PostgreSQL error codes
  if (dbError.code === '23505') {
    // Unique constraint violation
    return new ConflictError('Resource already exists', {
      constraint: dbError.constraint,
      detail: dbError.detail,
    });
  }

  if (dbError.code === '23503') {
    // Foreign key violation
    return new ValidationError('Invalid reference', {
      constraint: dbError.constraint,
      detail: dbError.detail,
    });
  }

  if (dbError.code === '23502') {
    // Not null violation
    return new ValidationError('Required field missing', {
      column: dbError.column,
      detail: dbError.detail,
    });
  }

  if (dbError.code === '23514') {
    // Check constraint violation
    return new ValidationError('Constraint violation', {
      constraint: dbError.constraint,
      detail: dbError.detail,
    });
  }

  // Connection errors
  if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ETIMEDOUT') {
    return new ServiceUnavailableError('Database', {
      originalError: dbError.message,
    });
  }

  // Default to service unavailable for unknown database errors
  return new ServiceUnavailableError('Database', {
    originalError: dbError.message,
    code: dbError.code,
  });
}
