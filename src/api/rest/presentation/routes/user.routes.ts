import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IUserService } from '../../../../application/services/user.service.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  updateProfileBodySchema,
  changePasswordBodySchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register user management routes
 */
// eslint-disable-next-line max-lines-per-function
export function userRoutes(app: FastifyInstance): void {
  const userService = container.resolve<IUserService>('userService');

  /**
   * GET /api/v1/users/profile
   * Get user profile
   */
  app.get(
    '/api/v1/users/profile',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      const user = await userService.getUserById(authRequest.user.userId);

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt,
        },
      });
    }
  );

  /**
   * PUT /api/v1/users/profile
   * Update user profile
   */
  app.put(
    '/api/v1/users/profile',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: updateProfileBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { name, image } = request.body as { name?: string; image?: string };

      const user = await userService.updateProfile(authRequest.user.userId, { name, image });

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
      });
    }
  );

  /**
   * POST /api/v1/users/password/change
   * Change password
   */
  app.post(
    '/api/v1/users/password/change',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: changePasswordBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      await userService.changePassword(authRequest.user.userId, currentPassword, newPassword);

      return reply.status(200).send({
        message: 'Password changed successfully',
      });
    }
  );

  /**
   * DELETE /api/v1/users/account
   * Delete user account
   */
  app.delete(
    '/api/v1/users/account',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      await userService.deleteAccount(authRequest.user.userId);

      return reply.status(200).send({
        message: 'Account deleted successfully',
      });
    }
  );
}
