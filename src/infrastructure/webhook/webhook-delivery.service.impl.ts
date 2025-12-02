import crypto from 'crypto';
import type {
  IWebhookDeliveryService,
  WebhookEvent,
  WebhookDeliveryResult,
} from '../../application/services/webhook-delivery.service.js';
import { WebhookQueue } from '../../core/queue/webhook-queue.js';
import { logger } from '../../core/logging/logger.js';

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
        ...event,
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
    const payloadString = JSON.stringify(event.payload);
    const signature = this.generateSignature(payloadString, event.secret);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.type,
          'X-Webhook-Delivery-Attempt': attemptCount.toString(),
          'User-Agent': 'Enterprise-Auth-Webhook/1.0',
        },
        body: payloadString,
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

  generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async getQueueMetrics() {
    return this.webhookQueue.getQueueMetrics();
  }
}
