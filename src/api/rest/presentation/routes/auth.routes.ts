import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IAuthenticationService } from '../../../../application/services/authentication.service.js';
import {
  validateRequest,
  registerBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
  verifyEmailBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} from '../middleware/validation.middleware.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../middleware/authentication.middleware.js';
import {
  registrationRateLimiter,
  authenticationRateLimiter,
  passwordResetRateLimiter,
} from '../middleware/rate-limit.middleware.js';
import {
  registerRequestSchema,
  registerResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  mfaChallengeResponseSchema,
  refreshTokenRequestSchema,
  refreshTokenResponseSchema,
  verifyEmailRequestSchema,
  messageResponseSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  currentUserResponseSchema,
  errorResponseSchema,
  unauthorizedResponseSchema,
  rateLimitResponseSchema,
  authenticationTag,
  bearerAuthSecurity,
} from '../schemas/openapi-schemas.js';

/**
 * Register authentication routes
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = container.resolve<IAuthenticationService>('authenticationService');

  /**
   * POST /api/v1/auth/register
   * Register a new user account
   */
  app.post(
    '/api/v1/auth/register',
    {
      schema: {
        description: 'Register a new user account with email and password',
        tags: authenticationTag,
        body: registerRequestSchema,
        response: {
          201: registerResponseSchema,
          400: errorResponseSchema,
          409: {
            ...errorResponseSchema,
            description: 'Conflict - Email already registered',
          },
          429: rateLimitResponseSchema,
        },
      },
      preHandler: [registrationRateLimiter, validateRequest({ body: registerBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password, name, image } = request.body as {
        email: string;
        password: string;
        name: string;
        image?: string;
      };

      const result = await authService.register({
        email,
        password,
        name,
        image,
      });

      return reply.status(201).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.image,
          emailVerified: result.user.emailVerified,
          createdAt: result.user.createdAt,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
  );

  /**
   * POST /api/v1/auth/login
   * Login with email and password
   */
  app.post(
    '/api/v1/auth/login',
    {
      schema: {
        description:
          'Authenticate with email and password. Returns MFA challenge if MFA is enabled.',
        tags: authenticationTag,
        body: loginRequestSchema,
        response: {
          200: {
            description: 'Successful login or MFA challenge',
            oneOf: [loginResponseSchema, mfaChallengeResponseSchema],
          },
          401: unauthorizedResponseSchema,
          429: rateLimitResponseSchema,
        },
      },
      preHandler: [authenticationRateLimiter, validateRequest({ body: loginBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const result = await authService.login({
        email,
        password,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || '',
      });

      // If MFA is enabled, return challenge instead of tokens
      if ('challengeId' in result) {
        return reply.status(200).send({
          mfaRequired: true,
          challengeId: result.challengeId,
        });
      }

      return reply.status(200).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.image,
          emailVerified: result.user.emailVerified,
          mfaEnabled: result.user.mfaEnabled,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        session: {
          id: result.session.id,
          deviceName: result.session.deviceName,
          trustScore: result.session.trustScore,
        },
      });
    }
  );

  /**
   * POST /api/v1/auth/logout
   * Logout current session
   */
  app.post(
    '/api/v1/auth/logout',
    {
      schema: {
        description: 'Logout and terminate current session',
        tags: authenticationTag,
        security: bearerAuthSecurity,
        response: {
          200: messageResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const sessionId = authRequest.user.sessionId;

      if (sessionId) {
        await authService.logout(sessionId);
      }

      return reply.status(200).send({
        message: 'Logged out successfully',
      });
    }
  );

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   */
  app.post(
    '/api/v1/auth/refresh',
    {
      schema: {
        description:
          'Obtain new access token using refresh token. Old refresh token is invalidated.',
        tags: authenticationTag,
        body: refreshTokenRequestSchema,
        response: {
          200: refreshTokenResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
      preHandler: [validateRequest({ body: refreshTokenBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { refreshToken } = request.body as { refreshToken: string };

      const result = await authService.refreshTokens(refreshToken);

      return reply.status(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
  );

  /**
   * POST /api/v1/auth/verify-email
   * Verify email address with token
   */
  app.post(
    '/api/v1/auth/verify-email',
    {
      schema: {
        description: 'Verify email address using token from verification email',
        tags: authenticationTag,
        body: verifyEmailRequestSchema,
        response: {
          200: messageResponseSchema,
          400: errorResponseSchema,
        },
      },
      preHandler: [validateRequest({ body: verifyEmailBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.body as { token: string };

      await authService.verifyEmail(token);

      return reply.status(200).send({
        message: 'Email verified successfully',
      });
    }
  );

  /**
   * POST /api/v1/auth/password/forgot
   * Request password reset
   */
  app.post(
    '/api/v1/auth/password/forgot',
    {
      schema: {
        description:
          'Request password reset email. Always returns success to prevent email enumeration.',
        tags: authenticationTag,
        body: forgotPasswordRequestSchema,
        response: {
          200: messageResponseSchema,
          429: rateLimitResponseSchema,
        },
      },
      preHandler: [passwordResetRateLimiter, validateRequest({ body: forgotPasswordBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.body as { email: string };

      await authService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      return reply.status(200).send({
        message: 'If the email exists, a password reset link has been sent',
      });
    }
  );

  /**
   * POST /api/v1/auth/password/reset
   * Reset password with token
   */
  app.post(
    '/api/v1/auth/password/reset',
    {
      schema: {
        description:
          'Reset password using token from reset email. Terminates all sessions except current.',
        tags: authenticationTag,
        body: resetPasswordRequestSchema,
        response: {
          200: messageResponseSchema,
          400: errorResponseSchema,
          429: rateLimitResponseSchema,
        },
      },
      preHandler: [passwordResetRateLimiter, validateRequest({ body: resetPasswordBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token, password } = request.body as {
        token: string;
        password: string;
      };

      await authService.resetPassword(token, password);

      return reply.status(200).send({
        message: 'Password reset successfully',
      });
    }
  );

  /**
   * GET /api/v1/auth/me
   * Get current user profile
   */
  app.get(
    '/api/v1/auth/me',
    {
      schema: {
        description: 'Get current authenticated user profile',
        tags: authenticationTag,
        security: bearerAuthSecurity,
        response: {
          200: currentUserResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const userId = authRequest.user.userId;

      // Get user from service or repository
      // For now, return the user from token
      return reply.status(200).send({
        user: {
          id: userId,
          email: authRequest.user.email,
          roles: authRequest.user.roles || [],
        },
      });
    }
  );
}
