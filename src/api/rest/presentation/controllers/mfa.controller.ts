import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import { IMFAService } from '../../../../application/services/mfa.service.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';
import { UserSerializer } from '../../../common/serializers/user.serializer.js';

/**
 * MFA controller handling multi-factor authentication setup, verification, and management
 */
export class MFAController extends BaseController {
  constructor(private readonly mfaService: IMFAService) {
    super();
  }

  /**
   * Enable MFA (TOTP or SMS)
   */
  async setupMFA(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { type, phoneNumber } = request.body as {
      type: 'totp' | 'sms';
      phoneNumber?: string;
    };

    if (type === 'totp') {
      const result = await this.mfaService.setupTOTP({ userId: authRequest.user.userId });

      return this.success(reply, {
        type: 'totp',
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
        message: 'Scan the QR code with your authenticator app and verify with a code',
      });
    } else {
      if (!phoneNumber) {
        return this.error(reply, 'Phone number is required for SMS MFA');
      }

      await this.mfaService.setupSMS({ userId: authRequest.user.userId, phoneNumber });

      return this.success(reply, {
        type: 'sms',
        phoneNumber,
        message: 'Verification code sent to your phone',
      });
    }
  }

  /**
   * Verify MFA code during login
   */
  async verifyMFA(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { challengeId, code } = request.body as {
      challengeId: string;
      code: string;
    };

    const deviceName = request.headers['user-agent'] || 'Unknown Device';
    const ipAddress = request.ip || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const result = await this.mfaService.verifyMFALogin({
      challengeId,
      code,
      deviceName,
      ipAddress,
      userAgent,
    });

    return this.success(reply, {
      user: UserSerializer.toPublic(result.user),
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt,
      },
    });
  }

  /**
   * Disable MFA
   */
  async disableMFA(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { code } = request.body as { code: string };

    await this.mfaService.disableMFA({
      userId: authRequest.user.userId,
      code,
      lastAuthTime: new Date(),
    });

    return this.success(reply, {
      message: 'MFA disabled successfully',
    });
  }

  /**
   * Get backup codes (only available during setup)
   */
  async getBackupCodes(_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    return this.error(
      reply,
      'Backup codes are only provided during MFA setup. Please disable and re-enable MFA to generate new codes.'
    );
  }
}
