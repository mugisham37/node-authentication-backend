import type WebSocket from 'ws';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * Represents a WebSocket connection with associated metadata
 */
export interface WebSocketConnection {
  socket: WebSocket;
  userId: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscribedChannels: Set<string>;
}

/**
 * Manages WebSocket connections for real-time notifications
 * Requirement: 17.4
 */
export class ConnectionManager {
  private connections: Map<string, WebSocketConnection[]> = new Map();
  private socketToUser: Map<WebSocket, string> = new Map();

  /**
   * Adds a new WebSocket connection for a user
   */
  addConnection(userId: string, sessionId: string, socket: WebSocket): void {
    const connection: WebSocketConnection = {
      socket,
      userId,
      sessionId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscribedChannels: new Set(['notifications']), // Default subscription
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
  removeConnection(socket: WebSocket): void {
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
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
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
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    message: any
  ): Promise<void> {
    const connections = this.getUserConnectionsExceptSession(userId, excludeSessionId);
    await this.sendToConnections(connections, message);
  }

  /**
   * Sends a message to specific connections
   */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  private async sendToConnections(connections: WebSocketConnection[], message: any): Promise<void> {
    const messageStr = JSON.stringify(message);

    /* eslint-disable-next-line @typescript-eslint/require-await */
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

  /**
   * Subscribes a connection to a channel
   */
  subscribeToChannel(socket: WebSocket, channel: string): boolean {
    const userId = this.socketToUser.get(socket);
    if (!userId) {
      return false;
    }

    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return false;
    }

    const connection = userConnections.find((conn) => conn.socket === socket);
    if (!connection) {
      return false;
    }

    connection.subscribedChannels.add(channel);
    logger.info('WebSocket subscribed to channel', {
      userId,
      sessionId: connection.sessionId,
      channel,
    });

    return true;
  }

  /**
   * Unsubscribes a connection from a channel
   */
  unsubscribeFromChannel(socket: WebSocket, channel: string): boolean {
    const userId = this.socketToUser.get(socket);
    if (!userId) {
      return false;
    }

    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return false;
    }

    const connection = userConnections.find((conn) => conn.socket === socket);
    if (!connection) {
      return false;
    }

    connection.subscribedChannels.delete(channel);
    logger.info('WebSocket unsubscribed from channel', {
      userId,
      sessionId: connection.sessionId,
      channel,
    });

    return true;
  }

  /**
   * Sends a message to all connections subscribed to a specific channel
   */
  async sendToChannel(
    channel: string,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    message: any
  ): Promise<void> {
    const messageStr = JSON.stringify(message);
    const sendPromises: Promise<void>[] = [];

    for (const userConnections of this.connections.values()) {
      for (const connection of userConnections) {
        if (connection.subscribedChannels.has(channel)) {
          sendPromises.push(
            /* eslint-disable-next-line @typescript-eslint/require-await */
            (async () => {
              try {
                if (connection.socket.readyState === connection.socket.OPEN) {
                  connection.socket.send(messageStr);
                  connection.lastActivity = new Date();
                }
              } catch (error) {
                logger.error('Error sending message to channel subscriber', {
                  userId: connection.userId,
                  sessionId: connection.sessionId,
                  channel,
                  error,
                });
                this.removeConnection(connection.socket);
              }
            })()
          );
        }
      }
    }

    await Promise.allSettled(sendPromises);
  }

  /**
   * Gets all connections subscribed to a specific channel
   */
  getChannelSubscribers(channel: string): WebSocketConnection[] {
    const subscribers: WebSocketConnection[] = [];

    for (const userConnections of this.connections.values()) {
      for (const connection of userConnections) {
        if (connection.subscribedChannels.has(channel)) {
          subscribers.push(connection);
        }
      }
    }

    return subscribers;
  }

  /**
   * Gets the number of subscribers for a channel
   */
  getChannelSubscriberCount(channel: string): number {
    return this.getChannelSubscribers(channel).length;
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
