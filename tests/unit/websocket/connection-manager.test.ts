import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../../src/presentation/websocket/connection-manager.js';
import type WebSocket from 'ws';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockSocket: Partial<WebSocket>;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockSocket = {
      readyState: 1, // OPEN
      OPEN: 1,
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };
  });

  it('should add a new connection for a user', () => {
    const userId = 'user-123';
    const sessionId = 'session-456';

    connectionManager.addConnection(userId, sessionId, mockSocket as WebSocket);

    expect(connectionManager.hasConnections(userId)).toBe(true);
    expect(connectionManager.getTotalConnections()).toBe(1);
  });

  it('should send message to all user connections', async () => {
    const userId = 'user-123';
    const sessionId = 'session-456';
    const message = { type: 'test', data: 'hello' };

    connectionManager.addConnection(userId, sessionId, mockSocket as WebSocket);
    await connectionManager.sendToUser(userId, message);

    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it('should subscribe a connection to a channel', () => {
    const userId = 'user-123';
    const sessionId = 'session-456';
    const channel = 'security-alerts';

    connectionManager.addConnection(userId, sessionId, mockSocket as WebSocket);
    const success = connectionManager.subscribeToChannel(mockSocket as WebSocket, channel);

    expect(success).toBe(true);
    const connections = connectionManager.getUserConnections(userId);
    expect(connections[0].subscribedChannels.has(channel)).toBe(true);
  });
});
