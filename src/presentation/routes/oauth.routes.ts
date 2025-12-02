import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IOAuthService } from '../../application/services/oauth.service.js';
import { authenticationMiddleware, AuthenticatedRequest } from '../middleware/authentication.middleware.js';
import { validateRequest, idParamSchema } from '../middleware/validation.middleware.js';

/**
 * Register OAuth routes
 */
export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  const oauthService = container.resolve<IOAuthService>('oauthService');

  /**
   * GET /api/v1/oauth/:provider/authorize
   * Initiate OAuth flow
   */
  app.get(
    '/api/v1/oauth/:provider/authorize',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };

      const authorizationUrl = await oauthService.getAuthorizationUrl(provider);

      return reply.redirect(authorizationUrl);
    }
  );

  /**
   * GET /api/v1/oauth/:provider/callback
   * Handle OAuth callback
   */
  app.get(
    '/api/v1/oauth/:provider/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };
      const { code, state } = request.query as { code: string; state: string };

      const result = await oauthService.handleCallback(provider, code, state);

      return reply.status(200).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.image,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      const accounts = await oauthService.getLinkedAccounts(authRequest.user.userId);

      return reply.status(200).send({
        accounts: accounts.map((account) => ({
          id: account.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          createdAt: account.createdAt,
        })),
      });
    }
  );

  /**
   * DELETE /api/v1/oauth/accounts/:id
   * Unlink OAuth account
   */
  app.delete(
    '/api/v1/oauth/accounts/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      await oauthService.unlinkAccount(authRequest.user.userId, id);

      return reply.status(200).send({
        message: 'OAuth account unlinked successfully',
      });
    }
  );
}
