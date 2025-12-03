import { randomBytes, createHash } from 'crypto';
import { User } from '../../domain/entities/user.entity.js';
import { OAuthAccount } from '../../domain/entities/oauth-account.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { IUserRepository } from '../../domain/repositories/user.repository.js';
import { IOAuthAccountRepository } from '../../domain/repositories/oauth-account.repository.js';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
} from '../../core/errors/types/application-error.js';

/**
 * OAuth provider configuration
 * Requirements: 9.1, 9.7
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
}

/**
 * OAuth provider profile
 * Requirements: 9.3
 */
export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified?: boolean;
}

/**
 * Input for OAuth authorization URL generation
 * Requirements: 9.1
 */
export interface GenerateAuthUrlInput {
  provider: string;
  state?: string;
}

/**
 * Output from OAuth authorization URL generation
 * Requirements: 9.1
 */
export interface GenerateAuthUrlOutput {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Input for OAuth callback handling
 * Requirements: 9.2
 */
export interface HandleCallbackInput {
  provider: string;
  code: string;
  state: string;
  codeVerifier: string;
}

/**
 * Output from OAuth callback handling
 * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6
 */
export interface HandleCallbackOutput {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
  };
  isNewUser: boolean;
  oauthAccount: {
    id: string;
    provider: string;
    providerAccountId: string;
  };
}

/**
 * OAuth Service Interface
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export interface IOAuthService {
  /**
   * Generate OAuth authorization URL with PKCE
   * Requirements: 9.1
   */
  generateAuthorizationUrl(input: GenerateAuthUrlInput): Promise<GenerateAuthUrlOutput>;

  /**
   * Handle OAuth callback and code exchange
   * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6
   */
  handleCallback(input: HandleCallbackInput): Promise<HandleCallbackOutput>;

  /**
   * Fetch user profile from OAuth provider
   * Requirements: 9.3
   */
  fetchUserProfile(provider: string, accessToken: string): Promise<OAuthProfile>;

  /**
   * Link OAuth account to existing user
   * Requirements: 9.4
   */
  linkAccount(userId: string, provider: string, profile: OAuthProfile): Promise<OAuthAccount>;

  /**
   * Get OAuth accounts for user
   * Requirements: 9.7
   */
  getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]>;

  /**
   * Unlink OAuth account
   * Requirements: 9.7
   */
  unlinkAccount(userId: string, accountId: string): Promise<void>;
}

