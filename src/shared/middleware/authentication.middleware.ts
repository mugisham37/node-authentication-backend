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
 * Authentication middleware that verifies JWT access tokens
 * Uses centralized JwtService for token verification
 * Extracts token from Authorization header, validates it, and attaches user to request
 * Requirements: 3.7, 7.2, 19.1
 */
export async function authenticationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError(
        'Invalid authorization header format. Expected: Bearer <token>'
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify and decode token using centralized JwtService
    let decoded: JwtPayload;
    try {
      decoded = JwtService.verifyAccessToken(token);
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

    // Validate token payload
    if (!decoded.userId) {
      throw new AuthenticationError('Invalid token payload');
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = {
      userId: decoded.userId,
      email: decoded.email,
      sessionId: decoded.sessionId,
      roles: decoded.roles,
      permissions: decoded.permissions,
    };

    // Set user context for logging (Requirement 22.2)
    userContextStorage.enterWith({
      userId: decoded.userId,
      email: decoded.email || 'unknown',
    });
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
export async function optionalAuthenticationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // No token provided, continue without authentication
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

      // Set user context for logging (Requirement 22.2)
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
