import type {
  IWebhookDeliveryService,
  WebhookEvent,
  WebhookDeliveryResult,
} from '../../application/services/webhook-delivery.service.js';
import { WebhookQueue } from '../../infrastructure/queue/webhook-queue.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { HmacService } from '../../infrastructure/security/hashing/hmac.service.js';

export class WebhookDeliveryService implements IWebhookDeliveryService {
  private webhookQueue: WebhookQueue;
  private timeout: number = 30000; // 30 seconds

  constructor(webhookQueue: WebhookQueue) {
    this.webhookQueue = webhookQueue;

    logger.info('Webhook delivery service initialized');
  }

  async publishEvent(event: WebhookEvent): Promise<void> {
    try {
      await this.webhookQueue.addWebhookJob({
        webhookId: event.webhookId,
        webhookUrl: event.webhookUrl,
        webhookSecret: event.secret,
        eventType: event.type,
        payload: event.payload,
        attemptCount: 0,
      });

      logger.info('Webhook event published', {
        webhookId: event.webhookId,
        eventType: event.type,
      });
    } catch (error) {
      logger.error('Failed to publish webhook event', {
        error,
        webhookId: event.webhookId,
        eventType: event.type,
      });
      throw error;
    }
  }

  /**
   * Prepare webhook request headers
   */
  private prepareWebhookHeaders(
    signature: string,
    timestamp: number,
    eventType: string,
    attemptCount: number
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp.toString(),
      'X-Webhook-Event': eventType,
      'X-Webhook-Delivery-Attempt': attemptCount.toString(),
      'User-Agent': 'Enterprise-Auth-Webhook/1.0',
    };
  }

  /**
   * Send HTTP webhook request with timeout
   */
  private async sendWebhookHttpRequest(
    url: string,
    headers: Record<string, string>,
    body: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Handle successful webhook response
   */
  private handleSuccessResponse(
    event: WebhookEvent,
    response: Response,
    responseBody: string,
    attemptCount: number
  ): WebhookDeliveryResult {
    logger.info('Webhook delivered successfully', {
      webhookId: event.webhookId,
      eventType: event.type,
      statusCode: response.status,
      attemptCount,
    });

    return {
      success: true,
      statusCode: response.status,
      responseBody,
      attemptCount,
    };
  }

  /**
   * Handle failed webhook response
   */
  private handleErrorResponse(
    event: WebhookEvent,
    response: Response,
    responseBody: string,
    attemptCount: number
  ): WebhookDeliveryResult {
    logger.warn('Webhook delivery failed with non-2xx status', {
      webhookId: event.webhookId,
      eventType: event.type,
      statusCode: response.status,
      responseBody,
      attemptCount,
    });

    return {
      success: false,
      statusCode: response.status,
      responseBody,
      error: `HTTP ${response.status}: ${response.statusText}`,
      attemptCount,
    };
  }

  /**
   * Handle webhook exception
   */
  private handleException(
    event: WebhookEvent,
    error: unknown,
    attemptCount: number
  ): WebhookDeliveryResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Webhook delivery failed', {
      error,
      webhookId: event.webhookId,
      eventType: event.type,
      attemptCount,
    });

    return {
      success: false,
      error: errorMessage,
      attemptCount,
    };
  }

  async deliverWebhook(event: WebhookEvent, attemptCount: number): Promise<WebhookDeliveryResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const { signature } = HmacService.generateWebhookSignature(
      event.payload,
      event.secret,
      timestamp
    );

    try {
      const headers = this.prepareWebhookHeaders(signature, timestamp, event.type, attemptCount);
      const response = await this.sendWebhookHttpRequest(
        event.webhookUrl,
        headers,
        JSON.stringify(event.payload)
      );
      const responseBody = await response.text();

      if (response.ok) {
        return this.handleSuccessResponse(event, response, responseBody, attemptCount);
      } else {
        return this.handleErrorResponse(event, response, responseBody, attemptCount);
      }
    } catch (error) {
      return this.handleException(event, error, attemptCount);
    }
  }

  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return this.webhookQueue.getQueueMetrics();
  }

  generateSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const { signature } = HmacService.generateWebhookSignature(
      JSON.parse(payload) as Record<string, unknown>,
      secret,
      timestamp
    );
    return signature;
  }
}
