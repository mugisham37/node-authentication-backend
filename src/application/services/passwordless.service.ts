/**
 * Result of magic link verification
 */
export interface MagicLinkVerificationResult {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface IPasswordlessService {
  sendMagicLink(email: string): Promise<void>;
  verifyMagicLink(token: string): Promise<MagicLinkVerificationResult>;
}
