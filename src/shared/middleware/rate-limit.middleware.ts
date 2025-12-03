import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { RateLimitError } from '../errors/types/application-error.js';
import { container } from '../container/container.js';
import { IRateLimitService } from '../application/services/rate-limit.service.js';
import { AuthenticatedRequest } from './authentication.middleware.js';

export interface RateLimitConfig {
  max: number;
  windowMs: number;
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Creates a rate limiting middleware with custom configuration
 * @param config - Rate limit configuration
 * @returns Fastify middleware function
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const rateLimitService = container.resolve<IRateLimitService>('rateLimitService');

    // Generate key for rate limiting
    const endpoint = config.keyGenerator
      ? config.keyGenerator(request)
      : `${request.ip}:${request.routeOptions?.url || request.url}`;

    // Check rate limit
    const result = await rateLimitService.checkRateLimit(endpoint, endpoint);

    // Add rate limit headers
    void reply.header('X-RateLimit-Limit', config.max.toString());
    void reply.header('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
    void reply.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      const retryAfter = result.retryAfter || 0;
      void reply.header('Retry-After', retryAfter.toString());

      throw new RateLimitError(retryAfter, {
        limit: config.max,
        remaining: result.remaining,
        resetAt: result.resetAt,
      });
    }
  };
}

/**
 * Rate limiter for authentication endpoints (10 requests per minute per IP)
 */
export const authenticationRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_AUTH_MAX,
  windowMs: env.RATE_LIMIT_AUTH_WINDOW,
  keyGenerator: (request: FastifyRequest) => `auth:${request.ip}`,
});

/**
 * Rate limiter for password reset endpoints (5 requests per minute per IP)
 */
export const passwordResetRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_PASSWORD_RESET_MAX,
  windowMs: env.RATE_LIMIT_PASSWORD_RESET_WINDOW,
  keyGenerator: (request: FastifyRequest) => `password-reset:${request.ip}`,
});

/**
 * Rate limiter for registration endpoint (3 requests per 5 minutes per IP)
 */
export const registrationRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_REGISTRATION_MAX,
  windowMs: env.RATE_LIMIT_REGISTRATION_WINDOW,
  keyGenerator: (request: FastifyRequest) => `registration:${request.ip}`,
});

/**
 * Rate limiter for MFA verification (1 request per 10 seconds per user)
 */
export const mfaVerificationRateLimiter = createRateLimiter({
  max: 1,
  windowMs: 10000, // 10 seconds
  keyGenerator: (request: FastifyRequest) => {
    const authRequest = request as AuthenticatedRequest;
    const userId = authRequest.user?.userId || request.ip;
    return `mfa-verify:${userId}`;
  },
});

/**
 * Rate limiter for API endpoints with trust-based adjustment
 * Users with high trust scores get relaxed limits
 */
export function createTrustBasedRateLimiter(baseConfig: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;
    let adjustedMax = baseConfig.max;

    // If user is authenticated, check trust score and adjust limits
    if (authRequest.user?.userId) {
      try {
        // Get user's trust score from session or user service
        // For now, we'll use a simple multiplier based on authentication
        // In production, this would fetch actual trust score
        adjustedMax = Math.floor(baseConfig.max * 1.5); // 50% increase for authenticated users
      } catch (error) {
        // If we can't get trust score, use base limit
        adjustedMax = baseConfig.max;
      }
    }

    const rateLimitService = container.resolve<IRateLimitService>('rateLimitService');

    const endpoint = baseConfig.keyGenerator
      ? baseConfig.keyGenerator(request)
      : `${request.ip}:${request.routeOptions?.url || request.url}`;

    const result = await rateLimitService.checkRateLimit(endpoint, endpoint);

    void reply.header('X-RateLimit-Limit', adjustedMax.toString());
    void reply.header('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
    void reply.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      const retryAfter = result.retryAfter || 0;
      void reply.header('Retry-After', retryAfter.toString());

      throw new RateLimitError(retryAfter, {
        limit: adjustedMax,
        remaining: result.remaining,
        resetAt: result.resetAt,
      });
    }
  };
}

/**
 * General API rate limiter with trust-based adjustment
 */
export const apiRateLimiter = createTrustBasedRateLimiter({
  max: 100,
  windowMs: 60000, // 1 minute
  keyGenerator: (request: FastifyRequest) => {
    const authRequest = request as AuthenticatedRequest;
    const identifier = authRequest.user?.userId || request.ip;
    return `api:${identifier}`;
  },
});