/**
 * OAuth Service Implementation
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export class OAuthService implements IOAuthService {
  private providers: Map<string, OAuthProviderConfig> = new Map();
  private pendingStates: Map<string, { codeVerifier: string; expiresAt: Date }> = new Map();

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly oauthAccountRepository: IOAuthAccountRepository
  ) {
    this.initializeProviders();
  }

  /**
   * Initialize OAuth provider configurations
   * Requirements: 9.7
   */
  private initializeProviders(): void {
    // Google OAuth configuration
    this.providers.set('google', {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri:
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/oauth/google/callback',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: ['openid', 'email', 'profile'],
    });

    // GitHub OAuth configuration
    this.providers.set('github', {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri:
        process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/v1/oauth/github/callback',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scope: ['read:user', 'user:email'],
    });

    // Microsoft OAuth configuration
    this.providers.set('microsoft', {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri:
        process.env.MICROSOFT_REDIRECT_URI ||
        'http://localhost:3000/api/v1/oauth/microsoft/callback',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scope: ['openid', 'email', 'profile'],
    });
  }

  /**
   * Generate OAuth authorization URL with PKCE
   * Requirements: 9.1
   */
  async generateAuthorizationUrl(input: GenerateAuthUrlInput): Promise<GenerateAuthUrlOutput> {
    const provider = this.providers.get(input.provider.toLowerCase());
    if (!provider) {
      throw new ValidationError(`Unsupported OAuth provider: ${input.provider}`);
    }

    // Generate PKCE code verifier and challenge (Requirement 9.1)
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = input.state || randomBytes(32).toString('hex');

    // Store state and code verifier for later verification
    this.pendingStates.set(state, {
      codeVerifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scope.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authorizationUrl = `${provider.authorizationUrl}?${params.toString()}`;

    return {
      authorizationUrl,
      state,
      codeVerifier,
      codeChallenge,
    };
  }

  /**
   * Handle OAuth callback and code exchange
   * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6
   */
  async handleCallback(input: HandleCallbackInput): Promise<HandleCallbackOutput> {
    const provider = this.providers.get(input.provider.toLowerCase());
    if (!provider) {
      throw new ValidationError(`Unsupported OAuth provider: ${input.provider}`);
    }

    // Verify state and retrieve code verifier
    const stateData = this.pendingStates.get(input.state);
    if (!stateData) {
      throw new AuthenticationError('Invalid or expired OAuth state');
    }

    if (new Date() > stateData.expiresAt) {
      this.pendingStates.delete(input.state);
      throw new AuthenticationError('OAuth state has expired');
    }

    // Exchange authorization code for access token (Requirement 9.2)
    const tokens = await this.exchangeCodeForTokens(provider, input.code, stateData.codeVerifier);

    // Fetch user profile from provider (Requirement 9.3)
    const profile = await this.fetchUserProfile(input.provider, tokens.accessToken);

    // Find existing user by email (Requirement 9.4)
    const email = new Email(profile.email);
    let user = await this.userRepository.findByEmail(email.toString());
    let isNewUser = false;

    if (user) {
      // Link OAuth account to existing user (Requirement 9.4)
      const oauthAccount = await this.linkAccount(user.id, input.provider, profile);

      return {
        user: this.mapUserToOutput(user, profile),
        isNewUser,
        oauthAccount: {
          id: oauthAccount.id,
          provider: oauthAccount.provider,
          providerAccountId: oauthAccount.providerAccountId,
        },
      };
    } else {
      // Create new user from OAuth profile (Requirement 9.5)
      user = await this.createUserFromOAuthProfile(profile);
      isNewUser = true;

      // Link OAuth account to new user
      const oauthAccount = await this.linkAccount(user.id, input.provider, profile);

      return {
        user: this.mapUserToOutput(user, profile),
        isNewUser,
        oauthAccount: {
          id: oauthAccount.id,
          provider: oauthAccount.provider,
          providerAccountId: oauthAccount.providerAccountId,
        },
      };
    }
  }

  /**
   * Fetch user profile from OAuth provider
   * Requirements: 9.3
   */
  async fetchUserProfile(provider: string, accessToken: string): Promise<OAuthProfile> {
    const providerConfig = this.providers.get(provider.toLowerCase());
    if (!providerConfig) {
      throw new ValidationError(`Unsupported OAuth provider: ${provider}`);
    }

    try {
      const response = await fetch(providerConfig.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new AuthenticationError('Failed to fetch user profile from OAuth provider');
      }

      const data = await response.json();

      // Map provider-specific response to standard profile format
      return this.mapProviderProfileToStandard(provider, data);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Failed to fetch user profile from OAuth provider');
    }
  }

  /**
   * Link OAuth account to existing user
   * Requirements: 9.4
   */
  async linkAccount(
    userId: string,
    provider: string,
    profile: OAuthProfile
  ): Promise<OAuthAccount> {
    // Check if account is already linked
    const existingAccount = await this.oauthAccountRepository.findByProviderAndAccountId(
      provider.toLowerCase(),
      profile.id
    );

    if (existingAccount) {
      return existingAccount;
    }

    // Create new OAuth account
    const oauthAccount = new OAuthAccount({
      id: randomBytes(16).toString('hex'),
      userId,
      provider: provider.toLowerCase(),
      providerAccountId: profile.id,
      scope: this.providers.get(provider.toLowerCase())?.scope.join(' ') || null,
    });

    // Save OAuth account to repository
    return this.oauthAccountRepository.create(oauthAccount);
  }

  /**
   * Get OAuth accounts for user
   * Requirements: 9.7
   */
  async getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    return this.oauthAccountRepository.findByUserId(userId);
  }

  /**
   * Unlink OAuth account
   * Requirements: 9.7
   */
  async unlinkAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.oauthAccountRepository.findById(accountId);

    if (!account) {
      throw new NotFoundError('OAuth account');
    }

    if (account.userId !== userId) {
      throw new AuthenticationError('OAuth account does not belong to user');
    }

    await this.oauthAccountRepository.delete(accountId);
  }

  /**
   * Exchange authorization code for access token
   * Requirements: 9.2
   */
  private async exchangeCodeForTokens(
    provider: OAuthProviderConfig,
    code: string,
    codeVerifier: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    try {
      const params = new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: provider.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      });

      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new AuthenticationError('Failed to exchange authorization code for tokens');
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Create new user from OAuth profile
   * Requirements: 9.5
   */
  private async createUserFromOAuthProfile(profile: OAuthProfile): Promise<User> {
    const email = new Email(profile.email);

    const user = new User({
      id: randomBytes(16).toString('hex'),
      email,
      passwordHash: null, // OAuth users don't have passwords
      name: profile.name,
      image: profile.image,
      emailVerified: profile.emailVerified ?? false, // Requirement 9.6
      accountLocked: false,
      failedLoginAttempts: 0,
    });

    // Save user to database
    return this.userRepository.save(user);
  }

  /**
   * Map provider-specific profile to standard format
   * Requirements: 9.3
   */
  private mapProviderProfileToStandard(provider: string, data: unknown): OAuthProfile {
    switch (provider.toLowerCase()) {
      case 'google':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          image: data.picture,
          emailVerified: data.verified_email,
        };

      case 'github':
        return {
          id: data.id.toString(),
          email: data.email,
          name: data.name || data.login,
          image: data.avatar_url,
          emailVerified: true, // GitHub emails are verified
        };

      case 'microsoft':
        return {
          id: data.id,
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
          image: null, // Microsoft Graph doesn't provide avatar URL directly
          emailVerified: true, // Microsoft emails are verified
        };

      default:
        throw new ValidationError(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Map User entity to output format
   */
  private mapUserToOutput(user: User, profile: OAuthProfile): HandleCallbackOutput['user'] {
    return {
      id: user.id,
      email: user.email.toString(),
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified || profile.emailVerified || false,
    };
  }

  /**
   * Generate PKCE code verifier
   * Requirements: 9.1
   */
  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   * Requirements: 9.1
   */
  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }
}
