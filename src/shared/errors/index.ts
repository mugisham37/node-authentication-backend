// Export all error types
export {
  ApplicationError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  InternalServerError,
} from './types/application-error.js';

// Export error handlers
export { errorHandler } from './handlers/error-handler.js';

// Export error transformers
export { transformDatabaseError } from './transformers/database-error-transformer.js';
