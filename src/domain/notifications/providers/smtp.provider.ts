import type {
  INotificationProvider,
  ProviderConfig,
  SendResult,
} from './notification-provider.interface.js';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * SMTP Email Provider
 * Sends emails using SMTP protocol via Nodemailer
 */
export class SMTPProvider implements INotificationProvider {
  readonly name = 'smtp';
  private transporter: Transporter | null = null;
  private config: ProviderConfig | null = null;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;

    this.transporter = nodemailer.createTransport({
      host: config['host'] as string,
      port: config['port'] as number,
      secure: config['secure'] as boolean,
      auth: {
        user: config['user'] as string,
        pass: config['pass'] as string,
      },
    });

    await Promise.resolve();

    logger.info('SMTP provider initialized', {
      host: config['host'],
      port: config['port'],
    });
  }

  async send(
    recipient: string,
    message: string,
    options?: Record<string, unknown>
  ): Promise<SendResult> {
    if (!this.transporter) {
      throw new Error('SMTP provider not initialized');
    }

    try {
      const info = await this.transporter.sendMail({
        from: (options?.['from'] as string) || (this.config?.['from'] as string),
        to: recipient,
        subject: (options?.['subject'] as string) || 'Notification',
        html: message,
        text: options?.['text'] as string,
      });

      logger.info('Email sent via SMTP', {
        messageId: info.messageId as string,
        recipient,
      });

      return {
        success: true,
        messageId: info.messageId as string,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send email via SMTP', {
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
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('SMTP verification failed', { error });
      return false;
    }
  }
}
