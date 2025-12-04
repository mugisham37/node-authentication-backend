import type {
  INotificationChannel,
  NotificationPayload,
  NotificationResult,
} from './notification-channel.interface.js';
import type { IEmailService } from '../../../application/services/email.service.js';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * Email Notification Channel
 * Sends notifications via email
 */
export class EmailChannel implements INotificationChannel {
  readonly name = 'email';
  readonly type = 'email';

  constructor(private emailService: IEmailService) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      // Validate recipient email
      if (!this.validateRecipient(payload.recipient)) {
        throw new Error(`Invalid email address: ${payload.recipient}`);
      }

      // Send email
      await this.emailService.sendEmail({
        to: payload.recipient,
        subject: payload.subject || 'Notification',
        html: payload.message,
        text: payload.message,
      });

      logger.info('Email notification sent', {
        channel: this.name,
        recipient: payload.recipient,
        subject: payload.subject,
      });

      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send email notification', {
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
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient);
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check if email service is available
      // Note: verifyConnection may not be available on all email service implementations
      if ('verifyConnection' in this.emailService && typeof this.emailService.verifyConnection === 'function') {
        return await (this.emailService as any).verifyConnection();
      }
      return true;
    } catch (error) {
      logger.error('Email channel health check failed', { error });
      return false;
    }
  }
}
