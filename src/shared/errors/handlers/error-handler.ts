import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ApplicationError } from '../types/application-error.js';
import { log } from '../../logging/logger.js';

interface RequestWithUser extends FastifyRequest {
  user?: { id: string };
}

function logErrorContext(
  error: Error,
  requestId: string,
  userId: string | undefined,
  request: FastifyRequest
): void {
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
}

async function handleApplicationError(
  error: ApplicationError,
  requestId: string,
  reply: FastifyReply
): Promise<void> {
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

  await reply.status(error.statusCode).send({
    error: {
      type: error.name,
      message: error.message,
      details: error.details,
      requestId,
    },
  });
}

export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id;
  const userId = (request as RequestWithUser).user?.id;

  logErrorContext(error, requestId, userId, request);

  if (error instanceof ApplicationError) {
    await handleApplicationError(error, requestId, reply);
    return;
  }

  if ('validation' in error && error.validation) {
    await reply.status(400).send({
      error: {
        type: 'ValidationError',
        message: error.message,
        details: { validation: error.validation },
        requestId,
      },
    });
    return;
  }

  await reply.status(500).send({
    error: {
      type: 'InternalServerError',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
