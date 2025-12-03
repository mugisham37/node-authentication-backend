import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IUserService } from '../../../../application/services/user.service.js';
import { UserController } from '../controllers/user.controller.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  updateProfileBodySchema,
  changePasswordBodySchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register user management routes
 */
export function userRoutes(app: FastifyInstance): void {
  const userService = container.resolve<IUserService>('userService');
  const userController = new UserController(userService);

  /**
   * GET /api/v1/users/profile
   * Get user profile
   */
  app.get(
    '/api/v1/users/profile',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request, reply) => userController.getProfile(request, reply)
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
    async (request, reply) => userController.updateProfile(request, reply)
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
    async (request, reply) => userController.changePassword(request, reply)
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
    async (request, reply) => userController.deleteAccount(request, reply)
  );
}
