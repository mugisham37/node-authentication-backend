/**
 * Email Service Interface
 * Handles sending emails for various authentication and security events
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface VerificationEmailInput {
  to: string;
  name: string;
  verificationToken: string;
  verificationUrl: string;
}

export interface PasswordResetEmailInput {
  to: string;
  name: string;
  resetToken: string;
  resetUrl: string;
}

export interface SecurityAlertEmailInput {
  to: string;
  name: string;
  alertType: string;
  alertMessage: string;
  timestamp: Date;
  ipAddress?: string;
  location?: string;
}

export interface WelcomeEmailInput {
  to: string;
  name: string;
}

export interface IEmailService {
  /**
   * Send a generic email
   */
  sendEmail(input: SendEmailInput): Promise<void>;

  /**
   * Send email verification email
   */
  sendVerificationEmail(input: VerificationEmailInput): Promise<void>;

  /**
   * Send password reset email
   */
  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void>;

  /**
   * Send security alert email
   */
  sendSecurityAlertEmail(input: SecurityAlertEmailInput): Promise<void>;

  /**
   * Send welcome email
   */
  sendWelcomeEmail(input: WelcomeEmailInput): Promise<void>;
}
