import { randomBytes, randomUUID } from 'crypto';
import speakeasy from 'speakeasy';
import { IUserRepository } from '../../domain/repositories/user.repository.interface.js';
import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import { Session } from '../../domain/entities/session.entity.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/types/application-error.js';
import * as redis from '../../infrastructure/cache/redis.js';
import { domainEventEmitter } from '../../domain/events/event-emitter.js';
import { MfaEnabledEvent, MfaDisabledEvent } from '../../domain/events/mfa-events.js';

/**
 * Input for TOTP MFA setup
 * Requirements: 4.1
 */
export interface SetupTOTPInput {
  userId: string;
}

/**
 * Output from TOTP MFA setup
 * Requirements: 4.1
 */
export interface SetupTOTPOutput {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Input for SMS MFA setup
 * Requirements: 4.2
 */
export interface SetupSMSInput {
  userId: string;
  phoneNumber: string;
}

/**
 * Output from SMS MFA setup
 * Requirements: 4.2
 */
export interface SetupSMSOutput {
  verificationCodeSent: boolean;
}

/**
 * Input for MFA verification during setup
 * Requirements: 4.3
 */
export interface VerifyMFASetupInput {
  userId: string;
  code: string;
  secret: string;
}

/**
 * Input for MFA disable
 * Requirements: 4.5, 4.6
 */
export interface DisableMFAInput {
  userId: string;
  code: string;
  lastAuthTime: Date;
}

/**
 * Input for MFA verification during login
 * Requirements: 5.1
 */
export interface VerifyMFALoginInput {
  challengeId: string;
  code: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
}

/**
 * Output from MFA verification during login
 * Requirements: 5.1
 */
export interface VerifyMFALoginOutput {
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
    mfaEnabled: boolean;
  };
}

/**
 * MFA challenge data stored in Redis
 * Requirements: 3.4, 5.1
 */
interface MFAChallenge {
  userId: string;
  expiresAt: Date;
}

/**
 * MFA Service Interface
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.4
 */
export interface IMFAService {
  /**
   * Set up TOTP MFA for a user
   * Requirements: 4.1, 4.4
   */
  setupTOTP(input: SetupTOTPInput): Promise<SetupTOTPOutput>;

  /**
   * Set up SMS MFA for a user
   * Requirements: 4.2
   */
  setupSMS(input: SetupSMSInput): Promise<SetupSMSOutput>;

  /**
   * Verify MFA setup with code
   * Requirements: 4.3, 4.4
   */
  verifyMFASetup(input: VerifyMFASetupInput): Promise<void>;

  /**
   * Disable MFA for a user
   * Requirements: 4.5, 4.6
   */
  disableMFA(input: DisableMFAInput): Promise<void>;

  /**
   * Verify MFA code during login
   * Requirements: 5.1, 5.2, 5.4, 5.5
   */
  verifyMFALogin(input: VerifyMFALoginInput): Promise<VerifyMFALoginOutput>;

  /**
   * Create MFA challenge for login
   * Requirements: 3.4, 5.1
   */
  createMFAChallenge(userId: string): Promise<string>;

  /**
   * Get MFA challenge from Redis
   * Requirements: 3.4, 5.1
   */
  getMFAChallenge(challengeId: string): Promise<MFAChallenge | null>;
}

/**
 * MFA Service Implementation
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.4
 */
