import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { ISessionService } from '../../../../application/services/session.service.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register session management routes
 */
// eslint-disable-next-line max-lines-per-function
export function sessionRoutes(app: FastifyInstance): void {
  const sessionService = container.resolve<ISessionService>('sessionService');

  /**
   * GET /api/v1/sessions
   * List user sessions
   */
  app.get(
    '/api/v1/sessions',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      const result = await sessionService.listUserSessions(authRequest.user.userId);

      return reply.status(200).send({
        sessions: result.sessions.map((session) => ({
          id: session.id,
          deviceName: session.deviceName,
          ipAddress: session.ipAddress,
          location: session.location,
          isTrusted: session.isTrusted,
          trustScore: session.trustScore,
          lastActivityAt: session.lastActivityAt,
          createdAt: session.createdAt,
          isCurrent: session.id === authRequest.user.sessionId,
        })),
        total: result.total,
      });
    }
  );

  /**
   * DELETE /api/v1/sessions/:id
   * Revoke specific session
   */
  app.delete(
    '/api/v1/sessions/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      await sessionService.revokeSession(id, authRequest.user.userId);

      return reply.status(200).send({
        message: 'Session revoked successfully',
      });
    }
  );

  /**
   * DELETE /api/v1/sessions
   * Revoke all sessions except current
   */
  app.delete(
    '/api/v1/sessions',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const currentSessionId = authRequest.user.sessionId;

      if (!currentSessionId) {
        return reply.status(400).send({
          error: {
            type: 'ValidationError',
            message: 'Current session ID not found',
          },
        });
      }

      await sessionService.revokeAllSessionsExceptCurrent(
        authRequest.user.userId,
        currentSessionId
      );

      return reply.status(200).send({
        message: 'All other sessions revoked successfully',
      });
    }
  );
}
