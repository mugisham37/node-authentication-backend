import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { connectionManager } from './connection-manager.js';
import { authenticateWebSocket, sendErrorAndClose } from './websocket-auth.js';
import { logger } from '../../core/logging/logger.js';

/**
 * Sets up WebSocket routes and handlers
 * Requirement: 17.4
 */
export async function setupWebSocketRoutes(app: FastifyInstance): Promise<void> {
  // WebSocket endpoint for real-time notifications
  app.get('/ws', { websocket: true }, async (socket: SocketStream, request: FastifyRequest) => {
    await handleWebSocketConnection(socket, request);
  });

  logger.info('WebSocket routes registered');
}

/**
 * Handles a new WebSocket connection
 */
async function handleWebSocketConnection(
  socket: SocketStream,
  request: FastifyRequest
): Promise<void> {
  // Authenticate the connection
  const payload = await authenticateWebSocket(request);

  if (!payload) {
    sendErrorAndClose(socket, 'Authentication failed');
    return;
  }

  const { userId, sessionId } = payload;

  // Add connection to manager
  connectionManager.addConnection(userId, sessionId, socket);

  // Send welcome message
  socket.send(
    JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString(),
    })
  );

  // Handle incoming messages
  socket.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      await handleIncomingMessage(userId, sessionId, message, socket);
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        userId,
        sessionId,
        error,
      });
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  // Handle ping/pong for keepalive
  socket.on('ping', () => {
    socket.pong();
  });

  logger.info('WebSocket connection established', {
    userId,
    sessionId,
    ip: request.ip,
  });
}

/**
 * Handles incoming WebSocket messages from clients
 */
async function handleIncomingMessage(
  userId: string,
  sessionId: string,
  message: any,
  socket: SocketStream
): Promise<void> {
  const { type, payload } = message;

  switch (type) {
    case 'ping':
      // Respond to ping with pong
      socket.send(
        JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString(),
        })
      );
      break;

    case 'subscribe':
      // Handle subscription to specific event types (future enhancement)
      logger.info('WebSocket subscription request', {
        userId,
        sessionId,
        payload,
      });
      socket.send(
        JSON.stringify({
          type: 'subscribed',
          payload,
          timestamp: new Date().toISOString(),
        })
      );
      break;

    default:
      logger.warn('Unknown WebSocket message type', {
        userId,
        sessionId,
        type,
      });
      socket.send(
        JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${type}`,
          timestamp: new Date().toISOString(),
        })
      );
  }
}
