import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthenticationError } from '../../core/errors/types/application-error.js';

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: TokenPayload;
}

/**
 * Authentication middleware that verifies JWT access tokens
 * Extracts token from Authorization header, validates it, and attaches user to request
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

    // Verify and decode token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_TOKEN_SECRET, {
        algorithms: [env.JWT_ALGORITHM as jwt.Algorithm],
      }) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token has expired', {
          expiredAt: error.expiredAt,
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token', {
          reason: error.message,
        });
      }

      throw new AuthenticationError('Token verification failed');
    }

    // Validate token payload
    if (!decoded.userId || !decoded.email) {
      throw new AuthenticationError('Invalid token payload');
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = decoded;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Authentication failed');
  }
}

/**
 * Optional authentication middleware that doesn't throw if no token is provided
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

    const decoded = jwt.verify(token, env.JWT_ACCESS_TOKEN_SECRET, {
      algorithms: [env.JWT_ALGORITHM as jwt.Algorithm],
    }) as TokenPayload;

    if (decoded.userId && decoded.email) {
      (request as AuthenticatedRequest).user = decoded;
    }
  } catch (error) {
    // Silently fail for optional authentication
    return;
  }
}
