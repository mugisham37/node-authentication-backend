import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IMFAService } from '../../../../application/services/mfa.service.js';
import {
  validateRequest,
  setupMfaBodySchema,
  verifyMfaBodySchema,
  disableMfaBodySchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../../../../infrastructure/middleware/authentication.middleware.js';
import { mfaVerificationRateLimiter } from '../../../../infrastructure/middleware/rate-limit.middleware.js';

/**
 * Register MFA routes
 */
// eslint-disable-next-line max-lines-per-function
export function mfaRoutes(app: FastifyInstance): void {
  const mfaService = container.resolve<IMFAService>('mfaService');

  /**
   * POST /api/v1/auth/mfa/setup
   * Enable MFA (TOTP or SMS)
   */
  app.post(
    '/api/v1/auth/mfa/setup',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: setupMfaBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { type, phoneNumber } = request.body as {
        type: 'totp' | 'sms';
        phoneNumber?: string;
      };

      if (type === 'totp') {
        const result = await mfaService.setupTOTP({ userId: authRequest.user.userId });

        return reply.status(200).send({
          type: 'totp',
          secret: result.secret,
          qrCodeUrl: result.qrCodeUrl,
          backupCodes: result.backupCodes,
          message: 'Scan the QR code with your authenticator app and verify with a code',
        });
      } else {
        if (!phoneNumber) {
          return reply.status(400).send({
            error: {
              type: 'ValidationError',
              message: 'Phone number is required for SMS MFA',
            },
          });
        }

        await mfaService.setupSMS({ userId: authRequest.user.userId, phoneNumber });

        return reply.status(200).send({
          type: 'sms',
          phoneNumber,
          message: 'Verification code sent to your phone',
        });
      }
    }
  );

  /**
   * POST /api/v1/auth/mfa/verify
   * Verify MFA code during login
   */
  app.post(
    '/api/v1/auth/mfa/verify',
    {
      preHandler: [mfaVerificationRateLimiter, validateRequest({ body: verifyMfaBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { challengeId, code } = request.body as {
        challengeId: string;
        code: string;
      };

      // Extract device information from request
      const deviceName = request.headers['user-agent'] || 'Unknown Device';
      const ipAddress = request.ip || '127.0.0.1';
      const userAgent = request.headers['user-agent'] || 'Unknown';

      const result = await mfaService.verifyMFALogin({
        challengeId,
        code,
        deviceName,
        ipAddress,
        userAgent,
      });

      return reply.status(200).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.image,
          emailVerified: result.user.emailVerified,
          mfaEnabled: result.user.mfaEnabled,
        },
        session: {
          id: result.session.id,
          expiresAt: result.session.expiresAt,
        },
      });
    }
  );

  /**
   * POST /api/v1/auth/mfa/disable
   * Disable MFA
   */
  app.post(
    '/api/v1/auth/mfa/disable',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: disableMfaBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { code } = request.body as { code: string };

      await mfaService.disableMFA({
        userId: authRequest.user.userId,
        code,
        lastAuthTime: new Date(), // Current time as they're authenticated
      });

      return reply.status(200).send({
        message: 'MFA disabled successfully',
      });
    }
  );

  /**
   * GET /api/v1/auth/mfa/backup-codes
   * Get backup codes (returned during setup only)
   * Note: Backup codes are only provided during MFA setup for security reasons
   */
  app.get(
    '/api/v1/auth/mfa/backup-codes',
    {
      preHandler: [authenticationMiddleware],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(400).send({
        error: {
          type: 'ValidationError',
          message:
            'Backup codes are only provided during MFA setup. Please disable and re-enable MFA to generate new codes.',
        },
      });
    }
  );
}
