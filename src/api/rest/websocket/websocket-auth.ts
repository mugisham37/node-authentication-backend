import { FastifyRequest } from 'fastify';
import type WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../core/logging/logger.js';

/**
 * Decoded JWT payload
 */
export interface TokenPayload {
  userId: string;
  sessionId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Authenticates a WebSocket connection using JWT token
 * Requirement: 17.4
 */
export function authenticateWebSocket(request: FastifyRequest): Promise<TokenPayload | null> {
  return Promise.resolve(authenticateWebSocketSync(request));
}

/**
 * Synchronous authentication helper
 */
function authenticateWebSocketSync(request: FastifyRequest): TokenPayload | null {
  try {
    // Extract token from query parameter or authorization header
    const token = extractToken(request);

    if (!token) {
      logger.warn('WebSocket authentication failed: No token provided', {
        ip: request.ip,
      });
      return null;
    }

    // Verify JWT token
    const payload = jwt.verify(token, env.JWT_ACCESS_TOKEN_SECRET) as TokenPayload;

    // Validate payload structure
    if (!payload.userId || !payload.sessionId) {
      logger.warn('WebSocket authentication failed: Invalid token payload', {
        ip: request.ip,
      });
      return null;
    }

    logger.info('WebSocket authentication successful', {
      userId: payload.userId,
      sessionId: payload.sessionId,
    });

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('WebSocket authentication failed: Token expired', {
        ip: request.ip,
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('WebSocket authentication failed: Invalid token', {
        ip: request.ip,
        error: error.message,
      });
    } else {
      logger.error('WebSocket authentication error', {
        ip: request.ip,
        error,
      });
    }
    return null;
  }
}

/**
 * Extracts JWT token from request
 */
function extractToken(request: FastifyRequest): string | null {
  // Try query parameter first (for WebSocket connections)
  const query = request.query as Record<string, unknown>;
  const queryToken = query?.['token'];
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }

  // Try authorization header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Sends an error message and closes the WebSocket connection
 */
export function sendErrorAndClose(socket: WebSocket, message: string): void {
  try {
    if (socket.readyState === socket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message,
          timestamp: new Date().toISOString(),
        })
      );
    }
    socket.close();
  } catch (error) {
    logger.error('Error sending WebSocket error message', { error });
    try {
      socket.close();
    } catch {
      // Socket already closed
    }
  }
}
