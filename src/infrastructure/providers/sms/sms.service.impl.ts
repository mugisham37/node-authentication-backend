import { Twilio } from 'twilio';
import type { ISMSService, SendSMSInput } from '../../../application/services/sms.service.js';
import { log as logger } from '../../logging/logger.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class SMSService implements ISMSService {
  private twilioClient: Twilio;
  private fromNumber: string;
  private maxRetries: number = 3;

  constructor(config: TwilioConfig) {
    this.twilioClient = new Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;

    logger.info('SMS service initialized', {
      fromNumber: config.fromNumber,
    });
  }

  async sendSMS(input: SendSMSInput): Promise<void> {
    if (!this.validatePhoneNumber(input.to)) {
      throw new Error(`Invalid phone number format: ${input.to}`);
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const message = await this.twilioClient.messages.create({
          body: input.message,
          from: this.fromNumber,
          to: input.to,
        });

        logger.info('SMS sent successfully', {
          messageSid: message.sid,
          to: input.to,
          attempt,
        });

        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn('SMS send attempt failed', {
          error,
          to: input.to,
          attempt,
          maxRetries: this.maxRetries,
        });

        if (attempt < this.maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const delayMs = Math.pow(2, attempt) * 1000;
          await this.delay(delayMs);
        }
      }
    }

    logger.error(
      'Failed to send SMS after all retries',
      lastError || new Error('Failed to send SMS'),
      {
        to: input.to,
        attempts: this.maxRetries,
      }
    );

    throw lastError || new Error('Failed to send SMS');
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[country code][number]
    // Example: +14155552671
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
