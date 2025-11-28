import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../../domain/entities/user.entity.js';
import { AuthenticationError } from '../../core/errors/types/application-error.js';
import * as redis from '../../core/cache/redis.js';
import { log } from '../../core/logging/logger.js';

/**
 * JWT Payload structure
 * Requirements: 6.1
 */
export interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Token generation output
 * Requirements: 6.1, 6.4, 6.5
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Token refresh output
 * Requirements: 6.1, 6.6
 */
export interface RefreshOutput {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Token family data for reuse detection
 * Requirements: 6.7
 */
interface TokenFamily {
  userId: string;
  familyId: string;
  tokenHashes: string[];
  createdAt: Date;
}

/**
 * Token Service Interface
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export interface ITokenService {
  /**
   * Generate access and refresh token pair
   * Requirements: 6.1, 6.4, 6.5
   */
  generateTokenPair(user: User): Promise<TokenPair>;

  /**
   * Generate access token with RS256
   * Requirements: 6.1, 6.4
   */
  generateAccessToken(user: User): string;

  /**
   * Generate refresh token with crypto
   * Requirements: 6.1, 6.5
   */
  generateRefreshToken(): string;

  /**
   * Verify and decode access token
   * Requirements: 6.1
   */
  verifyAccessToken(token: string): TokenPayload;

  /**
   * Hash refresh token for storage
   * Requirements: 6.1
   */
  hashRefreshToken(token: string): string;

  /**
   * Refresh tokens with rotation
   * Requirements: 6.1, 6.6
   */
  refreshTokens(refreshToken: string, userId: string): Promise<RefreshOutput>;

  /**
   * Revoke refresh token
   * Requirements: 6.3
   */
  revokeRefreshToken(tokenHash: string): Promise<void>;

  /**
   * Check if refresh token is revoked
   * Requirements: 6.3
   */
  isRefreshTokenRevoked(tokenHash: string): Promise<boolean>;

  /**
   * Revoke entire token family (for reuse detection)
   * Requirements: 6.7
   */
  revokeTokenFamily(familyId: string): Promise<void>;

  /**
   * Track token in family for reuse detection
   * Requirements: 6.7
   */
  trackTokenInFamily(tokenHash: string, familyId: string, userId: string): Promise<void>;

  /**
   * Check if token has been reused
   * Requirements: 6.7
   */
  detectTokenReuse(tokenHash: string): Promise<boolean>;
}

/**
 * Token Service Implementation
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export class TokenService implements ITokenService {
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds (Requirement 6.4)
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds (Requirement 6.5)
  private readonly REVOKED_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly TOKEN_FAMILY_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor() {
    // In production, these should be loaded from secure key management system
    // For now, we'll use environment variables
    this.privateKey = process.env['JWT_PRIVATE_KEY'] || this.generateDevelopmentKey('private');
    this.publicKey = process.env['JWT_PUBLIC_KEY'] || this.generateDevelopmentKey('public');

    if (!process.env['JWT_PRIVATE_KEY']) {
      log.warn('JWT_PRIVATE_KEY not set, using development key. DO NOT use in production!');
    }
  }

  /**
   * Generate development keys (for testing only)
   * In production, use proper RSA key pairs
   */
  private generateDevelopmentKey(type: 'private' | 'public'): string {
    // This is a placeholder - in production, use proper RSA keys
    return type === 'private'
      ? '-----BEGIN PRIVATE KEY-----\nDEVELOPMENT_KEY\n-----END PRIVATE KEY-----'
      : '-----BEGIN PUBLIC KEY-----\nDEVELOPMENT_KEY\n-----END PUBLIC KEY-----';
  }

  /**
   * Generate access and refresh token pair
   * Requirements: 6.1, 6.4, 6.5
   */
  async generateTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + this.ACCESS_TOKEN_EXPIRY * 1000);
    const refreshTokenExpiresAt = new Date(now + this.REFRESH_TOKEN_EXPIRY * 1000);

    // Create token family for reuse detection (Requirement 6.7)
    const familyId = randomBytes(16).toString('hex');
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.trackTokenInFamily(tokenHash, familyId, user.id);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Generate access token with RS256
   * Requirements: 6.1, 6.4
   */
  generateAccessToken(user: User): string {
    const now = Math.floor(Date.now() / 1000);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email.toString(),
      iat: now,
      exp: now + this.ACCESS_TOKEN_EXPIRY, // 15 minutes (Requirement 6.4)
    };

    try {
      // Use RS256 algorithm for asymmetric signing (Requirement 6.1)
      return jwt.sign(payload, this.privateKey, {
        algorithm: 'RS256',
      });
    } catch (error) {
      log.error('Failed to generate access token', error as Error);
      throw new AuthenticationError('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token with crypto
   * Requirements: 6.1, 6.5
   */
  generateRefreshToken(): string {
    // Generate cryptographically secure random token (Requirement 6.1)
    return randomBytes(32).toString('hex');
  }

  /**
   * Verify and decode access token
   * Requirements: 6.1
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      // Verify with RS256 public key
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token');
      }
      log.error('Failed to verify access token', error as Error);
      throw new AuthenticationError('Token verification failed');
    }
  }

  /**
   * Hash refresh token for storage
   * Requirements: 6.1
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
