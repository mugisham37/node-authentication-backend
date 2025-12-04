import type {
  INotificationChannel,
  NotificationPayload,
  NotificationResult,
} from './notification-channel.interface.js';
import type { ISMSService } from '../../../application/services/sms.service.js';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * SMS Notification Channel
 * Sends notifications via SMS
 */
export class SMSChannel implements INotificationChannel {
  readonly name = 'sms';
  readonly type = 'sms';

  constructor(private smsService: ISMSService) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      // Validate recipient phone number
      if (!this.validateRecipient(payload.recipient)) {
        throw new Error(`Invalid phone number: ${payload.recipient}`);
      }

      // Send SMS
      await this.smsService.sendSMS({
        to: payload.recipient,
        message: payload.message,
      });

      logger.info('SMS notification sent', {
        channel: this.name,
        recipient: payload.recipient,
      });

      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send SMS notification', {
        channel: this.name,
        recipient: payload.recipient,
        error,
      });

      return {
        success: false,
        error: error as Error,
        timestamp: new Date(),
      };
    }
  }

  validateRecipient(recipient: string): boolean {
    // Validate E.164 phone number format
    return this.smsService.validatePhoneNumber(recipient);
  }

  async isHealthy(): Promise<boolean> {
    try {
      // SMS service is healthy if it's initialized
      // Could add more sophisticated health checks here
      await Promise.resolve();
      return true;
    } catch (error) {
      logger.error('SMS channel health check failed', { error });
      return false;
    }
  }
}
