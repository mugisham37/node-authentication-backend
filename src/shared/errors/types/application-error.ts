export class ApplicationError extends Error {
  public override readonly name: string;
  public override readonly message: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    name: string,
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = name;
    this.message = message;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication failed', details?: Record<string, unknown>) {
    super('AuthenticationError', message, 401, true, details);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, unknown>) {
    super('AuthorizationError', message, 403, true, details);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ValidationError', message, 400, true, details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super('NotFoundError', `${resource} not found`, 404, true, details);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ConflictError', message, 409, true, details);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(retryAfter: number, details?: Record<string, unknown>) {
    super('RateLimitError', 'Rate limit exceeded', 429, true, { ...details, retryAfter });
  }
}

export class ServiceUnavailableError extends ApplicationError {
  constructor(service: string, details?: Record<string, unknown>) {
    super('ServiceUnavailableError', `${service} is unavailable`, 503, true, details);
  }
}

export class InternalServerError extends ApplicationError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super('InternalServerError', message, 500, false, details);
  }
}
