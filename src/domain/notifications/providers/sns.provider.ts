import type {
  INotificationProvider,
  ProviderConfig,
  SendResult,
} from './notification-provider.interface.js';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * AWS SNS SMS Provider (Optional)
 * Sends SMS messages using Amazon Simple Notification Service
 */
export class SNSProvider implements INotificationProvider {
  readonly name = 'sns';
  private client: SNSClient | null = null;

  async initialize(config: ProviderConfig): Promise<void> {
    this.client = new SNSClient({
      region: (config.region as string) || 'us-east-1',
      credentials: config.credentials as any,
    });

    logger.info('SNS provider initialized', {
      region: config.region,
    });
  }

  async send(
    recipient: string,
    message: string,
    options?: Record<string, unknown>
  ): Promise<SendResult> {
    if (!this.client) {
      throw new Error('SNS provider not initialized');
    }

    try {
      const command = new PublishCommand({
        PhoneNumber: recipient,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: (options?.smsType as string) || 'Transactional',
          },
        },
      });

      const response = await this.client.send(command);

      logger.info('SMS sent via SNS', {
        messageId: response.MessageId,
        recipient,
      });

      return {
        success: true,
        messageId: response.MessageId,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send SMS via SNS', {
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
      // Could add SNS verification logic here
      return true;
    } catch (error) {
      logger.error('SNS verification failed', { error });
      return false;
    }
  }
}
