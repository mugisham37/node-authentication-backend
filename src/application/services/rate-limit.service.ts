/**
 * Rate limit configuration for an endpoint
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Rate limiting service interface
 * Implements sliding window rate limiting with Redis
 */
export interface IRateLimitService {
  /**
   * Check if a request is allowed under rate limits
   * @param identifier - Unique identifier (IP address or user ID)
   * @param endpoint - API endpoint being accessed
   * @param trustScore - User trust score (0-100) for adjusting limits
   * @returns Rate limit result indicating if request is allowed
   */
  checkRateLimit(
    identifier: string,
    endpoint: string,
    trustScore?: number
  ): Promise<RateLimitResult>;

  /**
   * Get rate limit configuration for an endpoint
   * @param endpoint - API endpoint
   * @returns Rate limit configuration
   */
  getEndpointConfig(endpoint: string): RateLimitConfig;

  /**
   * Reset rate limit for a specific identifier and endpoint
   * @param identifier - Unique identifier (IP address or user ID)
   * @param endpoint - API endpoint
   */
  resetRateLimit(identifier: string, endpoint: string): Promise<void>;

  /**
   * Set custom rate limit configuration for an endpoint
   * @param endpoint - API endpoint
   * @param config - Rate limit configuration
   */
  setEndpointConfig(endpoint: string, config: RateLimitConfig): void;
}
