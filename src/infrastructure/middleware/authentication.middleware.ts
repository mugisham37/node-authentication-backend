import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService, JwtPayload } from '../security/tokens/jwt.service.js';
import { AuthenticationError } from '../../shared/errors/types/application-error.js';
import { userContextStorage } from '../logging/logger.js';

export interface TokenPayload {
  userId: string;
  email?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: TokenPayload;
}

/**
 * Extract and validate Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new AuthenticationError('No authorization header provided');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Invalid authorization header format. Expected: Bearer <token>');
  }

  const token = authHeader.substring(7);
  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  return token;
}

/**
 * Verify and decode JWT token with error handling
 */
function verifyToken(token: string): JwtPayload {
  try {
    return JwtService.verifyAccessToken(token);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Access token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid access token', {
          reason: error.message,
        });
      }
    }
    throw new AuthenticationError('Token verification failed');
  }
}

/**
 * Attach user data to request and set logging context
 */
function attachUserToRequest(request: FastifyRequest, decoded: JwtPayload): void {
  if (!decoded.userId) {
    throw new AuthenticationError('Invalid token payload');
  }

  (request as AuthenticatedRequest).user = {
    userId: decoded.userId,
    email: decoded.email,
    sessionId: decoded.sessionId,
    roles: decoded.roles,
    permissions: decoded.permissions,
  };

  userContextStorage.enterWith({
    userId: decoded.userId,
    email: decoded.email || 'unknown',
  });
}

/**
 * Authentication middleware that verifies JWT access tokens
 * Uses centralized JwtService for token verification
 * Extracts token from Authorization header, validates it, and attaches user to request
 * Requirements: 3.7, 7.2, 19.1
 */
export function authenticationMiddleware(request: FastifyRequest, _reply: FastifyReply): void {
  try {
    const token = extractBearerToken(request.headers.authorization);
    const decoded = verifyToken(token);
    attachUserToRequest(request, decoded);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Authentication failed');
  }
}

/**
 * Optional authentication middleware that doesn't throw if no token is provided
 * Uses centralized JwtService for token verification
 * Useful for endpoints that work with or without authentication
 */
export function optionalAuthenticationMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }

    const token = authHeader.substring(7);
    if (!token) {
      return;
    }

    const decoded = JwtService.verifyAccessToken(token);

    if (decoded.userId) {
      (request as AuthenticatedRequest).user = {
        userId: decoded.userId,
        email: decoded.email,
        sessionId: decoded.sessionId,
        roles: decoded.roles,
        permissions: decoded.permissions,
      };

      userContextStorage.enterWith({
        userId: decoded.userId,
        email: decoded.email || 'unknown',
      });
    }
  } catch (error) {
    // Silently fail for optional authentication
    return;
  }
}
