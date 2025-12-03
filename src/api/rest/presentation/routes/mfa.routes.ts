import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IMFAService } from '../../../../application/services/mfa.service.js';
import { MFAController } from '../controllers/mfa.controller.js';
import {
  validateRequest,
  setupMfaBodySchema,
  verifyMfaBodySchema,
  disableMfaBodySchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import { mfaVerificationRateLimiter } from '../../../../infrastructure/middleware/rate-limit.middleware.js';

/**
 * Register MFA routes
 */
export function mfaRoutes(app: FastifyInstance): void {
  const mfaService = container.resolve<IMFAService>('mfaService');
  const mfaController = new MFAController(mfaService);

  /**
   * POST /api/v1/auth/mfa/setup
   * Enable MFA (TOTP or SMS)
   */
  app.post(
    '/api/v1/auth/mfa/setup',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: setupMfaBodySchema })],
    },
    async (request, reply) => mfaController.setupMFA(request, reply)
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
    async (request, reply) => mfaController.verifyMFA(request, reply)
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
    async (request, reply) => mfaController.disableMFA(request, reply)
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
    async (request, reply) => mfaController.getBackupCodes(request, reply)
  );
}
