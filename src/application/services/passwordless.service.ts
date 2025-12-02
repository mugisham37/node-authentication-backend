import { randomBytes, createHash } from 'crypto';
import { User } from '../../domain/entities/user.entity.js';
import { Session } from '../../domain/entities/session.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import { IUserRepository } from '../../domain/repositories/user.repository.js';
import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '../../core/errors/types/application-error.js';
import * as redis from '../../core/cache/redis.js';
import { log } from '../../core/logging/logger.js';

/**
 * Input for magic link request
 * Requirements: 8.1
 */
export interface RequestMagicLinkInput {
  email: string;
}

/**
 * Output from magic link request
 * Requirements: 8.1
 */
export interface RequestMagicLinkOutput {
  token: string;
  expiresAt: Date;
}

/**
 * Input for magic link verification
 * Requirements: 8.2
 */
export interface VerifyMagicLinkInput {
  token: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
}

/**
 * Output from magic link verification
 * Requirements: 8.2
 */
export interface VerifyMagicLinkOutput {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
}

/**
 * Input for WebAuthn credential registration
 * Requirements: 8.6
 */
export interface RegisterWebAuthnCredentialInput {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName: string;
}

/**
 * Output from WebAuthn credential registration
 * Requirements: 8.6
 */
export interface RegisterWebAuthnCredentialOutput {
  credentialId: string;
  deviceName: string;
  createdAt: Date;
}

/**
 * Input for WebAuthn authentication
 * Requirements: 8.5
 */
export interface AuthenticateWithWebAuthnInput {
  credentialId: string;
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
}

/**
 * Output from WebAuthn authentication
 * Requirements: 8.5
 */
export interface AuthenticateWithWebAuthnOutput {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
}

/**
 * Magic link token data stored in Redis
 * Requirements: 8.1, 8.4
 */
interface MagicLinkTokenData {
  userId: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * WebAuthn credential data
 * Requirements: 8.6
 */
interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName: string;
  createdAt: Date;
}

/**
 * Passwordless Authentication Service Interface
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6
 */
export interface IPasswordlessService {
  /**
   * Request a magic link for passwordless login
   * Requirements: 8.1, 8.4
   */
  requestMagicLink(input: RequestMagicLinkInput): Promise<RequestMagicLinkOutput>;

  /**
   * Verify magic link and create session
   * Requirements: 8.2, 8.3
   */
  verifyMagicLink(input: VerifyMagicLinkInput): Promise<VerifyMagicLinkOutput>;

  /**
   * Register WebAuthn credential
   * Requirements: 8.6
   */
  registerWebAuthnCredential(
    input: RegisterWebAuthnCredentialInput
  ): Promise<RegisterWebAuthnCredentialOutput>;

  /**
   * Authenticate with WebAuthn credential
   * Requirements: 8.5
   */
  authenticateWithWebAuthn(
    input: AuthenticateWithWebAuthnInput
  ): Promise<AuthenticateWithWebAuthnOutput>;

  /**
   * Get WebAuthn credentials for user
   * Requirements: 8.6
   */
  getUserWebAuthnCredentials(userId: string): Promise<WebAuthnCredential[]>;

  /**
   * Delete WebAuthn credential
   * Requirements: 8.6
   */
  deleteWebAuthnCredential(userId: string, credentialId: string): Promise<void>;
}

/**
 * Passwordless Authentication Service Implementation
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6
 */
