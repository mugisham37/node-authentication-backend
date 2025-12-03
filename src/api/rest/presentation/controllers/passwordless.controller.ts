import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IPasswordlessService } from '../../application/services/passwordless.service.js';
import {
  validateRequest,
  emailSchema,
} from '../../../../shared/middleware/validation.middleware.js';
import { z } from 'zod';

/**
 * Register passwordless authentication routes
 */
export async function passwordlessRoutes(app: FastifyInstance): Promise<void> {
  const passwordlessService = container.resolve<IPasswordlessService>('passwordlessService');

  /**
   * POST /api/v1/auth/magic-link
   * Request magic link for passwordless login
   */
  app.post(
    '/api/v1/auth/magic-link',
    {
      preHandler: [validateRequest({ body: z.object({ email: emailSchema }) })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.body as { email: string };

      await passwordlessService.sendMagicLink(email);

      return reply.status(200).send({
        message: 'Magic link sent to your email',
      });
    }
  );

  /**
   * GET /api/v1/auth/magic-link/verify
   * Verify magic link and create session
   */
  app.get(
    '/api/v1/auth/magic-link/verify',
    {
      preHandler: [validateRequest({ query: z.object({ token: z.string() }) })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.query as { token: string };

      const result = await passwordlessService.verifyMagicLink(token);

      return reply.status(200).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
  );

  /**
   * POST /api/v1/auth/webauthn/register
   * Register WebAuthn credential
   */
  app.post(
    '/api/v1/auth/webauthn/register',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // WebAuthn registration logic
      return reply.status(501).send({
        message: 'WebAuthn registration not yet implemented',
      });
    }
  );

  /**
   * POST /api/v1/auth/webauthn/authenticate
   * Authenticate with WebAuthn
   */
  app.post(
    '/api/v1/auth/webauthn/authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // WebAuthn authentication logic
      return reply.status(501).send({
        message: 'WebAuthn authentication not yet implemented',
      });
    }
  );
}
