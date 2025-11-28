import { randomUUID } from 'crypto';
import { Session } from '../../domain/entities/session.entity.js';
import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import { NotFoundError, AuthenticationError } from '../../core/errors/types/application-error.js';
import { log } from '../../core/logging/logger.js';

/**
 * Input for session creation
 * Requirements: 7.1, 7.4
 */
export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  deviceName: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
}

/**
 * Session output format
 * Requirements: 7.1
 */
export interface SessionOutput {
  id: string;
  deviceName: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location: string | null;
  isTrusted: boolean;
  trustScore: number;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Session list output
 * Requirements: 7.1
 */
export interface SessionListOutput {
  sessions: SessionOutput[];
  total: number;
}

/**
 * Session Service Interface
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export interface ISessionService {
  /**
   * Create a new session with metadata
   * Requirements: 7.1, 7.4
   */
  createSession(input: CreateSessionInput): Promise<Session>;

  /**
   * Get session by ID
   * Requirements: 7.1
   */
  getSession(sessionId: string): Promise<Session>;

  /**
   * List all active sessions for a user
   * Requirements: 7.1
   */
  listUserSessions(userId: string): Promise<SessionListOutput>;

  /**
   * Revoke a specific session
   * Requirements: 7.2
   */
  revokeSession(sessionId: string, userId: string): Promise<void>;

  /**
   * Revoke all sessions for a user except current
   * Requirements: 7.2
   */
  revokeAllSessionsExceptCurrent(userId: string, currentSessionId: string): Promise<void>;

  /**
   * Revoke all sessions for a user
   * Requirements: 7.2, 10.5
   */
  revokeAllSessions(userId: string): Promise<void>;

  /**
   * Update session activity
   * Requirements: 7.1
   */
  updateSessionActivity(sessionId: string): Promise<void>;

  /**
   * Calculate trust score for session
   * Requirements: 7.4, 7.6
   */
  calculateTrustScore(session: Session, previousSessions: Session[]): number;

  /**
   * Cleanup expired and inactive sessions
   * Requirements: 7.5
   */
  cleanupExpiredSessions(): Promise<number>;

  /**
   * Cleanup inactive sessions (30 days)
   * Requirements: 7.5
   */
  cleanupInactiveSessions(): Promise<number>;

  /**
   * Check if session is from new location
   * Requirements: 7.6
   */
  isNewLocation(session: Session, previousSessions: Session[]): boolean;

  /**
   * Reduce trust score for new location
   * Requirements: 7.6
   */
  reduceTrustScoreForNewLocation(sessionId: string): Promise<void>;
}

