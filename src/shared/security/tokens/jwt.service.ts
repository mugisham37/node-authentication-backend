import jwt, { JwtPayload as BaseJwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../logging/logger.js';

/**
 * JWT Payload Interface
 */
export interface JwtPayload extends BaseJwtPayload {
  userId: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  type: 'access' | 'refresh' | 'verification' | 'reset';
  sessionId?: string;
}

/**
 * Token Pair Interface
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * JWT Token Service
 * Centralized JWT token generation, validation, and rotation
 * Requirements: 3.7, 7.1, 7.2, 19.1
 */
export class JwtService {
  // Token expiration times
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
  private static readonly VERIFICATION_TOKEN_EXPIRY = '24h'; // 24 hours
  private static readonly RESET_TOKEN_EXPIRY = '1h'; // 1 hour

  /**
   * Generate access token
   * Short-lived token for API authentication
   * @param userId - User ID
   * @param email - User email
   * @param roles - User roles
   * @param permissions - User permissions
   * @param sessionId - Session ID
   * @returns string - JWT access token
   */
  static generateAccessToken(
    userId: string,
    email: string,
    roles: string[] = [],
    permissions: string[] = [],
    sessionId?: string
  ): string {
    try {
      const payload: JwtPayload = {
        userId,
        email,
        roles,
        permissions,
        type: 'access',
        sessionId,
      };

      const options: SignOptions = {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: env.JWT_ISSUER || 'enterprise-auth-system',
        audience: env.JWT_AUDIENCE || 'enterprise-auth-api',
        algorithm: 'HS256',
      };

      const token = jwt.sign(payload, env.JWT_SECRET, options);
      logger.debug('Access token generated', { userId, sessionId });

      return token;
    } catch (error) {
      logger.error('Failed to generate access token', error as Error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token
   * Long-lived token for obtaining new access tokens
   * @param userId - User ID
   * @param sessionId - Session ID
   * @returns string - JWT refresh token
   */
  static generateRefreshToken(userId: string, sessionId: string): string {
    try {
      const payload: JwtPayload = {
        userId,
        type: 'refresh',
        sessionId,
      };

      const options: SignOptions = {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: env.JWT_ISSUER || 'enterprise-auth-system',
        audience: env.JWT_AUDIENCE || 'enterprise-auth-api',
        algorithm: 'HS256',
      };

      const token = jwt.sign(payload, env.JWT_REFRESH_SECRET || env.JWT_SECRET, options);
      logger.debug('Refresh token generated', { userId, sessionId });

      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token', error as Error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param userId - User ID
   * @param email - User email
   * @param roles - User roles
   * @param permissions - User permissions
   * @param sessionId - Session ID
   * @returns TokenPair - Access and refresh tokens
   */
  static generateTokenPair(
    userId: string,
    email: string,
    roles: string[] = [],
    permissions: string[] = [],
    sessionId: string
  ): TokenPair {
    const accessToken = this.generateAccessToken(userId, email, roles, permissions, sessionId);
    const refreshToken = this.generateRefreshToken(userId, sessionId);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  /**
   * Generate email verification token
   * @param userId - User ID
   * @param email - Email to verify
   * @returns string - Verification token
   */
  static generateVerificationToken(userId: string, email: string): string {
    try {
      const payload: JwtPayload = {
        userId,
        email,
        type: 'verification',
      };

      const options: SignOptions = {
        expiresIn: this.VERIFICATION_TOKEN_EXPIRY,
        issuer: env.JWT_ISSUER || 'enterprise-auth-system',
        algorithm: 'HS256',
      };

      const token = jwt.sign(payload, env.JWT_SECRET, options);
      logger.debug('Verification token generated', { userId, email });

      return token;
    } catch (error) {
      logger.error('Failed to generate verification token', error as Error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate password reset token
   * @param userId - User ID
   * @param email - User email
   * @returns string - Reset token
   */
  static generateResetToken(userId: string, email: string): string {
    try {
      const payload: JwtPayload = {
        userId,
        email,
        type: 'reset',
      };

      const options: SignOptions = {
        expiresIn: this.RESET_TOKEN_EXPIRY,
        issuer: env.JWT_ISSUER || 'enterprise-auth-system',
        algorithm: 'HS256',
      };

      const token = jwt.sign(payload, env.JWT_SECRET, options);
      logger.debug('Reset token generated', { userId, email });

      return token;
    } catch (error) {
      logger.error('Failed to generate reset token', error as Error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify and decode access token
   * @param token - JWT token to verify
   * @returns JwtPayload - Decoded token payload
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      const options: VerifyOptions = {
        issuer: env.JWT_ISSUER || 'enterprise-auth-system',
        audience: env.JWT_AUDIENCE || 'enterprise-auth-api',
        algorithms: ['HS256'],
      };

      const payload = jwt.verify(token, env.JWT_SECRET, options) as JwtPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      logger.debug('Access token verified', { userId: payload.userId });
      return payload;
    } catch (error) {
      logger.error('Failed to verify access token', error as Error);
      throw error;
    }
  }

  /**
   * Verify and decode refresh token
   * @param token - JWT refresh token to verify
   * @returns JwtPayload - Decoded token payload
   */
  static verifyRefreshToken(token: string): JwtPayload {
    try {
      const options: VerifyOptions = {
        issuer: env.JWT_ISSUER || 'enterprise-auth-system',
        audience: env.JWT_AUDIENCE || 'enterprise-auth-api',
        algorithms: ['HS256'],
      };

      const payload = jwt.verify(
        token,
        env.JWT_REFRESH_SECRET || env.JWT_SECRET,
        options
      ) as JwtPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      logger.debug('Refresh token verified', { userId: payload.userId });
      return payload;
    } catch (error) {
      logger.error('Failed to verify refresh token', error as Error);
      throw error;
    }
  }

  /**
   * Verify verification token
   * @param token - Verification token
   * @returns JwtPayload - Decoded token payload
   */
  static verifyVerificationToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      if (payload.type !== 'verification') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.error('Failed to verify verification token', error as Error);
      throw error;
    }
  }

  /**
   * Verify reset token
   * @param token - Reset token
   * @returns JwtPayload - Decoded token payload
   */
  static verifyResetToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      if (payload.type !== 'reset') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      logger.error('Failed to verify reset token', error as Error);
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param token - JWT token
   * @returns JwtPayload | null - Decoded payload or null
   */
  static decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param token - JWT token
   * @returns boolean - True if expired
   */
  static isExpired(token: string): boolean {
    const payload = this.decode(token);
    if (!payload || !payload.exp) return true;

    return Date.now() >= payload.exp * 1000;
  }
}
