import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IMFAService } from '../../application/services/mfa.service.js';
import {
  validateRequest,
  setupMfaBodySchema,
  verifyMfaBodySchema,
  disableMfaBodySchema,
} from '../middleware/validation.middleware.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../middleware/authentication.middleware.js';
import { mfaVerificationRateLimiter } from '../middleware/rate-limit.middleware.js';

/**
 * Register MFA routes
 */
export async function mfaRoutes(app: FastifyInstance): Promise<void> {
  const mfaService = container.resolve<IMFAService>('mfaService');

  /**
   * POST /api/v1/auth/mfa/setup
   * Enable MFA (TOTP or SMS)
   */
  app.post(
    '/api/v1/auth/mfa/setup',
    {
      preHandler: [
        authenticationMiddleware,
        validateRequest({ body: setupMfaBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { type, phoneNumber } = request.body as {
        type: 'totp' | 'sms';
        phoneNumber?: string;
      };

      if (type === 'totp') {
        const result = await mfaService.setupTOTP(authRequest.user.userId);

        return reply.status(200).send({
          type: 'totp',
          secret: result.secret,
          qrCode: result.qrCode,
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

        await mfaService.setupSMS(authRequest.user.userId, phoneNumber);

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
      preHandler: [
        mfaVerificationRateLimiter,
        validateRequest({ body: verifyMfaBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { challengeId, code } = request.body as {
        challengeId: string;
        code: string;
      };

      const result = await mfaService.verifyMFA(challengeId, code);

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
   * POST /api/v1/auth/mfa/disable
   * Disable MFA
   */
  app.post(
    '/api/v1/auth/mfa/disable',
    {
      preHandler: [
        authenticationMiddleware,
        validateRequest({ body: disableMfaBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { code } = request.body as { code: string };

      await mfaService.disableMFA(authRequest.user.userId, code);

      return reply.status(200).send({
        message: 'MFA disabled successfully',
      });
    }
  );

  /**
   * GET /api/v1/auth/mfa/backup-codes
   * Get backup codes
   */
  app.get(
    '/api/v1/auth/mfa/backup-codes',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      const backupCodes = await mfaService.getBackupCodes(authRequest.user.userId);

      return reply.status(200).send({
        backupCodes,
      });
    }
  );
}
