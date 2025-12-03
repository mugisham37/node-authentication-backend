import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity.js';
import { Session } from '../../domain/entities/session.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { Password } from '../../domain/value-objects/password.value-object.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import { IUserRepository } from '../../domain/repositories/user.repository.interface.js';
import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import { ITokenService } from './token.service.js';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/types/application-error.js';
import { domainEventEmitter } from '../../domain/events/event-emitter.js';
import { PasswordChangedEvent } from '../../domain/events/user-events.js';
import {
  userRegistrations,
  userLogins,
  passwordResets,
  authenticationAttempts,
  authenticationDuration,
  failedLoginAttempts,
} from '../../infrastructure/monitoring/metrics.js';

/**
 * Input for user registration
 * Requirements: 1.1
 */
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  image?: string;
}

/**
 * Output from user registration
 * Requirements: 1.1, 1.6
 */
export interface RegisterOutput {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
  emailVerificationToken: string;
}

/**
 * Input for user login
 * Requirements: 3.1
 */
export interface LoginInput {
  email: string;
  password: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
}

/**
 * Output from user login
 * Requirements: 3.1, 3.4
 */
export interface LoginOutput {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
    mfaEnabled: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  session?: {
    id: string;
    expiresAt: Date;
    deviceName: string;
    trustScore: number;
  };
  mfaChallengeId?: string;
  requiresMFA: boolean;
}

/**
 * Input for email verification
 * Requirements: 2.1
 */
export interface VerifyEmailInput {
  token: string;
}

/**
 * Input for password reset request
 * Requirements: 10.1
 */
export interface RequestPasswordResetInput {
  email: string;
}

/**
 * Output from password reset request
 * Requirements: 10.1
 */
export interface RequestPasswordResetOutput {
  resetToken: string;
  expiresAt: Date;
}

/**
 * Input for password reset completion
 * Requirements: 10.2
 */
export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

/**
 * Authentication Service Interface
 * Requirements: 1.1, 1.6, 2.1, 3.1, 3.2, 10.1, 10.2
 */
export interface IAuthenticationService {
  /**
   * Register a new user
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7
   */
  register(input: RegisterInput): Promise<RegisterOutput>;

  /**
   * Login with email and password
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
   */
  login(input: LoginInput): Promise<LoginOutput>;

  /**
   * Logout and revoke session
   * Requirements: 7.3
   */
  logout(sessionId: string): Promise<void>;

  /**
   * Verify email with token
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  verifyEmail(input: VerifyEmailInput): Promise<void>;

  /**
   * Request password reset
   * Requirements: 10.1, 10.4
   */
  requestPasswordReset(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput>;

  /**
   * Reset password with token
   * Requirements: 10.2, 10.3, 10.5, 10.6
   */
  resetPassword(input: ResetPasswordInput): Promise<void>;

  /**
   * Refresh access and refresh tokens
   * Requirements: 7.2
   */
  refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }>;
}

/**
 * Token storage for email verification and password reset
 * In production, this should be stored in Redis with TTL
 */
interface TokenStore {
  emailVerificationTokens: Map<string, { userId: string; email: string; expiresAt: Date }>;
  passwordResetTokens: Map<string, { userId: string; expiresAt: Date }>;
}

/**
 * Authentication Service Implementation
 * Requirements: 1.1, 1.6, 2.1, 3.1, 3.2, 10.1, 10.2
 */
