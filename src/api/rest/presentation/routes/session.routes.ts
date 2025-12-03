import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { ISessionService } from '../../../../application/services/session.service.js';
import { SessionController } from '../controllers/session.controller.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register session management routes
 */
export function sessionRoutes(app: FastifyInstance): void {
  const sessionService = container.resolve<ISessionService>('sessionService');
  const sessionController = new SessionController(sessionService);

  /**
   * GET /api/v1/sessions
   * List user sessions
   */
  app.get(
    '/api/v1/sessions',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request, reply) => sessionController.listSessions(request, reply)
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
    async (request, reply) => sessionController.revokeSession(request, reply)
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
    async (request, reply) => sessionController.revokeAllSessions(request, reply)
  );
}
