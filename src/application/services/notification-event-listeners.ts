import { domainEventEmitter } from '../../domain/events/event-emitter.js';
import { DeviceRegisteredEvent } from '../../domain/events/device-events.js';
import { PasswordChangedEvent } from '../../domain/events/user-events.js';
import { MFAEnabledEvent, MFADisabledEvent } from '../../domain/events/mfa-events.js';
import { SessionRevokedEvent, SessionCreatedEvent } from '../../domain/events/session-events.js';
import { AccountLockedEvent, AccountUnlockedEvent } from '../../domain/events/user-events.js';
import { notificationService } from './notification.service.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Sets up event listeners for domain events to trigger real-time notifications
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */
export function setupNotificationEventListeners(): void {
  // Listen for new session creation (new device login)
  // Requirement: 17.1
  domainEventEmitter.on('session.created', async (event: SessionCreatedEvent) => {
    try {
      // Notify other sessions about new device login
      await notificationService.notifyNewDeviceLogin(
        event.userId,
        event.sessionId,
        'New Device', // Device name would be enriched from session metadata
        null, // Location would be enriched from session metadata
        event.ipAddress
      );
    } catch (error) {
      logger.error('Error handling session.created event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for new device registrations
  // Requirement: 17.1
  domainEventEmitter.on('device.registered', (event: DeviceRegisteredEvent) => {
    try {
      // This event is for device tracking, session.created handles the notification
      logger.debug('Device registered', {
        deviceId: event.deviceId,
        userId: event.userId,
        deviceName: event.deviceName,
      });
    } catch (error) {
      logger.error('Error handling device.registered event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for password changes
  // Requirement: 17.2
  domainEventEmitter.on('user.password_changed', async (event: PasswordChangedEvent) => {
    try {
      await notificationService.notifyPasswordChanged(event.userId);
    } catch (error) {
      logger.error('Error handling user.password_changed event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for MFA enabled
  // Requirement: 17.3
  domainEventEmitter.on('user.mfa_enabled', async (event: MFAEnabledEvent) => {
    try {
      await notificationService.notifyMFAEnabled(event.userId, event.mfaType);
    } catch (error) {
      logger.error('Error handling user.mfa_enabled event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for MFA disabled
  // Requirement: 17.3
  domainEventEmitter.on('user.mfa_disabled', async (event: MFADisabledEvent) => {
    try {
      await notificationService.notifyMFADisabled(event.userId);
    } catch (error) {
      logger.error('Error handling user.mfa_disabled event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for session revocations
  // Requirement: 17.4
  domainEventEmitter.on('session.revoked', async (event: SessionRevokedEvent) => {
    try {
      // Notify user about session revocation
      // Device name is passed through the notification service which will handle it
      await notificationService.notifySessionRevoked(
        event.userId,
        event.sessionId,
        'Session' // Generic name since session is already revoked
      );
    } catch (error) {
      logger.error('Error handling session.revoked event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for account locked events
  domainEventEmitter.on('user.account_locked', async (event: AccountLockedEvent) => {
    try {
      await notificationService.notifyAccountLocked(event.userId, event.reason);
    } catch (error) {
      logger.error('Error handling user.account_locked event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  // Listen for account unlocked events
  domainEventEmitter.on('user.account_unlocked', async (event: AccountUnlockedEvent) => {
    try {
      await notificationService.notifyAccountUnlocked(event.userId);
    } catch (error) {
      logger.error('Error handling user.account_unlocked event for notifications', {
        eventId: event.eventId,
        userId: event.userId,
        error,
      });
    }
  });

  logger.info('Notification event listeners registered');
}
