/**
 * Email Job Definitions
 * Requirements: 1.6, 2.1, 10.1
 */

export interface EmailVerificationJobData {
  to: string;
  name: string;
  verificationToken: string;
  verificationUrl: string;
}

export interface PasswordResetJobData {
  to: string;
  name: string;
  resetToken: string;
  resetUrl: string;
}

export interface SecurityAlertJobData {
  to: string;
  name: string;
  alertType: string;
  alertMessage: string;
  timestamp: Date;
  ipAddress?: string;
  location?: string;
}

export interface WelcomeEmailJobData {
  to: string;
  name: string;
}

export type EmailJobData =
  | EmailVerificationJobData
  | PasswordResetJobData
  | SecurityAlertJobData
  | WelcomeEmailJobData;

export const EMAIL_JOB_TYPES = {
  VERIFICATION: 'email:verification',
  PASSWORD_RESET: 'email:password-reset',
  SECURITY_ALERT: 'email:security-alert',
  WELCOME: 'email:welcome',
} as const;

export type EmailJobType = (typeof EMAIL_JOB_TYPES)[keyof typeof EMAIL_JOB_TYPES];
