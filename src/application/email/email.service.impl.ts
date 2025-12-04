import type {
  IEmailService,
  SendEmailInput,
  VerificationEmailInput,
  PasswordResetEmailInput,
  SecurityAlertEmailInput,
  WelcomeEmailInput,
  PasswordChangedEmailInput,
  MFAEnabledEmailInput,
  MFADisabledEmailInput,
  NewDeviceLoginEmailInput,
  AccountLockedEmailInput,
  AccountUnlockedEmailInput,
} from '../../application/services/email.service.js';
import { NodemailerProvider } from '../../shared/mail/providers/nodemailer-provider.js';
import { TemplateService } from '../../application/services/template.service.js';
import { EmailQueue } from '../../infrastructure/queue/email-queue.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class EmailService implements IEmailService {
  private nodemailerProvider: NodemailerProvider;
  private templateService: TemplateService;
  private emailQueue!: EmailQueue;

  constructor(
    nodemailerProvider: NodemailerProvider,
    templateService: TemplateService,
    emailQueue: EmailQueue | null
  ) {
    this.nodemailerProvider = nodemailerProvider;
    this.templateService = templateService;
    if (emailQueue) {
      this.emailQueue = emailQueue;
    }

    logger.info('Email service initialized');
  }

  setEmailQueue(emailQueue: EmailQueue): void {
    this.emailQueue = emailQueue;
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    // For generic sendEmail, always send directly via nodemailer
    // Specific email types (verification, password reset, etc.) use their own queue methods
    await this.nodemailerProvider.sendEmail(input);
  }

  async sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'email-verification',
        subject: 'Verify Your Email Address',
        data: {
          name: input.name,
          verificationUrl: input.verificationUrl,
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Verification email sent', {
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
      const rendered = this.templateService.renderEmail({
        templateName: 'password-reset',
        subject: 'Reset Your Password',
        data: {
          name: input.name,
          resetUrl: input.resetUrl,
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Password reset email sent', {
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
      const rendered = this.templateService.renderEmail({
        templateName: 'security-alert',
        subject: `Security Alert: ${input.alertType}`,
        data: {
          name: input.name,
          alertType: input.alertType,
          alertMessage: input.alertMessage,
          timestamp: input.timestamp.toLocaleString(),
          ipAddress: input.ipAddress,
          location: input.location,
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Security alert email sent', {
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
      const rendered = this.templateService.renderEmail({
        templateName: 'welcome',
        subject: 'Welcome to Enterprise Auth!',
        data: {
          name: input.name,
          dashboardUrl: input.dashboardUrl || '/dashboard',
        },
        showUnsubscribe: true,
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Welcome email sent', {
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

  async sendPasswordChanged(input: PasswordChangedEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'password-changed',
        subject: 'Password Changed Successfully',
        data: {
          name: input.name,
          timestamp: input.timestamp,
          ipAddress: input.ipAddress,
          location: input.location,
          deviceName: input.deviceName,
          securityUrl: input.securityUrl || '/security',
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Password changed email sent', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send password changed email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendMFAEnabled(input: MFAEnabledEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'mfa-enabled',
        subject: 'Multi-Factor Authentication Enabled',
        data: {
          name: input.name,
          mfaType: input.mfaType,
          timestamp: input.timestamp,
          ipAddress: input.ipAddress,
          location: input.location,
          securityUrl: input.securityUrl || '/security',
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('MFA enabled email sent', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send MFA enabled email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendMFADisabled(input: MFADisabledEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'mfa-disabled',
        subject: 'Multi-Factor Authentication Disabled',
        data: {
          name: input.name,
          timestamp: input.timestamp,
          ipAddress: input.ipAddress,
          location: input.location,
          deviceName: input.deviceName,
          mfaSetupUrl: input.mfaSetupUrl || '/mfa/setup',
          supportUrl: input.supportUrl || '/support',
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('MFA disabled email sent', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send MFA disabled email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendNewDeviceAlert(input: NewDeviceLoginEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'new-device-login',
        subject: 'New Device Login Detected',
        data: {
          name: input.name,
          timestamp: input.timestamp,
          ipAddress: input.ipAddress,
          location: input.location,
          deviceName: input.deviceName,
          userAgent: input.userAgent,
          devicesUrl: input.devicesUrl || '/devices',
          securityUrl: input.securityUrl || '/security',
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('New device alert email sent', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send new device alert email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendAccountLocked(input: AccountLockedEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'account-locked',
        subject: 'Account Locked',
        data: {
          name: input.name,
          timestamp: input.timestamp,
          reason: input.reason,
          failedAttempts: input.failedAttempts,
          unlockTime: input.unlockTime,
          resetPasswordUrl: input.resetPasswordUrl || '/password/reset',
          supportUrl: input.supportUrl || '/support',
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Account locked email sent', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send account locked email', {
        error,
        to: input.to,
      });
      throw error;
    }
  }

  async sendAccountUnlocked(input: AccountUnlockedEmailInput): Promise<void> {
    try {
      const rendered = this.templateService.renderEmail({
        templateName: 'account-unlocked',
        subject: 'Account Unlocked',
        data: {
          name: input.name,
          timestamp: input.timestamp,
          unlockedBy: input.unlockedBy,
          reason: input.reason,
          loginUrl: input.loginUrl || '/login',
          securityUrl: input.securityUrl || '/security',
        },
      });

      await this.sendEmail({
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info('Account unlocked email sent', {
        to: input.to,
        name: input.name,
      });
    } catch (error) {
      logger.error('Failed to send account unlocked email', {
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
