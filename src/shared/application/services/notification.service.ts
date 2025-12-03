import { connectionManager } from '../../presentation/websocket/connection-manager.js';
import { logger } from '../../logging/logger.js';

/**
 * Notification types for real-time events
 */
export enum NotificationType {
  NEW_DEVICE_LOGIN = 'new_device_login',
  PASSWORD_CHANGED = 'password_changed',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  SESSION_REVOKED = 'session_revoked',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
}

/**
 * Base notification payload
 */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  data?: Record<string, any>;
}

/**
 * Service for sending real-time notifications to users
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */
export class NotificationService {
  /**
   * Sends a notification to all active sessions of a user
   */
  async sendToUser(userId: string, notification: NotificationPayload): Promise<void> {
    try {
      // Check if user has WebSocket connections
      if (!connectionManager.hasConnections(userId)) {
        logger.debug('User has no active WebSocket connections', { userId });
        return;
      }

      // Send notification via WebSocket
      await connectionManager.sendToUser(userId, {
        type: 'notification',
        payload: notification,
      });

      logger.info('Notification sent to user', {
        userId,
        notificationType: notification.type,
      });
    } catch (error) {
      logger.error('Error sending notification to user', {
        userId,
        notificationType: notification.type,
        error,
      });
    }
  }

  /**
   * Sends a notification to all sessions except the current one
   * Requirement: 17.1 - Notify other sessions about new device login
   */
  async sendToOtherSessions(
    userId: string,
    excludeSessionId: string,
    notification: NotificationPayload
  ): Promise<void> {
    try {
      // Check if user has WebSocket connections
      if (!connectionManager.hasConnections(userId)) {
        logger.debug('User has no active WebSocket connections', { userId });
        return;
      }

      // Send notification to all sessions except the current one
      await connectionManager.sendToUserExceptSession(userId, excludeSessionId, {
        type: 'notification',
        payload: notification,
      });

      logger.info('Notification sent to other sessions', {
        userId,
        excludeSessionId,
        notificationType: notification.type,
      });
    } catch (error) {
      logger.error('Error sending notification to other sessions', {
        userId,
        excludeSessionId,
        notificationType: notification.type,
        error,
      });
    }
  }

  /**
   * Notifies user about new device login
   * Requirement: 17.1
   */
  async notifyNewDeviceLogin(
    userId: string,
    sessionId: string,
    deviceName: string,
    location: string | null,
    ipAddress: string
  ): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.NEW_DEVICE_LOGIN,
      title: 'New Device Login',
      message: `A new login was detected from ${deviceName}`,
      timestamp: new Date().toISOString(),
      data: {
        deviceName,
        location,
        ipAddress,
        sessionId,
      },
    };

    await this.sendToOtherSessions(userId, sessionId, notification);
  }

  /**
   * Notifies user about password change
   * Requirement: 17.2
   */
  async notifyPasswordChanged(userId: string): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Password Changed',
      message: 'Your password has been changed successfully',
      timestamp: new Date().toISOString(),
    };

    await this.sendToUser(userId, notification);
  }

  /**
   * Notifies user about MFA being enabled
   * Requirement: 17.3
   */
  async notifyMFAEnabled(userId: string, mfaType: 'totp' | 'sms'): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.MFA_ENABLED,
      title: 'MFA Enabled',
      message: `Multi-factor authentication (${mfaType.toUpperCase()}) has been enabled for your account`,
      timestamp: new Date().toISOString(),
      data: {
        mfaType,
      },
    };

    await this.sendToUser(userId, notification);
  }

  /**
   * Notifies user about MFA being disabled
   * Requirement: 17.3
   */
  async notifyMFADisabled(userId: string): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.MFA_DISABLED,
      title: 'MFA Disabled',
      message: 'Multi-factor authentication has been disabled for your account',
      timestamp: new Date().toISOString(),
    };

    await this.sendToUser(userId, notification);
  }

  /**
   * Notifies user about session being revoked
   * Requirement: 17.4
   */
  async notifySessionRevoked(userId: string, sessionId: string, deviceName: string): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.SESSION_REVOKED,
      title: 'Session Revoked',
      message: `Your session on ${deviceName} has been revoked`,
      timestamp: new Date().toISOString(),
      data: {
        sessionId,
        deviceName,
      },
    };

    await this.sendToUser(userId, notification);
  }

  /**
   * Notifies user about account being locked
   */
  async notifyAccountLocked(userId: string, reason: string): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.ACCOUNT_LOCKED,
      title: 'Account Locked',
      message: `Your account has been locked: ${reason}`,
      timestamp: new Date().toISOString(),
      data: {
        reason,
      },
    };

    await this.sendToUser(userId, notification);
  }

  /**
   * Notifies user about account being unlocked
   */
  async notifyAccountUnlocked(userId: string): Promise<void> {
    const notification: NotificationPayload = {
      type: NotificationType.ACCOUNT_UNLOCKED,
      title: 'Account Unlocked',
      message: 'Your account has been unlocked',
      timestamp: new Date().toISOString(),
    };

    await this.sendToUser(userId, notification);
  }
}

// Singleton instance
export const notificationService = new NotificationService();
