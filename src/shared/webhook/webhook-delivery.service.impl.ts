import type {
  IWebhookDeliveryService,
  WebhookEvent,
  WebhookDeliveryResult,
} from '../application/services/webhook-delivery.service.js';
import { WebhookQueue } from '../queue/webhook-queue.js';
import { logger } from '../logging/logger.js';
import { HmacService } from '../security/hashing/hmac.service.js';

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

  async deliverWebhook(event: WebhookEvent, attemptCount: number): Promise<WebhookDeliveryResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const { signature } = HmacService.generateWebhookSignature(
      event.payload,
      event.secret,
      timestamp
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Event': event.type,
          'X-Webhook-Delivery-Attempt': attemptCount.toString(),
          'User-Agent': 'Enterprise-Auth-Webhook/1.0',
        },
        body: JSON.stringify(event.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      if (response.ok) {
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
      } else {
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
    } catch (error) {
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
