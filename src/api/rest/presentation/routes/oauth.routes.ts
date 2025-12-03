import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IOAuthService } from '../../../../application/services/oauth.service.js';
import { OAuthController } from '../controllers/oauth.controller.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register OAuth routes
 */
export function oauthRoutes(app: FastifyInstance): void {
  const oauthService = container.resolve<IOAuthService>('oauthService');
  const oauthController = new OAuthController(oauthService);

  /**
   * GET /api/v1/oauth/:provider/authorize
   * Initiate OAuth flow
   */
  app.get<{ Params: { provider: string } }>(
    '/api/v1/oauth/:provider/authorize',
    async (request, reply) => oauthController.authorize(request, reply)
  );

  /**
   * GET /api/v1/oauth/:provider/callback
   * Handle OAuth callback
   */
  app.get<{
    Params: { provider: string };
    Querystring: { code: string; state: string; code_verifier?: string };
  }>('/api/v1/oauth/:provider/callback', async (request, reply) =>
    oauthController.callback(request, reply)
  );

  /**
   * GET /api/v1/oauth/accounts
   * List linked OAuth accounts
   */
  app.get(
    '/api/v1/oauth/accounts',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request, reply) => oauthController.listAccounts(request, reply)
  );

  /**
   * DELETE /api/v1/oauth/accounts/:id
   * Unlink OAuth account
   */
  app.delete<{ Params: { id: string } }>(
    '/api/v1/oauth/accounts/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request, reply) => oauthController.unlinkAccount(request, reply)
  );
}
