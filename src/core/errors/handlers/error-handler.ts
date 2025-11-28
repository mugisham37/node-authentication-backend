import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ApplicationError } from '../types/application-error.js';
import { log } from '../../logging/logger.js';

export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id;
  const userId = (request as any).user?.id;

  // Log error with full context
  log.error('Request error', error, {
    requestId,
    userId,
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    },
  });

  // Handle ApplicationError instances
  if (error instanceof ApplicationError) {
    // Send to monitoring system for non-operational errors
    if (!error.isOperational) {
      log.security('Non-operational error occurred', {
        requestId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
    }

    return reply.status(error.statusCode).send({
      error: {
        type: error.name,
        message: error.message,
        details: error.details,
        requestId,
      },
    });
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      error: {
        type: 'ValidationError',
        message: error.message,
        details: { validation: error.validation },
        requestId,
      },
    });
  }

  // Unknown error - hide details from client
  return reply.status(500).send({
    error: {
      type: 'InternalServerError',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
