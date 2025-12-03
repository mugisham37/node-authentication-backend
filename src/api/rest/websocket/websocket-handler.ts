import { FastifyInstance, FastifyRequest } from 'fastify';
import type WebSocket from 'ws';
import { connectionManager } from './connection-manager.js';
import { authenticateWebSocket, sendErrorAndClose } from './websocket-auth.js';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * Sets up WebSocket routes and handlers
 * Requirement: 17.4
 */
export function setupWebSocketRoutes(app: FastifyInstance): void {
  // WebSocket endpoint for real-time notifications
  app.get('/ws', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    handleWebSocketConnection(socket, request);
  });

  logger.info('WebSocket routes registered');
}

/**
 * Handles a new WebSocket connection
 */
function handleWebSocketConnection(socket: WebSocket, request: FastifyRequest): void {
  // Authenticate the connection
  authenticateWebSocket(request)
    .then((payload) => {
      if (!payload) {
        sendErrorAndClose(socket, 'Authentication failed');
        return;
      }

      const { userId, sessionId } = payload;
      setupConnection(socket, request, userId, sessionId);
    })
    .catch((error) => {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      logger.error('WebSocket authentication error', { error });
      sendErrorAndClose(socket, 'Authentication failed');
    });
}

/**
 * Sets up an authenticated WebSocket connection
 */
function setupConnection(
  socket: WebSocket,
  request: FastifyRequest,
  userId: string,
  sessionId: string
): void {
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
  socket.on('message', (data: Buffer) => {
    try {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
      const message = JSON.parse(data.toString());
      handleIncomingMessage(userId, sessionId, message, socket);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
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
 * Handle incoming WebSocket message
 */
/* eslint-disable max-lines-per-function */
function handleIncomingMessage(
  userId: string,
  sessionId: string,
  message: { type: string; payload?: { channel?: string } },
  socket: WebSocket
): void {
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
      // Handle subscription to specific channels
      if (payload && payload.channel) {
        const success = connectionManager.subscribeToChannel(socket, payload.channel);
        socket.send(
          JSON.stringify({
            type: success ? 'subscribed' : 'error',
            message: success
              ? `Subscribed to channel: ${payload.channel}`
              : 'Failed to subscribe to channel',
            channel: payload.channel,
            timestamp: new Date().toISOString(),
          })
        );
        logger.info('WebSocket subscription request', {
          userId,
          sessionId,
          channel: payload.channel,
          success,
        });
      } else {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Channel name is required for subscription',
            timestamp: new Date().toISOString(),
          })
        );
      }
      break;

    case 'unsubscribe':
      // Handle unsubscription from specific channels
      if (payload && payload.channel) {
        const success = connectionManager.unsubscribeFromChannel(socket, payload.channel);
        socket.send(
          JSON.stringify({
            type: success ? 'unsubscribed' : 'error',
            message: success
              ? `Unsubscribed from channel: ${payload.channel}`
              : 'Failed to unsubscribe from channel',
            channel: payload.channel,
            timestamp: new Date().toISOString(),
          })
        );
        logger.info('WebSocket unsubscription request', {
          userId,
          sessionId,
          channel: payload.channel,
          success,
        });
      } else {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Channel name is required for unsubscription',
            timestamp: new Date().toISOString(),
          })
        );
      }
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
