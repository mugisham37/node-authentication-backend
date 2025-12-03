import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import {
  IAuthenticationService,
  RegisterOutput,
  LoginOutput,
} from '../../../../application/services/authentication.service.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';
import { UserSerializer } from '../../../common/serializers/user.serializer.js';

/**
 * Authentication controller handling user registration, login, logout, and password management
 */
export class AuthController extends BaseController {
  constructor(private readonly authService: IAuthenticationService) {
    super();
  }

  /**
   * Register a new user account
   */
  async register(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { email, password, name, image } = request.body as {
      email: string;
      password: string;
      name: string;
      image?: string;
    };

    const result: RegisterOutput = await this.authService.register({
      email,
      password,
      name,
      image,
    });

    return this.created(reply, {
      user: UserSerializer.toPublic(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  /**
   * Login with email and password
   */
  async login(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    const userAgent = request.headers['user-agent'] || 'Unknown';
    const deviceName = userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop';

    const result: LoginOutput = await this.authService.login({
      email,
      password,
      deviceName,
      ipAddress: request.ip,
      userAgent: userAgent,
    });

    // If MFA is enabled, return challenge instead of tokens
    if ('challengeId' in result && result.mfaChallengeId) {
      return this.success(reply, {
        mfaRequired: true,
        challengeId: result.mfaChallengeId,
      });
    }

    return this.buildLoginResponse(reply, result);
  }

  /**
   * Build login response with user and session data
   */
  private buildLoginResponse(reply: FastifyReply, result: LoginOutput): FastifyReply {
    const response: {
      user: ReturnType<typeof UserSerializer.toPublic>;
      accessToken: string;
      refreshToken: string;
      session?: { id: string; deviceName: string; trustScore: number };
    } = {
      user: UserSerializer.toPublic(result.user),
      accessToken: result.accessToken || '',
      refreshToken: result.refreshToken || '',
    };

    if (result.session) {
      response.session = {
        id: result.session.id,
        deviceName: result.session.deviceName,
        trustScore: result.session.trustScore,
      };
    }

    return this.success(reply, response);
  }

  /**
   * Logout current session
   */
  async logout(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const sessionId = authRequest.user.sessionId;

    if (sessionId) {
      await this.authService.logout(sessionId);
    }

    return this.success(reply, {
      message: 'Logged out successfully',
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { refreshToken } = request.body as { refreshToken: string };

    const tokens = await this.authService.refreshTokens(refreshToken);

    return this.success(reply, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }

  /**
   * Verify email address with token
   */
  async verifyEmail(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { token } = request.body as { token: string };

    await this.authService.verifyEmail({ token });

    return this.success(reply, {
      message: 'Email verified successfully',
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { email } = request.body as { email: string };

    await this.authService.requestPasswordReset({ email });

    // Always return success to prevent email enumeration
    return this.success(reply, {
      message: 'If the email exists, a password reset link has been sent',
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { token, password } = request.body as {
      token: string;
      password: string;
    };

    await this.authService.resetPassword({ token, newPassword: password });

    return this.success(reply, {
      message: 'Password reset successfully',
    });
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const userId = authRequest.user.userId;

    return this.success(reply, {
      user: {
        id: userId,
        email: authRequest.user.email,
        roles: authRequest.user.roles || [],
      },
    });
  }
}