/**
 * Session Service Implementation
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export class SessionService implements ISessionService {
  private readonly SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private readonly INACTIVE_SESSION_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days (Requirement 7.5)
  private readonly NEW_LOCATION_TRUST_PENALTY = 20; // Reduce trust score by 20 points (Requirement 7.6)
  private readonly BASE_TRUST_SCORE = 50; // Starting trust score
  private readonly TRUSTED_DEVICE_BONUS = 30; // Bonus for trusted devices
  private readonly KNOWN_LOCATION_BONUS = 20; // Bonus for known locations

  constructor(private readonly sessionRepository: ISessionRepository) {}

  /**
   * Create a new session with metadata
   * Requirements: 7.1, 7.4
   */
  async createSession(input: CreateSessionInput): Promise<Session> {
    // Create value objects
    const deviceFingerprint = new DeviceFingerprint({
      userAgent: input.userAgent,
      // Additional fingerprint data would be added here in production
    });
    const ipAddress = new IPAddress(input.ipAddress);

    // Create session entity
    const session = new Session({
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      deviceFingerprint,
      deviceName: input.deviceName,
      ipAddress,
      userAgent: input.userAgent,
      location: input.location,
      expiresAt: new Date(Date.now() + this.SESSION_EXPIRY),
    });

    // Get previous sessions for trust score calculation (Requirement 7.4)
    const previousSessions = await this.sessionRepository.findByUserId(input.userId);

    // Calculate trust score
    const trustScore = this.calculateTrustScore(session, previousSessions);
    session.trustScore = trustScore;

    // Check if this is a new location (Requirement 7.6)
    if (this.isNewLocation(session, previousSessions)) {
      log.info('New location detected for session', {
        userId: input.userId,
        location: input.location,
        ipAddress: input.ipAddress,
      });
      // In production, this would trigger a security notification
    }

    // Save session
    const savedSession = await this.sessionRepository.create(session);

    log.info('Session created', {
      sessionId: savedSession.id,
      userId: input.userId,
      trustScore,
    });

    return savedSession;
  }

  /**
   * Get session by ID
   * Requirements: 7.1
   */
  async getSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Check if session is expired
    if (session.isExpired()) {
      throw new AuthenticationError('Session has expired');
    }

    // Check if session is revoked
    if (session.isRevoked()) {
      throw new AuthenticationError('Session has been revoked');
    }

    return session;
  }

  /**
   * List all active sessions for a user
   * Requirements: 7.1
   */
  async listUserSessions(userId: string): Promise<SessionListOutput> {
    const sessions = await this.sessionRepository.findByUserId(userId);

    // Filter out expired and revoked sessions
    const activeSessions = sessions.filter(
      (session) => !session.isExpired() && !session.isRevoked()
    );

    // Map to output format
    const sessionOutputs: SessionOutput[] = activeSessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceFingerprint: session.deviceFingerprint.toString(),
      ipAddress: session.ipAddress.toString(),
      userAgent: session.userAgent,
      location: session.location,
      isTrusted: session.isTrusted,
      trustScore: session.trustScore,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));

    return {
      sessions: sessionOutputs,
      total: sessionOutputs.length,
    };
  }

  /**
   * Revoke a specific session
   * Requirements: 7.2
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Verify session belongs to user
    if (session.userId !== userId) {
      throw new AuthenticationError('Session does not belong to user');
    }

    // Revoke session
    session.revoke();
    await this.sessionRepository.update(session);

    log.info('Session revoked', {
      sessionId,
      userId,
    });
  }

  /**
   * Revoke all sessions for a user except current
   * Requirements: 7.2
   */
  async revokeAllSessionsExceptCurrent(userId: string, currentSessionId: string): Promise<void> {
    const sessions = await this.sessionRepository.findByUserId(userId);

    // Revoke all sessions except current
    const sessionsToRevoke = sessions.filter(
      (session) => session.id !== currentSessionId && !session.isRevoked()
    );

    for (const session of sessionsToRevoke) {
      session.revoke();
      await this.sessionRepository.update(session);
    }

    log.info('All sessions revoked except current', {
      userId,
      currentSessionId,
      revokedCount: sessionsToRevoke.length,
    });
  }

  /**
   * Revoke all sessions for a user
   * Requirements: 7.2, 10.5
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionRepository.deleteByUserId(userId);

    log.info('All sessions revoked', {
      userId,
    });
  }

  /**
   * Update session activity
   * Requirements: 7.1
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    session.updateActivity();
    await this.sessionRepository.update(session);
  }

  /**
   * Calculate trust score for session
   * Requirements: 7.4, 7.6
   */
  calculateTrustScore(session: Session, previousSessions: Session[]): number {
    let score = this.BASE_TRUST_SCORE;

    // Check if device is recognized
    const knownDevice = previousSessions.some(
      (prev) =>
        prev.deviceFingerprint.toString() === session.deviceFingerprint.toString() &&
        !prev.isRevoked()
    );

    if (knownDevice) {
      score += this.TRUSTED_DEVICE_BONUS;
    }

    // Check if location is recognized
    if (session.location) {
      const knownLocation = previousSessions.some(
        (prev) => prev.location === session.location && !prev.isRevoked()
      );

      if (knownLocation) {
        score += this.KNOWN_LOCATION_BONUS;
      } else {
        // New location - reduce trust score (Requirement 7.6)
        score -= this.NEW_LOCATION_TRUST_PENALTY;
      }
    }

    // Check if IP address is recognized
    const knownIP = previousSessions.some(
      (prev) => prev.ipAddress.toString() === session.ipAddress.toString() && !prev.isRevoked()
    );

    if (knownIP) {
      score += 10;
    }

    // Ensure score is within bounds (0-100)
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Cleanup expired and inactive sessions
   * Requirements: 7.5
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const allSessions: Session[] = await this.sessionRepository.findAll();

      let cleanedCount = 0;

      for (const session of allSessions) {
        if (session.isExpired()) {
          await this.sessionRepository.delete(session.id);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        log.info('Expired sessions cleaned up', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to cleanup expired sessions', errorMessage);
      return 0;
    }
  }

  /**
   * Cleanup inactive sessions (30 days)
   * Requirements: 7.5
   */
  async cleanupInactiveSessions(): Promise<number> {
    try {
      const allSessions: Session[] = await this.sessionRepository.findAll();
      const now = Date.now();

      let cleanedCount = 0;

      for (const session of allSessions) {
        const inactiveDuration = now - session.lastActivityAt.getTime();

        // Check if session has been inactive for 30 days (Requirement 7.5)
        if (inactiveDuration > this.INACTIVE_SESSION_THRESHOLD) {
          session.revoke();
          await this.sessionRepository.update(session);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        log.info('Inactive sessions cleaned up', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to cleanup inactive sessions', errorMessage);
      return 0;
    }
  }

  /**
   * Check if session is from new location
   * Requirements: 7.6
   */
  isNewLocation(session: Session, previousSessions: Session[]): boolean {
    if (!session.location) {
      return false;
    }

    // Check if location has been seen before
    const knownLocation = previousSessions.some(
      (prev) => prev.location === session.location && !prev.isRevoked()
    );

    return !knownLocation;
  }

  /**
   * Reduce trust score for new location
   * Requirements: 7.6
   */
  async reduceTrustScoreForNewLocation(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    // Reduce trust score
    session.trustScore = Math.max(0, session.trustScore - this.NEW_LOCATION_TRUST_PENALTY);

    await this.sessionRepository.update(session);

    log.info('Trust score reduced for new location', {
      sessionId,
      newTrustScore: session.trustScore,
    });
  }
}
