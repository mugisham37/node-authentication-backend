import type {
  INotificationProvider,
  ProviderConfig,
  SendResult,
} from './notification-provider.interface.js';
import { Twilio } from 'twilio';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * Twilio SMS Provider
 * Sends SMS messages using Twilio API
 */
export class TwilioProvider implements INotificationProvider {
  readonly name = 'twilio';
  private client: Twilio | null = null;
  private fromNumber: string | null = null;

  async initialize(config: ProviderConfig): Promise<void> {
    const accountSid = config['accountSid'] as string;
    const authToken = config['authToken'] as string;
    this.fromNumber = config['fromNumber'] as string;

    if (!accountSid || !authToken || !this.fromNumber) {
      throw new Error('Twilio provider requires accountSid, authToken, and fromNumber');
    }

    this.client = new Twilio(accountSid, authToken);

    await Promise.resolve();

    logger.info('Twilio provider initialized', {
      fromNumber: this.fromNumber,
    });
  }

  async send(
    recipient: string,
    message: string,
    options?: Record<string, unknown>
  ): Promise<SendResult> {
    if (!this.client || !this.fromNumber) {
      throw new Error('Twilio provider not initialized');
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: (options?.['from'] as string) || this.fromNumber,
        to: recipient,
      });

      logger.info('SMS sent via Twilio', {
        messageSid: result.sid,
        recipient,
      });

      return {
        success: true,
        messageId: result.sid,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send SMS via Twilio', {
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
      // Verify by fetching account details
      await this.client.api.accounts.list({ limit: 1 });
      return true;
    } catch (error) {
      logger.error('Twilio verification failed', { error });
      return false;
    }
  }
}
