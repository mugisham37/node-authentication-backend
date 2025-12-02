/**
 * SMS Service Interface
 * Handles sending SMS messages for MFA and security notifications
 */

export interface SendSMSInput {
  to: string; // E.164 format phone number
  message: string;
}

export interface ISMSService {
  /**
   * Send an SMS message
   */
  sendSMS(input: SendSMSInput): Promise<void>;

  /**
   * Validate phone number format (E.164)
   */
  validatePhoneNumber(phoneNumber: string): boolean;
}