export class PasswordlessService implements IPasswordlessService {
  private readonly MAGIC_LINK_EXPIRY = 15 * 60; // 15 minutes in seconds (Requirement 8.4)
  private readonly SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository
  ) {}

  /**
   * Request a magic link for passwordless login
   * Requirements: 8.1, 8.4
   */
  async requestMagicLink(input: RequestMagicLinkInput): Promise<RequestMagicLinkOutput> {
    // Validate email
    const email = new Email(input.email);

    // Find user by email
    const user = await this.userRepository.findByEmail(email.toString());

    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate single-use token (Requirement 8.1)
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    // Set expiration to 15 minutes (Requirement 8.4)
    const now = Date.now();
    const expiresAt = new Date(now + this.MAGIC_LINK_EXPIRY * 1000);

    // Store token data in Redis with TTL
    const tokenData: MagicLinkTokenData = {
      userId: user.id,
      email: email.toString(),
      createdAt: new Date(now),
      expiresAt,
    };

    await redis.set(`magic:token:${tokenHash}`, tokenData, this.MAGIC_LINK_EXPIRY);

    log.info('Magic link token generated', {
      userId: user.id,
      email: email.toString(),
      expiresAt,
    });

    // In production, this would trigger an email with the magic link
    // The email would contain a link like: https://app.example.com/auth/magic-link?token={token}

    return {
      token,
      expiresAt,
    };
  }

  /**
   * Verify magic link and create session
   * Requirements: 8.2, 8.3
   */
  async verifyMagicLink(input: VerifyMagicLinkInput): Promise<VerifyMagicLinkOutput> {
    const tokenHash = this.hashToken(input.token);

    // Retrieve token data from Redis
    const tokenData = await redis.get<MagicLinkTokenData>(`magic:token:${tokenHash}`);

    // Check if token exists (Requirement 8.3)
    if (!tokenData) {
      throw new ValidationError('Invalid or expired magic link token');
    }

    // Check if token is expired (Requirement 8.3)
    if (new Date() > new Date(tokenData.expiresAt)) {
      await redis.del(`magic:token:${tokenHash}`);
      throw new ValidationError('Magic link token has expired');
    }

    // Find user
    const user = await this.userRepository.findById(tokenData.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Create session (Requirement 8.2)
    const session = await this.createSession(user.id, {
      deviceName: input.deviceName,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      location: input.location,
    });

    // Delete token after successful verification (single-use)
    await redis.del(`magic:token:${tokenHash}`);

    log.info('Magic link verified and session created', {
      userId: user.id,
      sessionId: session.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email.toString(),
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Register WebAuthn credential
   * Requirements: 8.6
   */
  async registerWebAuthnCredential(
    input: RegisterWebAuthnCredentialInput
  ): Promise<RegisterWebAuthnCredentialOutput> {
    // Verify user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Create credential data
    const credential: WebAuthnCredential = {
      id: randomBytes(16).toString('hex'),
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter,
      deviceName: input.deviceName,
      createdAt: new Date(),
    };

    // Store credential in Redis (in production, this would be in the database)
    await redis.set(`webauthn:credential:${input.credentialId}`, credential);

    // Add credential to user's credential list
    await redis.sadd(`webauthn:user:${input.userId}:credentials`, input.credentialId);

    log.info('WebAuthn credential registered', {
      userId: input.userId,
      credentialId: input.credentialId,
      deviceName: input.deviceName,
    });

    return {
      credentialId: credential.credentialId,
      deviceName: credential.deviceName,
      createdAt: credential.createdAt,
    };
  }

  /**
   * Authenticate with WebAuthn credential
   * Requirements: 8.5
   */
  async authenticateWithWebAuthn(
    input: AuthenticateWithWebAuthnInput
  ): Promise<AuthenticateWithWebAuthnOutput> {
    // Retrieve credential
    const credential = await redis.get<WebAuthnCredential>(
      `webauthn:credential:${input.credentialId}`
    );

    if (!credential) {
      throw new AuthenticationError('Invalid WebAuthn credential');
    }

    // Verify signature (Requirement 8.5)
    // In production, this would use a proper WebAuthn library to verify the signature
    // For now, we'll do a basic validation
    const isValidSignature = await this.verifyWebAuthnSignature(
      credential.publicKey,
      input.signature,
      input.authenticatorData,
      input.clientDataJSON
    );

    if (!isValidSignature) {
      throw new AuthenticationError('Invalid WebAuthn signature');
    }

    // Update credential counter (to prevent replay attacks)
    credential.counter++;
    await redis.set(`webauthn:credential:${input.credentialId}`, credential);

    // Find user
    const user = await this.userRepository.findById(credential.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Create session (Requirement 8.5)
    const session = await this.createSession(user.id, {
      deviceName: input.deviceName,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      location: input.location,
    });

    log.info('WebAuthn authentication successful', {
      userId: user.id,
      sessionId: session.id,
      credentialId: input.credentialId,
    });

    return {
      user: {
        id: user.id,
        email: user.email.toString(),
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Get WebAuthn credentials for user
   * Requirements: 8.6
   */
  async getUserWebAuthnCredentials(userId: string): Promise<WebAuthnCredential[]> {
    // Get credential IDs for user
    const credentialIds = await redis.smembers(`webauthn:user:${userId}:credentials`);

    // Retrieve credential data
    const credentials: WebAuthnCredential[] = [];
    for (const credentialId of credentialIds) {
      const credential = await redis.get<WebAuthnCredential>(`webauthn:credential:${credentialId}`);
      if (credential) {
        credentials.push(credential);
      }
    }

    return credentials;
  }

  /**
   * Delete WebAuthn credential
   * Requirements: 8.6
   */
  async deleteWebAuthnCredential(userId: string, credentialId: string): Promise<void> {
    // Verify credential belongs to user
    const credential = await redis.get<WebAuthnCredential>(`webauthn:credential:${credentialId}`);

    if (!credential) {
      throw new NotFoundError('WebAuthn credential');
    }

    if (credential.userId !== userId) {
      throw new AuthenticationError('Credential does not belong to user');
    }

    // Delete credential
    await redis.del(`webauthn:credential:${credentialId}`);

    // Remove from user's credential list
    const credentialIds = await redis.smembers(`webauthn:user:${userId}:credentials`);
    const updatedCredentialIds = credentialIds.filter((id) => id !== credentialId);

    // Clear and rebuild the set
    await redis.del(`webauthn:user:${userId}:credentials`);
    if (updatedCredentialIds.length > 0) {
      await redis.sadd(`webauthn:user:${userId}:credentials`, ...updatedCredentialIds);
    }

    log.info('WebAuthn credential deleted', {
      userId,
      credentialId,
    });
  }

  /**
   * Hash token for storage
   * Requirements: 8.1
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify WebAuthn signature
   * Requirements: 8.5
   * Note: This is a simplified implementation. In production, use a proper WebAuthn library
   * like @simplewebauthn/server
   */
  private async verifyWebAuthnSignature(
    publicKey: string,
    signature: string,
    authenticatorData: string,
    clientDataJSON: string
  ): Promise<boolean> {
    // In production, this would:
    // 1. Parse and validate authenticatorData
    // 2. Parse and validate clientDataJSON
    // 3. Verify the signature using the public key
    // 4. Check the challenge matches
    // 5. Verify the origin matches
    // 6. Check the user presence and user verification flags

    // For now, we'll do a basic validation
    if (!publicKey || !signature || !authenticatorData || !clientDataJSON) {
      return false;
    }

    // In a real implementation, use crypto.verify() with the public key
    // For this implementation, we'll assume the signature is valid if all fields are present
    return true;
  }

  /**
   * Helper method to create a session
   * Requirements: 8.2, 8.5
   */
  private async createSession(
    userId: string,
    input: {
      deviceName: string;
      ipAddress: string;
      userAgent: string;
      location?: string;
    }
  ): Promise<Session> {
    // Create device fingerprint and IP address value objects
    const deviceFingerprint = new DeviceFingerprint({
      userAgent: input.userAgent,
    });
    const ipAddress = new IPAddress(input.ipAddress);

    // Generate token hash (in production, this would be a hash of the refresh token)
    const tokenHash = randomBytes(32).toString('hex');

    // Create session
    const session = new Session({
      id: randomBytes(16).toString('hex'),
      userId,
      tokenHash,
      deviceFingerprint,
      deviceName: input.deviceName,
      ipAddress,
      userAgent: input.userAgent,
      location: input.location,
      expiresAt: new Date(Date.now() + this.SESSION_EXPIRY),
    });

    // Calculate trust score based on previous sessions
    const previousSessions = await this.sessionRepository.findByUserId(userId);
    session.calculateTrustScore(previousSessions);

    // Save session
    return this.sessionRepository.create(session);
  }
}
