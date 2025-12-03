import { JwtService, TokenPair } from '../../../../shared/security/tokens/jwt.service.js';
import { logger } from '../../../../shared/logging/logger.js';

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

      logger.info('Access token refreshed', { userId: payload.userId, sessionId: payload.sessionId });

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
  verifyResetToken(token: string): { userId: string; ema
   */
  hashRefreshToken(token: string): string {
    // Use SHA-256 for hashing refresh tokens
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Refresh tokens with rotation
   * Requirements: 6.1, 6.6, 6.7
   */
  async refreshTokens(refreshToken: string, userId: string): Promise<RefreshOutput> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    // Check if token is revoked (Requirement 6.3)
    const isRevoked = await this.isRefreshTokenRevoked(tokenHash);
    if (isRevoked) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    // Detect token reuse (Requirement 6.7)
    const isReused = await this.detectTokenReuse(tokenHash);
    if (isReused) {
      // Token reuse detected - revoke entire family
      const familyData = await this.getTokenFamily(tokenHash);
      if (familyData) {
        await this.revokeTokenFamily(familyData.familyId);
        log.warn('Token reuse detected, revoking token family', {
          userId,
          familyId: familyData.familyId,
        });
      }
      throw new AuthenticationError('Token reuse detected. All sessions have been terminated.');
    }

    // Mark current token as used (for reuse detection)
    await this.markTokenAsUsed(tokenHash);

    // Revoke old refresh token (Requirement 6.6)
    await this.revokeRefreshToken(tokenHash);

    // Generate new token pair
    const newRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashRefreshToken(newRefreshToken);

    // Get family ID from old token
    const familyData = await this.getTokenFamily(tokenHash);
    const familyId = familyData?.familyId || randomBytes(16).toString('hex');

    // Track new token in same family (Requirement 6.7)
    await this.trackTokenInFamily(newTokenHash, familyId, userId);

    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + this.ACCESS_TOKEN_EXPIRY * 1000);
    const refreshTokenExpiresAt = new Date(now + this.REFRESH_TOKEN_EXPIRY * 1000);

    // Generate new access token
    // Note: We need the user object to generate access token
    // In production, this would be fetched from the repository
    const accessToken = jwt.sign(
      {
        userId,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + this.ACCESS_TOKEN_EXPIRY,
      },
      this.privateKey,
      { algorithm: 'RS256' }
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Revoke refresh token
   * Requirements: 6.3
   */
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    try {
      // Store revoked token in Redis with TTL
      await redis.set(`revoked:token:${tokenHash}`, true, this.REVOKED_TOKEN_TTL);
      log.info('Refresh token revoked', { tokenHash: tokenHash.substring(0, 8) });
    } catch (error) {
      log.error('Failed to revoke refresh token', error as Error);
      throw error;
    }
  }

  /**
   * Check if refresh token is revoked
   * Requirements: 6.3
   */
  async isRefreshTokenRevoked(tokenHash: string): Promise<boolean> {
    try {
      const revoked = await redis.get<boolean>(`revoked:token:${tokenHash}`);
      return revoked === true;
    } catch (error) {
      log.error('Failed to check token revocation status', error as Error);
      // Fail closed - assume revoked if we can't check
      return true;
    }
  }

  /**
   * Revoke entire token family (for reuse detection)
   * Requirements: 6.7
   */
  async revokeTokenFamily(familyId: string): Promise<void> {
    try {
      // Mark family as revoked
      await redis.set(`revoked:family:${familyId}`, Date.now(), this.TOKEN_FAMILY_TTL);

      // Get all tokens in family and revoke them
      const familyData = await redis.get<TokenFamily>(`token:family:${familyId}`);
      if (familyData && familyData.tokenHashes) {
        for (const tokenHash of familyData.tokenHashes) {
          await this.revokeRefreshToken(tokenHash);
        }
      }

      log.warn('Token family revoked', { familyId });
    } catch (error) {
      log.error('Failed to revoke token family', error as Error);
      throw error;
    }
  }

  /**
   * Track token in family for reuse detection
   * Requirements: 6.7
   */
  async trackTokenInFamily(tokenHash: string, familyId: string, userId: string): Promise<void> {
    try {
      // Get existing family data or create new
      let familyData = await redis.get<TokenFamily>(`token:family:${familyId}`);

      if (!familyData) {
        familyData = {
          userId,
          familyId,
          tokenHashes: [],
          createdAt: new Date(),
        };
      }

      // Add token to family
      familyData.tokenHashes.push(tokenHash);

      // Store family data
      await redis.set(`token:family:${familyId}`, familyData, this.TOKEN_FAMILY_TTL);

      // Store reverse mapping (token -> family)
      await redis.set(`token:family:map:${tokenHash}`, familyId, this.TOKEN_FAMILY_TTL);
    } catch (error) {
      log.error('Failed to track token in family', error as Error);
      throw error;
    }
  }

  /**
   * Check if token has been reused
   * Requirements: 6.7
   */
  async detectTokenReuse(tokenHash: string): Promise<boolean> {
    try {
      // Check if token has been marked as used
      const used = await redis.get<boolean>(`token:used:${tokenHash}`);
      return used === true;
    } catch (error) {
      log.error('Failed to detect token reuse', error as Error);
      // Fail closed - assume reused if we can't check
      return true;
    }
  }

  /**
   * Mark token as used (for reuse detection)
   * Requirements: 6.7
   */
  private async markTokenAsUsed(tokenHash: string): Promise<void> {
    try {
      await redis.set(`token:used:${tokenHash}`, true, this.REVOKED_TOKEN_TTL);
    } catch (error) {
      log.error('Failed to mark token as used', error as Error);
      throw error;
    }
  }

  /**
   * Get token family data
   * Requirements: 6.7
   */
  private async getTokenFamily(tokenHash: string): Promise<TokenFamily | null> {
    try {
      // Get family ID from reverse mapping
      const familyId = await redis.get<string>(`token:family:map:${tokenHash}`);
      if (!familyId) {
        return null;
      }

      // Get family data
      return redis.get<TokenFamily>(`token:family:${familyId}`);
    } catch (error) {
      log.error('Failed to get token family', error as Error);
      return null;
    }
  }
}
