import { OAuthAccount } from '../entities/oauth-account.entity.js';

/**
 * OAuth Account Repository Interface
 * Requirements: 9.4, 9.5, 9.7
 */
export interface IOAuthAccountRepository {
  /**
   * Create a new OAuth account
   * Requirements: 9.4, 9.5
   */
  create(account: OAuthAccount): Promise<OAuthAccount>;

  /**
   * Find OAuth account by ID
   */
  findById(id: string): Promise<OAuthAccount | null>;

  /**
   * Find OAuth account by provider and provider account ID
   * Requirements: 9.4
   */
  findByProviderAndAccountId(
    provider: string,
    providerAccountId: string
  ): Promise<OAuthAccount | null>;

  /**
   * Find all OAuth accounts for a user
   * Requirements: 9.7
   */
  findByUserId(userId: string): Promise<OAuthAccount[]>;

  /**
   * Update OAuth account
   * Requirements: 9.2
   */
  update(account: OAuthAccount): Promise<OAuthAccount>;

  /**
   * Delete OAuth account
   * Requirements: 9.7
   */
  delete(id: string): Promise<void>;

  /**
   * Check if user has OAuth account with provider
   * Requirements: 9.4
   */
  hasProviderAccount(userId: string, provider: string): Promise<boolean>;
}
