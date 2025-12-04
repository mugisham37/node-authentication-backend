import { Twilio } from 'twilio';
import type {
  ISMSService,
  SendSMSInput,
  SendVerificationCodeInput,
  SendMFACodeInput,
  SendSecurityAlertSMSInput,
} from '../../../application/services/sms.service.js';
import { TemplateService } from '../../../application/services/template.service.js';
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
  private templateService: TemplateService;

  constructor(config: TwilioConfig, templateService: TemplateService) {
    this.twilioClient = new Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
    this.templateService = templateService;

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

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    try {
      const message = this.templateService.renderSMS({
        templateName: 'verification-code',
        data: {
          code: input.code,
          expiryMinutes: input.expiryMinutes,
        },
      });

      await this.sendSMS({
        to: input.to,
        message,
      });

      logger.info('Verification code SMS sent', {
        to: input.to,
      });
    } catch (error) {
      logger.error('Failed to send verification code SMS', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendMFACode(input: SendMFACodeInput): Promise<void> {
    try {
      const message = this.templateService.renderSMS({
        templateName: 'mfa-code',
        data: {
          code: input.code,
          expiryMinutes: input.expiryMinutes,
        },
      });

      await this.sendSMS({
        to: input.to,
        message,
      });

      logger.info('MFA code SMS sent', {
        to: input.to,
      });
    } catch (error) {
      logger.error('Failed to send MFA code SMS', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendSecurityAlert(input: SendSecurityAlertSMSInput): Promise<void> {
    try {
      const message = this.templateService.renderSMS({
        templateName: 'security-alert',
        data: {
          alertType: input.alertType,
          alertMessage: input.alertMessage,
          timestamp: input.timestamp,
          location: input.location,
          securityUrl: input.securityUrl,
        },
      });

      await this.sendSMS({
        to: input.to,
        message,
      });

      logger.info('Security alert SMS sent', {
        to: input.to,
        alertType: input.alertType,
      });
    } catch (error) {
      logger.error('Failed to send security alert SMS', {
        error,
        to: input.to,
      });
      throw error;
    }
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
