/**
 * Notification Provider Interface
 * Defines the contract for notification delivery providers
 */

export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  region?: string;
  endpoint?: string;
  [key: string]: unknown;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface INotificationProvider {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Send a notification
   */
  send(recipient: string, message: string, options?: Record<string, unknown>): Promise<SendResult>;

  /**
   * Verify provider connection/credentials
   */
  verify(): Promise<boolean>;
}
