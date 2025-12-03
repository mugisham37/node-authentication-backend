import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IAuthenticationService } from '../../../../application/services/authentication.service.js';
import { AuthController } from '../controllers/auth.controller.js';
import {
  validateRequest,
  registerBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
  verifyEmailBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  registrationRateLimiter,
  authenticationRateLimiter,
  passwordResetRateLimiter,
} from '../../../../infrastructure/middleware/rate-limit.middleware.js';
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
  const authController = new AuthController(authService);

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
    async (request, reply) => authController.register(request, reply)
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
    async (request, reply) => authController.login(request, reply)
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
    async (request, reply) => authController.logout(request, reply)
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
    async (request, reply) => authController.refreshToken(request, reply)
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
    async (request, reply) => authController.verifyEmail(request, reply)
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
    async (request, reply) => authController.forgotPassword(request, reply)
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
    async (request, reply) => authController.resetPassword(request, reply)
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
    async (request, reply) => authController.getCurrentUser(request, reply)
  );
}
