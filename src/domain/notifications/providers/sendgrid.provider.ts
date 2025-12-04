import type {
  INotificationProvider,
  ProviderConfig,
  SendResult,
} from './notification-provider.interface.js';
import sgMail from '@sendgrid/mail';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * SendGrid Email Provider (Optional)
 * Sends emails using SendGrid API
 */
export class SendGridProvider implements INotificationProvider {
  readonly name = 'sendgrid';
  private fromEmail: string | null = null;
  private initialized = false;

  async initialize(config: ProviderConfig): Promise<void> {
    const apiKey = config.apiKey as string;
    this.fromEmail = config.fromEmail as string;

    if (!apiKey || !this.fromEmail) {
      throw new Error('SendGrid provider requires apiKey and fromEmail');
    }

    sgMail.setApiKey(apiKey);
    this.initialized = true;

    logger.info('SendGrid provider initialized', {
      fromEmail: this.fromEmail,
    });
  }

  async send(
    recipient: string,
    message: string,
    options?: Record<string, unknown>
  ): Promise<SendResult> {
    if (!this.initialized || !this.fromEmail) {
      throw new Error('SendGrid provider not initialized');
    }

    try {
      const msg = {
        to: recipient,
        from: (options?.from as string) || this.fromEmail,
        subject: (options?.subject as string) || 'Notification',
        html: message,
        text: options?.text as string,
      };

      const [response] = await sgMail.send(msg);

      logger.info('Email sent via SendGrid', {
        messageId: response.headers['x-message-id'],
        recipient,
      });

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send email via SendGrid', {
        error,
        recipient,
      });

      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  async verify(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // SendGrid doesn't have a simple verify endpoint
      // We'll just check if it's initialized
      return true;
    } catch (error) {
      logger.error('SendGrid verification failed', { error });
      return false;
    }
  }
}
