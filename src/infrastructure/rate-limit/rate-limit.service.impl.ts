import { Redis } from 'ioredis';
import type {
  IRateLimitService,
  RateLimitConfig,
  RateLimitResult,
} from '../../application/services/rate-limit.service.js';
import { logger } from '../../core/logging/logger.js';

/**
 * Rate limiting service implementation using Redis sliding window algorithm
 *
 * Features:
 * - Sliding window rate limiting using Redis sorted sets
 * - Per-IP and per-user rate limits
 * - Endpoint-specific configurations
 * - Trust-based rate limit adjustments
 * - Fail-open behavior when Redis is unavailable
 *
 * Algorithm:
 * Uses Redis sorted sets (ZSET) where:
 * - Score = timestamp of request
 * - Member = unique identifier for each request
 *
 * For each request:
 * 1. Remove entries outside the time window (ZREMRANGEBYSCORE)
 * 2. Count remaining entries (ZCARD)
 * 3. Add current request (ZADD)
 * 4. Set expiration on the key (EXPIRE)
 *
 * This provides accurate sliding window behavior without fixed time buckets.
 *
 * @implements {IRateLimitService}
 */
export class RateLimitService implements IRateLimitService {
  private redis: Redis;
  private endpointConfigs: Map<string, RateLimitConfig>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.endpointConfigs = new Map();

    // Initialize default endpoint configurations
    this.initializeDefaultConfigs();

    logger.info('Rate limit service initialized');
  }

  /**
   * Initialize default rate limit configurations for endpoints
   *
   * Configurations match requirements:
   * - Authentication: 10 req/min (Requirement 14.2)
   * - Registration: 3 req/5min (Requirement 14.4)
   * - Password reset: 5 req/min (Requirement 14.3)
   * - MFA verification: 1 req/10sec (Requirement 14.5)
   * - Default: 100 req/min for other endpoints
   */
  private initializeDefaultConfigs(): void {
    // Authentication endpoints: 10 requests per minute per IP
    this.endpointConfigs.set('/api/v1/auth/login', {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    this.endpointConfigs.set('/api/v1/auth/register', {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000, // 3 requests per 5 minutes
    });

    // Password reset: 5 requests per minute per IP
    this.endpointConfigs.set('/api/v1/auth/password/forgot', {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });

    this.endpointConfigs.set('/api/v1/auth/password/reset', {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });

    // MFA verification: 1 request per 10 seconds per user
    this.endpointConfigs.set('/api/v1/auth/mfa/verify', {
      maxRequests: 1,
      windowMs: 10 * 1000,
    });

    // Default rate limit for other endpoints
    this.endpointConfigs.set('default', {
      maxRequests: 100,
      windowMs: 60 * 1000, // 100 requests per minute
    });
  }

  async checkRateLimit(
    identifier: string,
    endpoint: string,
    trustScore: number = 0
  ): Promise<RateLimitResult> {
    const config = this.getEndpointConfig(endpoint);
    const adjustedConfig = this.adjustForTrustScore(config, trustScore);

    const key = `rate_limit:${endpoint}:${identifier}`;
    const now = Date.now();
    const windowStart = now - adjustedConfig.windowMs;

    try {
      // Use Redis sorted set for sliding window
      const multi = this.redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}`);

      // Set expiry on the key
      multi.expire(key, Math.ceil(adjustedConfig.windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        throw new Error('Redis transaction failed');
      }

      // Get count from zcard result (index 1)
      const count = (results[1][1] as number) || 0;

      const allowed = count < adjustedConfig.maxRequests;
      const remaining = Math.max(0, adjustedConfig.maxRequests - count - 1);

      const resetAt = new Date(now + adjustedConfig.windowMs);
      const retryAfter = allowed ? undefined : Math.ceil(adjustedConfig.windowMs / 1000);

      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          identifier,
          endpoint,
          count,
          maxRequests: adjustedConfig.maxRequests,
          trustScore,
        });
      }

      return {
        allowed,
        remaining,
        resetAt,
        retryAfter,
      };
    } catch (error) {
      logger.error('Rate limit check failed', {
        error,
        identifier,
        endpoint,
      });

      // Fail open - allow request if Redis is unavailable
      return {
        allowed: true,
        remaining: adjustedConfig.maxRequests,
        resetAt: new Date(now + adjustedConfig.windowMs),
      };
    }
  }

  getEndpointConfig(endpoint: string): RateLimitConfig {
    return this.endpointConfigs.get(endpoint) || this.endpointConfigs.get('default')!;
  }

  async resetRateLimit(identifier: string, endpoint: string): Promise<void> {
    const key = `rate_limit:${endpoint}:${identifier}`;

    try {
      await this.redis.del(key);

      logger.info('Rate limit reset', {
        identifier,
        endpoint,
      });
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error,
        identifier,
        endpoint,
      });
      throw error;
    }
  }

  /**
   * Adjust rate limits based on user trust score
   *
   * Trust score ranges:
   * - High trust (>= 80): 50% more requests allowed
   * - Medium trust (>= 50): 20% more requests allowed
   * - Low trust (< 50): Default limits
   *
   * This implements Requirement 14.7: Trust-based rate limit adjustment
   *
   * @param config - Base rate limit configuration
   * @param trustScore - User trust score (0-100)
   * @returns Adjusted rate limit configuration
   */
  private adjustForTrustScore(config: RateLimitConfig, trustScore: number): RateLimitConfig {
    // Users with high trust scores (>= 80) get relaxed limits
    if (trustScore >= 80) {
      return {
        maxRequests: Math.floor(config.maxRequests * 1.5), // 50% more requests
        windowMs: config.windowMs,
      };
    }

    // Users with medium trust scores (>= 50) get slightly relaxed limits
    if (trustScore >= 50) {
      return {
        maxRequests: Math.floor(config.maxRequests * 1.2), // 20% more requests
        windowMs: config.windowMs,
      };
    }

    // Low trust scores use default limits
    return config;
  }

  /**
   * Set custom rate limit configuration for an endpoint
   */
  setEndpointConfig(endpoint: string, config: RateLimitConfig): void {
    this.endpointConfigs.set(endpoint, config);
    logger.info('Rate limit config updated', {
      endpoint,
      config,
    });
  }
}
