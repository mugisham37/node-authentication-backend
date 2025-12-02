export interface RateLimitResult {
  allowed: boolean;
  current: number;
  resetTime: number;
}

export interface IRateLimitService {
  checkRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
}
