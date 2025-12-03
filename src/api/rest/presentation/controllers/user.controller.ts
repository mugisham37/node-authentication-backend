import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import { IUserService } from '../../../../application/services/user.service.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';

/**
 * User controller handling user profile and account management operations
 */
export class UserController extends BaseController {
  constructor(private readonly userService: IUserService) {
    super();
  }

  /**
   * Get user profile
   */
  async getProfile(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;

    const user = await this.userService.getUserById(authRequest.user.userId);

    return this.success(reply, {
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

  /**
   * Update user profile
   */
  async updateProfile(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { name, image } = request.body as { name?: string; image?: string };

    const user = await this.userService.updateProfile(authRequest.user.userId, { name, image });

    return this.success(reply, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  }

  /**
   * Change password
   */
  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    await this.userService.changePassword(authRequest.user.userId, currentPassword, newPassword);

    return this.success(reply, {
      message: 'Password changed successfully',
    });
  }

  /**
   * Delete user account
   */
  async deleteAccount(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;

    await this.userService.deleteAccount(authRequest.user.userId);

    return this.success(reply, {
      message: 'Account deleted successfully',
    });
  }
}
