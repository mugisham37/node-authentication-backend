import type {
  IEmailService,
  SendEmailInput,
  VerificationEmailInput,
  PasswordResetEmailInput,
  SecurityAlertEmailInput,
  WelcomeEmailInput,
} from '../application/services/email.service.js';
import { NodemailerProvider } from '../../core/mail/providers/nodemailer-provider.js';
import { TemplateRenderer } from '../../core/mail/providers/template-renderer.js';
import { EmailQueue } from '../../core/queue/email-queue.js';
import { logger } from '../logging/logger.js';

export class EmailService implements IEmailService {
  private nodemailerProvider: NodemailerProvider;
  private templateRenderer: TemplateRenderer;
  private emailQueue: EmailQueue;
  private useQueue: boolean;

  constructor(
    nodemailerProvider: NodemailerProvider,
    templateRenderer: TemplateRenderer,
    emailQueue: EmailQueue,
    useQueue: boolean = true
  ) {
    this.nodemailerProvider = nodemailerProvider;
    this.templateRenderer = templateRenderer;
    this.emailQueue = emailQueue;
    this.useQueue = useQueue;

    logger.info('Email service initialized', { useQueue });
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    if (this.useQueue) {
      await this.emailQueue.addEmailJob(input);
    } else {
      await this.nodemailerProvider.sendEmail(input);
    }
  }

  async sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    try {
      const html = this.templateRenderer.render('verification-email', {
        name: input.name,
        verificationUrl: input.verificationUrl,
      });

      const text = this.templateRenderer.renderToText(html);

      await this.sendEmail({
        to: input.to,
        subject: 'Verify Your Email Address',
        html,
        text,
      });

      logger.info('Verification email queued', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send verification email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    try {
      const html = this.templateRenderer.render('password-reset', {
        name: input.name,
        resetUrl: input.resetUrl,
      });

      const text = this.templateRenderer.renderToText(html);

      await this.sendEmail({
        to: input.to,
        subject: 'Reset Your Password',
        html,
        text,
      });

      logger.info('Password reset email queued', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendSecurityAlertEmail(input: SecurityAlertEmailInput): Promise<void> {
    try {
      const html = this.templateRenderer.render('security-alert', {
        name: input.name,
        alertType: input.alertType,
        alertMessage: input.alertMessage,
        timestamp: input.timestamp.toLocaleString(),
        ipAddress: input.ipAddress,
        location: input.location,
      });

      const text = this.templateRenderer.renderToText(html);

      await this.sendEmail({
        to: input.to,
        subject: `Security Alert: ${input.alertType}`,
        html,
        text,
      });

      logger.info('Security alert email queued', {
        to: input.to,
        alertType: input.alertType,
      });
    } catch (error) {
      logger.error('Failed to send security alert email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
    try {
      const html = this.templateRenderer.render('welcome', {
        name: input.name,
      });

      const text = this.templateRenderer.renderToText(html);

      await this.sendEmail({
        to: input.to,
        subject: 'Welcome to Our Platform!',
        html,
        text,
      });

      logger.info('Welcome email queued', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send welcome email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    return this.nodemailerProvider.verifyConnection();
  }

  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return this.emailQueue.getQueueMetrics();
  }
}
