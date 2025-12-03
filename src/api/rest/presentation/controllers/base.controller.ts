import { FastifyReply } from 'fastify';

/**
 * Base controller with common methods for all controllers
 */
export abstract class BaseController {
  /**
   * Send success response
   */
  protected success<T>(reply: FastifyReply, data: T, statusCode: number = 200): FastifyReply {
    return reply.status(statusCode).send(data);
  }

  /**
   * Send created response
   */
  protected created<T>(reply: FastifyReply, data: T): FastifyReply {
    return reply.status(201).send(data);
  }

  /**
   * Send no content response
   */
  protected noContent(reply: FastifyReply): FastifyReply {
    return reply.status(204).send();
  }

  /**
   * Send error response
   */
  protected error(reply: FastifyReply, message: string, statusCode: number = 400): FastifyReply {
    return reply.status(statusCode).send({
      error: message,
      statusCode,
    });
  }

  /**
   * Send unauthorized response
   */
  protected unauthorized(reply: FastifyReply, message: string = 'Unauthorized'): FastifyReply {
    return reply.status(401).send({
      error: message,
      statusCode: 401,
    });
  }

  /**
   * Send forbidden response
   */
  protected forbidden(reply: FastifyReply, message: string = 'Forbidden'): FastifyReply {
    return reply.status(403).send({
      error: message,
      statusCode: 403,
    });
  }

  /**
   * Send not found response
   */
  protected notFound(reply: FastifyReply, message: string = 'Not found'): FastifyReply {
    return reply.status(404).send({
      error: message,
      statusCode: 404,
    });
  }

  /**
   * Send conflict response
   */
  protected conflict(reply: FastifyReply, message: string): FastifyReply {
    return reply.status(409).send({
      error: message,
      statusCode: 409,
    });
  }

  /**
   * Send validation error response
   */
  protected validationError(reply: FastifyReply, errors: unknown): FastifyReply {
    return reply.status(400).send({
      error: 'Validation failed',
      statusCode: 400,
      details: errors,
    });
  }
}
