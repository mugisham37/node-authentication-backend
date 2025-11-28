/**
 * OAuthAccount entity representing a linked OAuth provider account.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7
 */
export class OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: {
    id: string;
    userId: string;
    provider: string;
    providerAccountId: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | null;
    scope?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.provider = props.provider;
    this.providerAccountId = props.providerAccountId;
    this.accessToken = props.accessToken ?? null;
    this.refreshToken = props.refreshToken ?? null;
    this.tokenExpiresAt = props.tokenExpiresAt ?? null;
    this.scope = props.scope ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Updates the OAuth tokens
   * Requirement: 9.2
   */
  updateTokens(accessToken: string, refreshToken?: string, expiresAt?: Date): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    if (expiresAt) {
      this.tokenExpiresAt = expiresAt;
    }
    this.updatedAt = new Date();
  }

  /**
   * Checks if the access token has expired
   */
  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    return new Date() > this.tokenExpiresAt;
  }

  /**
   * Gets the provider name in a user-friendly format
   */
  getProviderDisplayName(): string {
    const providerNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
    };
    return providerNames[this.provider.toLowerCase()] || this.provider;
  }
}
