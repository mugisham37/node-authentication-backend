/**
 * Webhook Delivery Service Interface
 * Handles async webhook event delivery with retry logic
 */

export interface WebhookEvent {
  type: string;
  payload: Record<string, unknown>;
  webhookId: string;
  webhookUrl: string;
  secret: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  attemptCount: number;
}

export interface IWebhookDeliveryService {
  /**
   * Publish webhook event for async delivery
   */
  publishEvent(event: WebhookEvent): Promise<void>;

  /**
   * Deliver webhook immediately (used by worker)
   */
  deliverWebhook(event: WebhookEvent, attemptCount: number): Promise<WebhookDeliveryResult>;

  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload: string, secret: string): string;
}
