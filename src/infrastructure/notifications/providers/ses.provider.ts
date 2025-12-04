import type {
  INotificationProvider,
  ProviderConfig,
  SendResult,
} from './notification-provider.interface.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * AWS SES Email Provider (Optional)
 * Sends emails using Amazon Simple Email Service
 */
export class SESProvider implements INotificationProvider {
  readonly name = 'ses';
  private client: SESClient | null = null;
  private fromEmail: string | null = null;

  async initialize(config: ProviderConfig): Promise<void> {
    this.fromEmail = config.fromEmail as string;

    if (!this.fromEmail) {
      throw new Error('SES provider requires fromEmail');
    }

    this.client = new SESClient({
      region: (config.region as string) || 'us-east-1',
      credentials: config.credentials as any,
    });

    logger.info('SES provider initialized', {
      region: config.region,
      fromEmail: this.fromEmail,
    });
  }

  async send(
    recipient: string,
    message: string,
    options?: Record<string, unknown>
  ): Promise<SendResult> {
    if (!this.client || !this.fromEmail) {
      throw new Error('SES provider not initialized');
    }

    try {
      const command = new SendEmailCommand({
        Source: (options?.from as string) || this.fromEmail,
        Destination: {
          ToAddresses: [recipient],
        },
        Message: {
          Subject: {
            Data: (options?.subject as string) || 'Notification',
          },
          Body: {
            Html: {
              Data: message,
            },
            Text: {
              Data: (options?.text as string) || message,
            },
          },
        },
      });

      const response = await this.client.send(command);

      logger.info('Email sent via SES', {
        messageId: response.MessageId,
        recipient,
      });

      return {
        success: true,
        messageId: response.MessageId,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send email via SES', {
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
    if (!this.client) {
      return false;
    }

    try {
      // Could add SES verification logic here
      return true;
    } catch (error) {
      logger.error('SES verification failed', { error });
      return false;
    }
  }
}
