import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import {
  IOAuthService,
  GenerateAuthUrlInput,
  HandleCallbackInput,
} from '../../../../application/services/oauth.service.js';
import { OAuthAccount } from '../../../../domain/entities/oauth-account.entity.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

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
 * Clean up expired PKCE entries
 */
function cleanupExpiredPkceEntries(): void {
  for (const [key, value] of pkceStorage.entries()) {
    if (value.expiresAt < Date.now()) {
      pkceStorage.delete(key);
    }
  }
}

/**
 * Handle OAuth authorization request
 */
async function handleOAuthAuthorize(
  request: FastifyRequest<{ Params: OAuthProviderParams }>,
  reply: FastifyReply,
  oauthService: IOAuthService
): Promise<void> {
  const { provider } = request.params;

  const input: GenerateAuthUrlInput = {
    provider,
  };

  const result = oauthService.generateAuthorizationUrl(input);

  // Store code verifier for callback (in production, use Redis with TTL)
  pkceStorage.set(result.state, {
    codeVerifier: result.codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  cleanupExpiredPkceEntries();

  await reply.redirect(result.authorizationUrl);
}

/**
 * Handle OAuth callback
 */
async function handleOAuthCallback(
  request: FastifyRequest<{ Params: OAuthProviderParams; Querystring: OAuthCallbackQuery }>,
  reply: FastifyReply,
  oauthService: IOAuthService
): Promise<void> {
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

  const result = await oauthService.handleCallback(input);

  await reply.status(200).send({
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
async function listOAuthAccounts(
  request: FastifyRequest,
  reply: FastifyReply,
  oauthService: IOAuthService
): Promise<void> {
  const authRequest = request as AuthenticatedRequest;

  const accounts = await oauthService.getUserOAuthAccounts(authRequest.user.userId);

  await reply.status(200).send({
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
async function unlinkOAuthAccount(
  request: FastifyRequest<{ Params: AccountIdParams }>,
  reply: FastifyReply,
  oauthService: IOAuthService
): Promise<void> {
  const authRequest = request as AuthenticatedRequest;
  const { id } = request.params;

  await oauthService.unlinkAccount(authRequest.user.userId, id);

  await reply.status(200).send({
    message: 'OAuth account unlinked successfully',
  });
}

/**
 * Register OAuth routes
 */
// eslint-disable-next-line max-lines-per-function
export function oauthRoutes(app: FastifyInstance): void {
  const oauthService = container.resolve<IOAuthService>('oauthService');

  /**
   * GET /api/v1/oauth/:provider/authorize
   * Initiate OAuth flow
   */
  app.get<{ Params: OAuthProviderParams }>(
    '/api/v1/oauth/:provider/authorize',
    async (request, reply) => handleOAuthAuthorize(request, reply, oauthService)
  );

  /**
   * GET /api/v1/oauth/:provider/callback
   * Handle OAuth callback
   */
  app.get<{ Params: OAuthProviderParams; Querystring: OAuthCallbackQuery }>(
    '/api/v1/oauth/:provider/callback',
    async (request, reply) => handleOAuthCallback(request, reply, oauthService)
  );

  /**
   * GET /api/v1/oauth/accounts
   * List linked OAuth accounts
   */
  app.get(
    '/api/v1/oauth/accounts',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request, reply) => listOAuthAccounts(request, reply, oauthService)
  );

  /**
   * DELETE /api/v1/oauth/accounts/:id
   * Unlink OAuth account
   */
  app.delete<{ Params: AccountIdParams }>(
    '/api/v1/oauth/accounts/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request, reply) => unlinkOAuthAccount(request, reply, oauthService)
  );
}
