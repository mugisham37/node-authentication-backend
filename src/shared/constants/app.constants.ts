/**
 * Application-wide constants
 */

export const APP_NAME = 'Enterprise Authentication System';
export const APP_VERSION = '1.0.0';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
  VERIFICATION_TOKEN: '24h',
  PASSWORD_RESET_TOKEN: '1h',
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

export const RATE_LIMITS = {
  AUTH: 5, // 5 attempts per window
  API: 100, // 100 requests per window
  WEBHOOK: 1000, // 1000 webhook deliveries per window
} as const;
