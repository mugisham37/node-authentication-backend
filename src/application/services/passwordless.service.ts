/**
 * Result of magic link verification
 */
export interface MagicLinkVerificationResult {
  userId: string;
  email: string;
  isValid: boolean;
}

export interface IPasswordlessService {
  sendMagicLink(email: string): Promise<void>;
  verifyMagicLink(token: string): Promise<MagicLinkVerificationResult>;
}
