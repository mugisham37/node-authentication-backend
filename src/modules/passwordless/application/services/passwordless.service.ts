export interface IPasswordlessService {
  sendMagicLink(email: string): Promise<void>;
  verifyMagicLink(token: string): Promise<any>;
}
