import { JwtService, TokenPair } from '../../../../shared/security/tokens/jwt.service.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Token Service
 * High-level service for managing authentication tokens
 * Uses centralized JwtService for token operations
 * Requirements: 3.7, 7.1, 7.2
 */
export interface ITokenService {
  /**
   * Generate access and refresh tokens for a user session
   */
  generateTokens(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    sessionId: string
  ): TokenPair;

  /**
   * Verify access token and return payload
   */
  verifyAccessToken(token: string): {
    userId: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    sessionId?: string;
  };

  /**
   * Verify refresh token and return payload
   */
  verifyRefreshToken(token: string): {
    userId: string;
    sessionId: string;
  };

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(
    refreshToken: string,
    roles: string[],
    permissions: string[]
  ): { accessToken: string; expiresIn: number };

  /**
   * Generate email verification token
   */
  generateVerificationToken(userId: string, email: string): string;

  /**
   * Verify email verification token
   */
  verifyVerificationToken(token: string): { userId: string; email: string };

  /**
   * Generate password reset token
   */
  generateResetToken(userId: string, email: string): string;

  /**
   * Verify password reset token
   */
  verifyResetToken(token: string): { userId: string; email: string };
}

/**
 * Token Service Implementation
 */
export class TokenService implements ITokenService {
  /**
   * Generate access and refresh tokens for a user session
   * Requirements: 3.7, 7.1
   */
  generateTokens(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    sessionId: string
  ): TokenPair {
    try {
      const tokens = JwtService.generateTokenPair(userId, email, roles, permissions, sessionId);

      logger.info('Tokens generated', { userId, sessionId });

      return tokens;
    } catch (error) {
      logger.error('Failed to generate tokens', error as Error, { userId, sessionId });
      throw error;
    }
  }

  /**
   * Verify access token and return payload
   * Requirements: 7.2
   */
  verifyAccessToken(token: string): {
    userId: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    sessionId?: string;
  } {
    try {
      const payload = JwtService.verifyAccessToken(token);

      return {
        userId: payload.userId,
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
        sessionId: payload.sessionId,
      };
    } catch (error) {
      logger.error('Failed to verify access token', error as Error);
      throw error;
    }
  }

  /**
   * Verify refresh token and return payload
   * Requirements: 7.2
   */
  verifyRefreshToken(token: string): {
    userId: string;
    sessionId: string;
  } {
    try {
      const payload = JwtService.verifyRefreshToken(token);

      if (!payload.sessionId) {
        throw new Error('Invalid refresh token: missing sessionId');
      }

      return {
        userId: payload.userId,
        sessionId: payload.sessionId,
      };
    } catch (error) {
      logger.error('Failed to verify refresh token', error as Error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * Requirements: 7.2
   */
  refreshAccessToken(
    refreshToken: string,
    roles: string[],
    permissions: string[]
  ): { accessToken: string; expiresIn: number } {
    try {
      // Verify refresh token
      const payload = this.verifyRefreshToken(refreshToken);

      // Generate new access token
      const accessToken = JwtService.generateAccessToken(
        payload.userId,
        '', // Email not needed for refresh
        roles,
        permissions,
        payload.sessionId
      );

      logger.info('Access token refreshed', {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return {
        accessToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
      };
    } catch (error) {
      logger.error('Failed to refresh access token', error as Error);
      throw error;
    }
  }

  /**
   * Generate email verification token
   * Requirements: 2.1
   */
  generateVerificationToken(userId: string, email: string): string {
    try {
      const token = JwtService.generateVerificationToken(userId, email);

      logger.info('Verification token generated', { userId, email });

      return token;
    } catch (error) {
      logger.error('Failed to generate verification token', error as Error, { userId, email });
      throw error;
    }
  }

  /**
   * Verify email verification token
   * Requirements: 2.1
   */
  verifyVerificationToken(token: string): { userId: string; email: string } {
    try {
      const payload = JwtService.verifyVerificationToken(token);

      if (!payload.email) {
        throw new Error('Invalid verification token: missing email');
      }

      return {
        userId: payload.userId,
        email: payload.email,
      };
    } catch (error) {
      logger.error('Failed to verify verification token', error as Error);
      throw error;
    }
  }

  /**
   * Generate password reset token
   * Requirements: 10.1
   */
  generateResetToken(userId: string, email: string): string {
    try {
      const token = JwtService.generateResetToken(userId, email);

      logger.info('Reset token generated', { userId, email });

      return token;
    } catch (error) {
      logger.error('Failed to generate reset token', error as Error, { userId, email });
      throw error;
    }
  }

  /**
   * Verify password reset token
   * Requirements: 10.2
   */
  verifyResetToken(token: string): { userId: string; email: string } {
    try {
      const payload = JwtService.verifyResetToken(token);

      if (!payload.email) {
        throw new Error('Invalid reset token: missing email');
      }

      return {
        userId: payload.userId,
        email: payload.email,
      };
    } catch (error) {
      logger.error('Failed to verify reset token', error as Error);
      throw error;
    }
  }
}
