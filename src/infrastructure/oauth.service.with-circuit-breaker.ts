import type {
  IOAuthService,
  GenerateAuthUrlInput,
  GenerateAuthUrlOutput,
  HandleCallbackInput,
  HandleCallbackOutput,
  OAuthProfile,
} from '../application/services/oauth.service.js';
import { OAuthAccount } from '../domain/entities/oauth-account.entity.js';
import { CircuitBreaker } from './resilience/circuit-breaker.js';
import { logger } from './logging/logger.js';

/**
 * OAuth service wrapper with circuit breaker protection
 * Protects against cascading failures when OAuth providers are unavailable
 * Requirements: 20.4
 */
export class OAuthServiceWithCircuitBreaker implements IOAuthService {
  private circuitBreaker: CircuitBreaker;

  constructor(private readonly oauthService: IOAuthService) {
    this.circuitBreaker = new CircuitBreaker('oauth-service', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000, // 30 seconds for OAuth operations
      resetTimeout: 60000, // 1 minute before attempting to close circuit
    });

    logger.info('OAuth service with circuit breaker initialized');
  }

  async generateAuthorizationUrl(input: GenerateAuthUrlInput): Promise<GenerateAuthUrlOutput> {
    // Authorization URL generation is local, no need for circuit breaker
    return this.oauthService.generateAuthorizationUrl(input);
  }

  async handleCallback(input: HandleCallbackInput): Promise<HandleCallbackOutput> {
    // Callback handling involves external API calls, protect with circuit breaker
    return this.circuitBreaker.execute(() => this.oauthService.handleCallback(input));
  }

  async fetchUserProfile(provider: string, accessToken: string): Promise<OAuthProfile> {
    // User profile fetching involves external API calls, protect with circuit breaker
    return this.circuitBreaker.execute(() =>
      this.oauthService.fetchUserProfile(provider, accessToken)
    );
  }

  async linkAccount(
    userId: string,
    provider: string,
    profile: OAuthProfile
  ): Promise<OAuthAccount> {
    // Account linking is local database operation, no need for circuit breaker
    return this.oauthService.linkAccount(userId, provider, profile);
  }

  async getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    // Getting OAuth accounts is local database operation, no need for circuit breaker
    return this.oauthService.getUserOAuthAccounts(userId);
  }

  async unlinkAccount(userId: string, accountId: string): Promise<void> {
    // Unlinking account is local database operation, no need for circuit breaker
    return this.oauthService.unlinkAccount(userId, accountId);
  }

  getCircuitBreakerMetrics(): {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    nextAttemptTime: number | null;
  } {
    return this.circuitBreaker.getMetrics();
  }
}