export class MFAService implements IMFAService {
  private readonly MFA_CHALLENGE_TTL = 5 * 60; // 5 minutes in seconds
  private readonly RECENT_AUTH_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly BACKUP_CODE_COUNT = 10;
  private readonly TOTP_WINDOW = 1; // Allow 1 step before and after (30 seconds each)

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository
  ) {}

  /**
   * Set up TOTP MFA for a user
   * Requirements: 4.1, 4.4
   */
  async setupTOTP(input: SetupTOTPInput): Promise<SetupTOTPOutput> {
    // Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Enterprise Auth (${user.email.toString()})`,
      issuer: 'Enterprise Auth System',
    });

    // Generate backup codes (Requirement 4.4)
    const backupCodes = this.generateBackupCodes();

    // Return secret and QR code URL (Requirement 4.1)
    // Note: MFA is not enabled yet - user must verify the code first
    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url || '',
      backupCodes,
    };
  }

  /**
   * Set up SMS MFA for a user
   * Requirements: 4.2
   */
  async setupSMS(input: SetupSMSInput): Promise<SetupSMSOutput> {
    // Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // TODO: Implement SMS sending with Twilio
    // For now, we'll just return success
    // In production, this would:
    // 1. Validate phone number format (E.164)
    // 2. Generate verification code
    // 3. Send SMS via Twilio
    // 4. Store code in Redis with TTL

    return {
      verificationCodeSent: true,
    };
  }

  /**
   * Verify MFA setup with code
   * Requirements: 4.3, 4.4
   */
  async verifyMFASetup(input: VerifyMFASetupInput): Promise<void> {
    // Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Verify TOTP code (Requirement 4.3)
    const isValid = speakeasy.totp.verify({
      secret: input.secret,
      encoding: 'base32',
      token: input.code,
      window: this.TOTP_WINDOW,
    });

    if (!isValid) {
      throw new AuthenticationError('Invalid MFA code');
    }

    // Generate backup codes (Requirement 4.4)
    const backupCodes = this.generateBackupCodes();

    // Enable MFA for the user
    user.enableMFA(input.secret, backupCodes);
    await this.userRepository.update(user);

    // Emit MFA enabled event (Requirement 17.3)
    await domainEventEmitter.emit(new MfaEnabledEvent(user.id, 'totp'));
  }

  /**
   * Disable MFA for a user
   * Requirements: 4.5, 4.6
   */
  async disableMFA(input: DisableMFAInput): Promise<void> {
    // Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if user has MFA enabled
    if (!user.hasMFAEnabled()) {
      throw new ValidationError('MFA is not enabled for this user');
    }

    // Require recent authentication (Requirement 4.5)
    const timeSinceAuth = Date.now() - input.lastAuthTime.getTime();
    if (timeSinceAuth > this.RECENT_AUTH_WINDOW) {
      throw new AuthenticationError('Recent authentication required to disable MFA');
    }

    // Verify MFA code or backup code (Requirement 4.6)
    const isValidTOTP = user.mfaSecret
      ? speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: input.code,
          window: this.TOTP_WINDOW,
        })
      : false;

    const isValidBackupCode = user.useBackupCode(input.code);

    if (!isValidTOTP && !isValidBackupCode) {
      throw new AuthenticationError('Invalid MFA code or backup code');
    }

    // Disable MFA
    user.disableMFA();
    await this.userRepository.update(user);

    // Emit MFA disabled event (Requirement 17.3)
    await domainEventEmitter.emit(new MfaDisabledEvent(user.id, user.id));
  }

  /**
   * Verify MFA code during login
   * Requirements: 5.1, 5.2, 5.4, 5.5
   */
  async verifyMFALogin(input: VerifyMFALoginInput): Promise<VerifyMFALoginOutput> {
    // Validate challenge and get user
    const user = await this.validateMFAChallengeAndGetUser(input.challengeId);

    // Verify MFA code (TOTP or backup code)
    const isValid = await this.verifyMFACode(user, input.code);
    if (!isValid) {
      throw new AuthenticationError('Invalid MFA code');
    }

    // Delete challenge after successful verification
    await this.deleteMFAChallenge(input.challengeId);

    // Create session and update user
    const session = await this.createSession(user.id, input);
    user.updateLastLogin();
    await this.userRepository.update(user);

    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      user: {
        id: user.id,
        email: user.email.toString(),
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  /**
   * Validate MFA challenge and get user
   * Requirements: 5.3
   */
  private async validateMFAChallengeAndGetUser(
    challengeId: string
  ): Promise<NonNullable<Awaited<ReturnType<IUserRepository['findById']>>>> {
    const challenge = await this.getMFAChallenge(challengeId);
    if (!challenge) {
      throw new AuthenticationError('Invalid or expired MFA challenge');
    }

    if (new Date() > challenge.expiresAt) {
      await this.deleteMFAChallenge(challengeId);
      throw new AuthenticationError('MFA challenge has expired');
    }

    const user = await this.userRepository.findById(challenge.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (!user.hasMFAEnabled()) {
      throw new ValidationError('MFA is not enabled for this user');
    }

    return user;
  }

  /**
   * Verify MFA code (TOTP or backup code)
   * Requirements: 5.1, 5.2, 5.4, 5.5
   */
  private async verifyMFACode(
    user: NonNullable<Awaited<ReturnType<IUserRepository['findById']>>>,
    code: string
  ): Promise<boolean> {
    // Try TOTP first (Requirement 5.1, 5.5)
    if (user.mfaSecret) {
      const isValidTOTP = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: code,
        window: this.TOTP_WINDOW, // Requirement 5.5: 30-second time window
      });

      if (isValidTOTP) {
        return true;
      }
    }

    // Try backup code (Requirement 5.4)
    const isValidBackupCode = user.useBackupCode(code);
    if (isValidBackupCode) {
      await this.userRepository.update(user);
      return true;
    }

    return false;
  }

  /**
   * Create MFA challenge for login
   * Requirements: 3.4, 5.1
   */
  async createMFAChallenge(userId: string): Promise<string> {
    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + this.MFA_CHALLENGE_TTL * 1000);

    const challenge: MFAChallenge = {
      userId,
      expiresAt,
    };

    // Store challenge in Redis with TTL
    await redis.set(`mfa:challenge:${challengeId}`, challenge, this.MFA_CHALLENGE_TTL);

    return challengeId;
  }

  /**
   * Get MFA challenge from Redis
   * Requirements: 3.4, 5.1
   */
  async getMFAChallenge(challengeId: string): Promise<MFAChallenge | null> {
    return redis.get<MFAChallenge>(`mfa:challenge:${challengeId}`);
  }

  /**
   * Delete MFA challenge from Redis
   */
  private async deleteMFAChallenge(challengeId: string): Promise<void> {
    await redis.del(`mfa:challenge:${challengeId}`);
  }

  /**
   * Generate backup codes
   * Requirements: 4.4
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      // Generate 8-character alphanumeric code
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Helper method to create a session
   * Requirements: 5.1, 7.1, 7.4
   */
  private async createSession(
    userId: string,
    input: Pick<VerifyMFALoginInput, 'deviceName' | 'ipAddress' | 'userAgent' | 'location'>
  ): Promise<Session> {
    // Create device fingerprint and IP address value objects
    const deviceFingerprint = new DeviceFingerprint({
      userAgent: input.userAgent,
    });
    const ipAddress = new IPAddress(input.ipAddress);

    // Generate token hash (in production, this would be a hash of the refresh token)
    const tokenHash = randomUUID();

    // Create session
    const session = new Session({
      id: randomUUID(),
      userId,
      tokenHash,
      deviceFingerprint,
      deviceName: input.deviceName,
      ipAddress,
      userAgent: input.userAgent,
      location: input.location,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Calculate trust score based on previous sessions (Requirement 7.4)
    const previousSessions = await this.sessionRepository.findByUserId(userId);
    session.calculateTrustScore(previousSessions);

    // Save session
    return this.sessionRepository.create(session);
  }
}
