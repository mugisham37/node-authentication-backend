/**
 * SMS Service Interface
 * Handles sending SMS messages for MFA and security notifications
 */

export interface SendSMSInput {
  to: string; // E.164 format phone number
  message: string;
}

export interface SendVerificationCodeInput {
  to: string;
  code: string;
  expiryMinutes: number;
}

export interface SendMFACodeInput {
  to: string;
  code: string;
  expiryMinutes: number;
}

export interface SendSecurityAlertSMSInput {
  to: string;
  alertType: string;
  alertMessage: string;
  timestamp: string;
  location: string;
  securityUrl: string;
}

export interface ISMSService {
  /**
   * Send an SMS message
   */
  sendSMS(input: SendSMSInput): Promise<void>;

  /**
   * Send verification code SMS
   */
  sendVerificationCode(input: SendVerificationCodeInput): Promise<void>;

  /**
   * Send MFA code SMS
   */
  sendMFACode(input: SendMFACodeInput): Promise<void>;

  /**
   * Send security alert SMS
   */
  sendSecurityAlert(input: SendSecurityAlertSMSInput): Promise<void>;

  /**
   * Validate phone number format (E.164)
   */
  validatePhoneNumber(phoneNumber: string): boolean;
}
