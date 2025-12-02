import { SocketStream } from '@fastify/websocket';
import { logger } from '../../core/logging/logger.js';

/**
 * Represents a WebSocket connection with associated metadata
 */
export interface WebSocketConnection {
  socket: SocketStream;
  userId: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * Manages WebSocket connections for real-time notifications
 * Requirement: 17.4
 */
export class ConnectionManager {
  private connections: Map<string, WebSocketConnection[]> = new Map();
  private socketToUser: Map<SocketStream, string> = new Map();

  /**
   * Adds a new WebSocket connection for a user
   */
  addConnection(userId: string, sessionId: string, socket: SocketStream): void {
    const connection: WebSocketConnection = {
      socket,
      userId,
      sessionId,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    const userConnections = this.connections.get(userId) || [];
    userConnections.push(connection);
    this.connections.set(userId, userConnections);
    this.socketToUser.set(socket, userId);

    logger.info('WebSocket connection added', {
      userId,
      sessionId,
      totalConnections: userConnections.length,
    });

    // Set up socket close handler
    socket.on('close', () => {
      this.removeConnection(socket);
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error', { userId, sessionId, error });
      this.removeConnection(socket);
    });
  }

  /**
   * Removes a WebSocket connection
   */
  removeConnection(socket: SocketStream): void {
    const userId = this.socketToUser.get(socket);
    if (!userId) {
      return;
    }

    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const index = userConnections.findIndex((conn) => conn.socket === socket);
      if (index !== -1) {
        userConnections.splice(index, 1);
      }

      if (userConnections.length === 0) {
        this.connections.delete(userId);
      } else {
        this.connections.set(userId, userConnections);
      }
    }

    this.socketToUser.delete(socket);

    logger.info('WebSocket connection removed', {
      userId,
      remainingConnections: userConnections?.length || 0,
    });
  }

  /**
   * Gets all connections for a specific user
   */
  getUserConnections(userId: string): WebSocketConnection[] {
    return this.connections.get(userId) || [];
  }

  /**
   * Gets all connections except for a specific session
   */
  getUserConnectionsExceptSession(userId: string, excludeSessionId: string): WebSocketConnection[] {
    const connections = this.getUserConnections(userId);
    return connections.filter((conn) => conn.sessionId !== excludeSessionId);
  }

  /**
   * Checks if a user has any active connections
   */
  hasConnections(userId: string): boolean {
    const connections = this.connections.get(userId);
    return connections !== undefined && connections.length > 0;
  }

  /**
   * Gets total number of active connections
   */
  getTotalConnections(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.length;
    }
    return total;
  }

  /**
   * Gets number of connected users
   */
  getConnectedUserCount(): number {
    return this.connections.size;
  }

  /**
   * Sends a message to all connections of a user
   */
  async sendToUser(userId: string, message: any): Promise<void> {
    const connections = this.getUserConnections(userId);
    await this.sendToConnections(connections, message);
  }

  /**
   * Sends a message to all connections of a user except a specific session
   */
  async sendToUserExceptSession(
    userId: string,
    excludeSessionId: string,
    message: any
  ): Promise<void> {
    const connections = this.getUserConnectionsExceptSession(userId, excludeSessionId);
    await this.sendToConnections(connections, message);
  }

  /**
   * Sends a message to specific connections
   */
  private async sendToConnections(connections: WebSocketConnection[], message: any): Promise<void> {
    const messageStr = JSON.stringify(message);

    const sendPromises = connections.map(async (connection) => {
      try {
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.send(messageStr);
          connection.lastActivity = new Date();
        }
      } catch (error) {
        logger.error('Error sending WebSocket message', {
          userId: connection.userId,
          sessionId: connection.sessionId,
          error,
        });
        // Remove failed connection
        this.removeConnection(connection.socket);
      }
    });

    await Promise.allSettled(sendPromises);
  }

  /**
   * Closes all connections for a user
   */
  closeUserConnections(userId: string): void {
    const connections = this.getUserConnections(userId);
    connections.forEach((connection) => {
      try {
        connection.socket.close();
      } catch (error) {
        logger.error('Error closing WebSocket connection', {
          userId,
          sessionId: connection.sessionId,
          error,
        });
      }
    });
  }

  /**
   * Closes all connections
   */
  closeAllConnections(): void {
    for (const userId of this.connections.keys()) {
      this.closeUserConnections(userId);
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
