/**
 * Notification Channel Interface
 * Defines the contract for all notification delivery channels
 */

export interface NotificationPayload {
  recipient: string;
  subject?: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: Error;
  timestamp: Date;
}

export interface INotificationChannel {
  /**
   * Channel name identifier
   */
  readonly name: string;

  /**
   * Channel type (email, sms, push, webhook, etc.)
   */
  readonly type: string;

  /**
   * Send a notification through this channel
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Validate if the recipient is valid for this channel
   */
  validateRecipient(recipient: string): boolean;

  /**
   * Check if the channel is available/healthy
   */
  isHealthy(): Promise<boolean>;
}