export class AuthenticationService implements IAuthenticationService {
  private tokenStore: TokenStore = {
    emailVerificationTokens: new Map(),
    passwordResetTokens: new Map(),
  };

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenService: ITokenService
  ) {}

  /**
   * Register a new user
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7
   */
  async register(input: RegisterInput): Promise<RegisterOutput> {
    // Validate and create email value object
    const email = new Email(input.email);

    // Check if email already exists (Requirement 1.2)
    const existingUser = await this.userRepository.findByEmail(email.toString());
    if (existingUser) {
      throw new ConflictError('Email already exists');
    }

    // Validate and hash password (Requirements 1.3, 1.4, 1.7)
    const password = new Password(input.password);
    const passwordHash = await password.hash();

    // Create user entity
    const user = new User({
      id: randomUUID(),
      email,
      passwordHash,
      name: input.name,
      image: input.image,
      emailVerified: false,
      accountLocked: false,
      failedLoginAttempts: 0,
    });

    // Save user to database
    const savedUser = await this.userRepository.save(user);

    // Generate email verification token (Requirement 1.6)
    const verificationToken = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.tokenStore.emailVerificationTokens.set(verificationToken, {
      userId: savedUser.id,
      email: email.toString(),
      expiresAt,
    });

    // Emit domain event
    // In production, this would be handled by an event emitter/bus
    // new UserRegisteredEvent(savedUser.id, email.toString(), savedUser.name);

    // Track business metric (Requirement 22.1)
    userRegistrations.inc({ method: 'email' });

    // Create initial session for the user
    const sessionId = randomUUID();
    
    // Generate tokens
    const tokens = this.tokenService.generateTokens(
      savedUser.id,
      savedUser.email.toString(),
      [], // roles - empty for new users
      [], // permissions - empty for new users
      sessionId
    );

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email.toString(),
        name: savedUser.name,
        image: savedUser.image,
        emailVerified: savedUser.emailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      emailVerificationToken: verificationToken,
    };
  }

  /**
   * Login with email and password
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
   */
  async login(input: LoginInput): Promise<LoginOutput> {
    const startTime = Date.now();

    try {
      // Track authentication attempt (Requirement 22.1)
      authenticationAttempts.inc({ method: 'password', status: 'started' });

      // Find and validate user
      const user = await this.validateUserCredentials(input.email, input.password);

      // Check if MFA is enabled (Requirement 3.4)
      if (user.hasMFAEnabled()) {
        authenticationAttempts.inc({ method: 'password', status: 'mfa_required' });
        return this.createMFAChallenge(user);
      }

      // Create session (Requirement 3.7)
      const session = await this.createSession(user.id, input);

      // Generate tokens
      const tokens = this.tokenService.generateTokens(
        user.id,
        user.email.toString(),
        [], // roles - should be fetched from user in production
        [], // permissions - should be fetched from user in production
        session.id
      );

      // Emit domain event
      // new UserLoggedInEvent(user.id, session.id, input.ipAddress, input.userAgent);

      // Track successful login (Requirement 22.1)
      authenticationAttempts.inc({ method: 'password', status: 'success' });
      userLogins.inc({ method: 'password', mfa_enabled: 'false' });

      return {
        user: this.mapUserToOutput(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          deviceName: session.deviceName,
          trustScore: session.trustScore,
        },
        requiresMFA: false,
      };
    } catch (error) {
      // Track failed authentication (Requirement 22.1)
      authenticationAttempts.inc({ method: 'password', status: 'failed' });
      throw error;
    } finally {
      // Track authentication duration (Requirement 22.1)
      const duration = (Date.now() - startTime) / 1000;
      authenticationDuration.observe({ method: 'password' }, duration);
    }
  }

  /**
   * Validates user credentials and handles failed attempts
   * Requirements: 3.2, 3.3, 3.5, 3.6
   */
  private async validateUserCredentials(email: string, password: string): Promise<User> {
    // Find user by email
    const emailObj = new Email(email);
    const user = await this.userRepository.findByEmail(emailObj.toString());

    // Check if user exists (Requirement 3.2)
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is locked (Requirement 3.3, 3.6)
    if (user.isAccountLocked()) {
      throw new AuthenticationError(
        'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
      );
    }

    // Verify password (Requirement 3.5)
    const passwordObj = new Password(password);
    const isValidPassword = await user.verifyPassword(passwordObj);

    if (!isValidPassword) {
      // Increment failed attempts and potentially lock account (Requirement 3.6)
      user.incrementFailedAttempts();
      await this.userRepository.update(user);

      // Track failed login attempt (Requirement 22.1)
      failedLoginAttempts.inc({ reason: 'invalid_password' });

      throw new AuthenticationError('Invalid email or password');
    }

    // Reset failed attempts on successful login
    user.resetFailedAttempts();
    user.updateLastLogin();
    await this.userRepository.update(user);

    return user;
  }

  /**
   * Creates an MFA challenge for users with MFA enabled
   * Requirements: 3.4
   * Note: This method is kept for backward compatibility but should use MFAService in production
   */
  private createMFAChallenge(user: User): LoginOutput {
    // In production, this should be handled by MFAService.createMFAChallenge()
    // For now, we'll use a simple in-memory implementation
    const challengeId = randomUUID();

    return {
      user: this.mapUserToOutput(user),
      mfaChallengeId: challengeId,
      requiresMFA: true,
    };
  }

  /**
   * Maps User entity to output format
   */
  private mapUserToOutput(user: User): LoginOutput['user'] {
    return {
      id: user.id,
      email: user.email.toString(),
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
    };
  }

  /**
   * Logout and revoke session
   * Requirements: 7.3
   */
  async logout(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    session.revoke();
    await this.sessionRepository.update(session);
  }

  /**
   * Verify email with token
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const tokenData = this.tokenStore.emailVerificationTokens.get(input.token);

    // Check if token exists (Requirement 2.3)
    if (!tokenData) {
      throw new ValidationError('Invalid verification token');
    }

    // Check if token is expired (Requirement 2.2)
    if (new Date() > tokenData.expiresAt) {
      this.tokenStore.emailVerificationTokens.delete(input.token);
      throw new ValidationError('Verification token has expired');
    }

    // Find user
    const user = await this.userRepository.findById(tokenData.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Verify email (Requirement 2.1, 2.4)
    user.verifyEmail();
    await this.userRepository.update(user);

    // Remove token after successful verification
    this.tokenStore.emailVerificationTokens.delete(input.token);

    // Emit domain event
    // new EmailVerifiedEvent(user.id, user.email.toString());
  }

  /**
   * Request password reset
   * Requirements: 10.1, 10.4
   */
  async requestPasswordReset(
    input: RequestPasswordResetInput
  ): Promise<RequestPasswordResetOutput> {
    // Always return success to prevent email enumeration (Requirement 10.1)
    const resetToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour (Requirement 10.4)

    // Try to find user
    const email = new Email(input.email);
    const user = await this.userRepository.findByEmail(email.toString());

    // Only store token if user exists
    if (user) {
      this.tokenStore.passwordResetTokens.set(resetToken, {
        userId: user.id,
        expiresAt,
      });
    }

    // Always return the same response
    return {
      resetToken,
      expiresAt,
    };
  }

  /**
   * Reset password with token
   * Requirements: 10.2, 10.3, 10.5, 10.6
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenData = this.tokenStore.passwordResetTokens.get(input.token);

    // Check if token exists (Requirement 10.3)
    if (!tokenData) {
      throw new ValidationError('Invalid reset token');
    }

    // Check if token is expired (Requirement 10.3)
    if (new Date() > tokenData.expiresAt) {
      this.tokenStore.passwordResetTokens.delete(input.token);
      throw new ValidationError('Reset token has expired');
    }

    // Find user
    const user = await this.userRepository.findById(tokenData.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Validate and hash new password (Requirement 10.2)
    const newPassword = new Password(input.newPassword);
    const newPasswordHash = await newPassword.hash();

    // Update password
    user.updatePassword(newPasswordHash);
    await this.userRepository.update(user);

    // Remove token after successful reset
    this.tokenStore.passwordResetTokens.delete(input.token);

    // Terminate all sessions except current (Requirement 10.5)
    await this.sessionRepository.deleteByUserId(user.id);

    // Emit domain event (Requirement 10.6, 17.2)
    await domainEventEmitter.emit(new PasswordChangedEvent(user.id, user.id));

    // Track password reset (Requirement 22.1)
    passwordResets.inc();
  }

  /**
   * Helper method to create a session
   * Requirements: 3.7, 7.1, 7.4
   */
  private async createSession(userId: string, input: LoginInput): Promise<Session> {
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

  /**
   * Refresh access and refresh tokens
   * Requirements: 7.2
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify the refresh token
    const payload = this.tokenService.verifyRefreshToken(refreshToken);

    // Find the session
    const session = await this.sessionRepository.findById(payload.sessionId);
    if (!session) {
      throw new AuthenticationError('Invalid session');
    }

    // Check if session is expired
    if (session.isExpired()) {
      throw new AuthenticationError('Session expired');
    }

    // Find the user
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate new tokens
    const tokens = this.tokenService.generateTokens(
      user.id,
      user.email.toString(),
      [], // roles - should be fetched from user in production
      [], // permissions - should be fetched from user in production
      session.id
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}

