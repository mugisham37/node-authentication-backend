import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import {
  IOAuthService,
  GenerateAuthUrlInput,
  HandleCallbackInput,
} from '../../../../application/services/oauth.service.js';
import { OAuthAccount } from '../../../../domain/entities/oauth-account.entity.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';

/**
 * Request params for OAuth provider routes
 */
interface OAuthProviderParams {
  provider: string;
}

/**
 * Query parameters for OAuth callback
 */
interface OAuthCallbackQuery {
  code: string;
  state: string;
  code_verifier?: string;
}

/**
 * Request params for account operations
 */
interface AccountIdParams {
  id: string;
}

/**
 * In-memory storage for PKCE code verifiers (in production, use Redis or session storage)
 */
const pkceStorage = new Map<string, { codeVerifier: string; expiresAt: number }>();

/**
 * OAuth controller handling OAuth authorization flows and account management
 */
export class OAuthController extends BaseController {
  constructor(private readonly oauthService: IOAuthService) {
    super();
  }

  /**
   * Clean up expired PKCE entries
   */
  private cleanupExpiredPkceEntries(): void {
    for (const [key, value] of pkceStorage.entries()) {
      if (value.expiresAt < Date.now()) {
        pkceStorage.delete(key);
      }
    }
  }

  /**
   * Initiate OAuth flow
   */
  async authorize(
    request: FastifyRequest<{ Params: OAuthProviderParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const { provider } = request.params;

    const input: GenerateAuthUrlInput = {
      provider,
    };

    const result = this.oauthService.generateAuthorizationUrl(input);

    // Store code verifier for callback (in production, use Redis with TTL)
    pkceStorage.set(result.state, {
      codeVerifier: result.codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    this.cleanupExpiredPkceEntries();

    await reply.redirect(result.authorizationUrl);
  }

  /**
   * Handle OAuth callback
   */
  async callback(
    request: FastifyRequest<{ Params: OAuthProviderParams; Querystring: OAuthCallbackQuery }>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { provider } = request.params;
    const { code, state, code_verifier } = request.query;

    // Retrieve code verifier from storage
    const stored = pkceStorage.get(state);
    const codeVerifier = code_verifier ?? stored?.codeVerifier ?? '';

    // Clean up used state
    pkceStorage.delete(state);

    const input: HandleCallbackInput = {
      provider,
      code,
      state,
      codeVerifier,
    };

    const result = await this.oauthService.handleCallback(input);

    return this.success(reply, {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image,
        emailVerified: result.user.emailVerified,
      },
      isNewUser: result.isNewUser,
      oauthAccount: {
        id: result.oauthAccount.id,
        provider: result.oauthAccount.provider,
        providerAccountId: result.oauthAccount.providerAccountId,
      },
    });
  }

  /**
   * List linked OAuth accounts
   */
  async listAccounts(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;

    const accounts = await this.oauthService.getUserOAuthAccounts(authRequest.user.userId);

    return this.success(reply, {
      accounts: accounts.map((account: OAuthAccount) => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        createdAt: account.createdAt,
      })),
    });
  }

  /**
   * Unlink OAuth account
   */
  async unlinkAccount(
    request: FastifyRequest<{ Params: AccountIdParams }>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params;

    await this.oauthService.unlinkAccount(authRequest.user.userId, id);

    return this.success(reply, {
      message: 'OAuth account unlinked successfully',
    });
  }
}
