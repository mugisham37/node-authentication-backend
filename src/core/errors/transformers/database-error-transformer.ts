import {
  ConflictError,
  ValidationError,
  ServiceUnavailableError,
} from '../types/application-error.js';

/**
 * Transform database errors into application errors
 */
export function transformDatabaseError(error: any): Error {
  // PostgreSQL error codes
  if (error.code === '23505') {
    // Unique constraint violation
    return new ConflictError('Resource already exists', {
      constraint: error.constraint,
      detail: error.detail,
    });
  }

  if (error.code === '23503') {
    // Foreign key violation
    return new ValidationError('Invalid reference', {
      constraint: error.constraint,
      detail: error.detail,
    });
  }

  if (error.code === '23502') {
    // Not null violation
    return new ValidationError('Required field missing', {
      column: error.column,
      detail: error.detail,
    });
  }

  if (error.code === '23514') {
    // Check constraint violation
    return new ValidationError('Constraint violation', {
      constraint: error.constraint,
      detail: error.detail,
    });
  }

  // Connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return new ServiceUnavailableError('Database', {
      originalError: error.message,
    });
  }

  // Default to service unavailable for unknown database errors
  return new ServiceUnavailableError('Database', {
    originalError: error.message,
    code: error.code,
  });
}
