import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IPasswordlessService } from '../../../../application/services/passwordless.service.js';
import {
  validateRequest,
  emailSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';
import { z } from 'zod';

/**
 * Register passwordless authentication routes
 */
/* eslint-disable max-lines-per-function, @typescript-eslint/require-await */
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

      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      const responseUser = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      };
      const responseAccessToken = result.accessToken;
      const responseRefreshToken = result.refreshToken;
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      return reply.status(200).send({
        user: responseUser,
        accessToken: responseAccessToken,
        refreshToken: responseRefreshToken,
      });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    }
  );

  /**
   * POST /api/v1/auth/webauthn/register
   * Register WebAuthn credential
   */
  app.post(
    '/api/v1/auth/webauthn/register',
    async (_request: FastifyRequest, reply: FastifyReply) => {
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
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // WebAuthn authentication logic
      return reply.status(501).send({
        message: 'WebAuthn authentication not yet implemented',
      });
    }
  );
}
/* eslint-enable max-lines-per-function, @typescript-eslint/require-await */
