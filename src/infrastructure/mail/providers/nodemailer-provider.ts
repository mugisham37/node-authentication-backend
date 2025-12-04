import nodemailer, { Transporter } from 'nodemailer';
import type { SendEmailInput } from '../../../application/services/email.service.js';
import { logger } from '../../../infrastructure/logging/logger.js';

export interface NodemailerConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class NodemailerProvider {
  private transporter: Transporter;
  private fromAddress: string;

  constructor(config: NodemailerConfig) {
    this.fromAddress = config.from;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });

    logger.info('Nodemailer provider initialized', {
      host: config.host,
      port: config.port,
      secure: config.secure,
    });
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const info: { messageId: string } = await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text || this.htmlToText(input.html),
      });

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: input.to,
        subject: input.subject,
      });
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        to: input.to,
        subject: input.subject,
      });
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email connection verified');
      return true;
    } catch (error) {
      logger.error('Email connection verification failed', { error });
      return false;
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
