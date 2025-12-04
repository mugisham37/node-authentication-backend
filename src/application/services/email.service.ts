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
  dashboardUrl?: string;
}

export interface PasswordChangedEmailInput {
  to: string;
  name: string;
  timestamp: string;
  ipAddress: string;
  location: string;
  deviceName: string;
  securityUrl?: string;
}

export interface MFAEnabledEmailInput {
  to: string;
  name: string;
  mfaType: string;
  timestamp: string;
  ipAddress: string;
  location: string;
  securityUrl?: string;
}

export interface MFADisabledEmailInput {
  to: string;
  name: string;
  timestamp: string;
  ipAddress: string;
  location: string;
  deviceName: string;
  mfaSetupUrl?: string;
  supportUrl?: string;
}

export interface NewDeviceLoginEmailInput {
  to: string;
  name: string;
  timestamp: string;
  ipAddress: string;
  location: string;
  deviceName: string;
  userAgent: string;
  devicesUrl?: string;
  securityUrl?: string;
}

export interface AccountLockedEmailInput {
  to: string;
  name: string;
  timestamp: string;
  reason: string;
  failedAttempts: number;
  unlockTime?: string;
  resetPasswordUrl?: string;
  supportUrl?: string;
}

export interface AccountUnlockedEmailInput {
  to: string;
  name: string;
  timestamp: string;
  unlockedBy: string;
  reason?: string;
  loginUrl?: string;
  securityUrl?: string;
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

  /**
   * Send password changed notification email
   */
  sendPasswordChanged(input: PasswordChangedEmailInput): Promise<void>;

  /**
   * Send MFA enabled notification email
   */
  sendMFAEnabled(input: MFAEnabledEmailInput): Promise<void>;

  /**
   * Send MFA disabled notification email
   */
  sendMFADisabled(input: MFADisabledEmailInput): Promise<void>;

  /**
   * Send new device login notification email
   */
  sendNewDeviceAlert(input: NewDeviceLoginEmailInput): Promise<void>;

  /**
   * Send account locked notification email
   */
  sendAccountLocked(input: AccountLockedEmailInput): Promise<void>;

  /**
   * Send account unlocked notification email
   */
  sendAccountUnlocked(input: AccountUnlockedEmailInput): Promise<void>;
}
