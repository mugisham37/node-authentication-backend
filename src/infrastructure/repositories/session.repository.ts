import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import { Session } from '../../domain/entities/session.entity.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import * as redis from '../cache/redis.js';
import {
  ServiceUnavailableError,
  NotFoundError,
} from '../../shared/errors/types/application-error.js';

/**
 * Session Repository Implementation using Redis
 * Requirements: 3.1, 7.1, 7.2, 7.5
 */
export class SessionRepository implements ISessionRepository {
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_BY_TOKEN_PREFIX = 'session:token:';
  private readonly SESSION_BY_USER_PREFIX = 'session:user:';
  private readonly SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  /**
   * Create a new session
   * Requirement: 3.1
   */
  async create(session: Session): Promise<Session> {
    try {
      const sessionData = this.serializeSession(session);

      // Store session by ID
      await redis.set(`${this.SESSION_PREFIX}${session.id}`, sessionData, this.SESSION_TTL);

      // Store session by token hash for quick lookup
      await redis.set(
        `${this.SESSION_BY_TOKEN_PREFIX}${session.tokenHash}`,
        session.id,
        this.SESSION_TTL
      );

      // Add session ID to user's session set
      await redis.sadd(`${this.SESSION_BY_USER_PREFIX}${session.userId}`, session.id);
      await redis.expire(`${this.SESSION_BY_USER_PREFIX}${session.userId}`, this.SESSION_TTL);

      return session;
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'create',
      });
    }
  }

  /**
   * Find a session by its unique ID
   */
  async findById(id: string): Promise<Session | null> {
    try {
      const sessionData = await redis.get<SessionData>(`${this.SESSION_PREFIX}${id}`);

      if (!sessionData) {
        return null;
      }

      return this.deserializeSession(sessionData);
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'findById',
      });
    }
  }

  /**
   * Find a session by token hash
   * Requirement: 7.1
   */
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    try {
      // Get session ID from token hash
      const sessionId = await redis.get<string>(`${this.SESSION_BY_TOKEN_PREFIX}${tokenHash}`);

      if (!sessionId || typeof sessionId !== 'string') {
        return null;
      }

      // Get session data
      return this.findById(sessionId);
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'findByTokenHash',
      });
    }
  }

  /**
   * Find all sessions for a user
   * Requirement: 7.1
   */
  async findByUserId(userId: string): Promise<Session[]> {
    try {
      // Get all session IDs for the user
      const sessionIds = await redis.smembers(`${this.SESSION_BY_USER_PREFIX}${userId}`);

      if (sessionIds.length === 0) {
        return [];
      }

      // Get all session data
      const sessions: Session[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.findById(sessionId);
        if (session && !session.isRevoked()) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'findByUserId',
      });
    }
  }

  /**
   * Update an existing session
   */
  async update(session: Session): Promise<Session> {
    try {
      // Check if session exists
      const exists = await redis.exists(`${this.SESSION_PREFIX}${session.id}`);
      if (!exists) {
        throw new NotFoundError('Session');
      }

      const sessionData = this.serializeSession(session);

      // Update session data
      await redis.set(`${this.SESSION_PREFIX}${session.id}`, sessionData, this.SESSION_TTL);

      return session;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'update',
      });
    }
  }

  /**
   * Delete a session by ID
   * Requirement: 7.2
   */
  async delete(id: string): Promise<void> {
    try {
      // Get session to find token hash and user ID
      const session = await this.findById(id);

      if (!session) {
        return; // Session doesn't exist, nothing to delete
      }

      // Delete session by ID
      await redis.del(`${this.SESSION_PREFIX}${id}`);

      // Delete session by token hash
      await redis.del(`${this.SESSION_BY_TOKEN_PREFIX}${session.tokenHash}`);

      // Remove session ID from user's session set
      const userSessionKey = `${this.SESSION_BY_USER_PREFIX}${session.userId}`;
      const sessionIds = await redis.smembers(userSessionKey);
      const updatedSessionIds = sessionIds.filter((sid: string) => sid !== id);

      // Delete the set and recreate with remaining sessions
      await redis.del(userSessionKey);
      if (updatedSessionIds.length > 0) {
        await redis.sadd(userSessionKey, ...updatedSessionIds);
        await redis.expire(userSessionKey, this.SESSION_TTL);
      }
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'delete',
      });
    }
  }

  /**
   * Delete all sessions for a user
   * Requirement: 7.2
   */
  async deleteByUserId(userId: string): Promise<void> {
    try {
      // Get all session IDs for the user
      const sessionIds = await redis.smembers(`${this.SESSION_BY_USER_PREFIX}${userId}`);

      // Delete each session
      for (const sessionId of sessionIds) {
        await this.delete(sessionId);
      }

      // Delete user's session set
      await redis.del(`${this.SESSION_BY_USER_PREFIX}${userId}`);
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'deleteByUserId',
      });
    }
  }

  /**
   * Find all sessions (for cleanup operations)
   * Requirement: 7.5
   */
  async findAll(): Promise<Session[]> {
    try {
      const client = redis.getRedis();
      const keys = await client.keys(`${this.SESSION_PREFIX}*`);

      const sessions: Session[] = [];
      for (const key of keys) {
        // Skip token and user index keys
        if (key.includes(':token:') || key.includes(':user:')) {
          continue;
        }

        const sessionData = await redis.get<SessionData>(key);
        if (sessionData) {
          const session = this.deserializeSession(sessionData);
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      throw new ServiceUnavailableError('Redis', {
        originalError: (error as Error).message,
        operation: 'findAll',
      });
    }
  }

  /**
   * Serialize session to JSON
   */
  private serializeSession(session: Session): SessionData {
    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      deviceFingerprint: session.deviceFingerprint.toString(),
      deviceName: session.deviceName,
      ipAddress: session.ipAddress.toString(),
      userAgent: session.userAgent,
      location: session.location,
      isTrusted: session.isTrusted,
      trustScore: session.trustScore,
      lastActivityAt: session.lastActivityAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() || null,
    };
  }

  /**
   * Deserialize JSON to Session entity
   */
  private deserializeSession(data: SessionData): Session {
    return new Session({
      id: data.id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      deviceFingerprint: new DeviceFingerprint(data.deviceFingerprint),
      deviceName: data.deviceName,
      ipAddress: new IPAddress(data.ipAddress),
      userAgent: data.userAgent,
      location: data.location,
      isTrusted: data.isTrusted,
      trustScore: data.trustScore,
      lastActivityAt: new Date(data.lastActivityAt),
      expiresAt: new Date(data.expiresAt),
      createdAt: new Date(data.createdAt),
      revokedAt: data.revokedAt ? new Date(data.revokedAt) : null,
    });
  }
}

/**
 * Type definition for serialized session data
 */
interface SessionData {
  id: string;
  userId: string;
  tokenHash: string;
  deviceFingerprint: string;
  deviceName: string | null;
  ipAddress: string;
  userAgent: string;
  location: string | null;
  isTrusted: boolean;
  trustScore: number;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}
