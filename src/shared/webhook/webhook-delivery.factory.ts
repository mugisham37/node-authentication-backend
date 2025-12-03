import { Redis } from 'ioredis';
import { WebhookDeliveryService } from './webhook-delivery.service.impl.js';
import { WebhookQueue } from '../../infrastructure/queue/webhook-queue.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class WebhookDeliveryServiceFactory {
  static create(redisConnection: Redis): WebhookDeliveryService {
    const webhookQueue = new WebhookQueue(redisConnection);
    const webhookDeliveryService = new WebhookDeliveryService(webhookQueue);

    // Start the webhook worker to process queued jobs
    webhookQueue.startWorker();

    logger.info('Webhook delivery service factory initialized');

    return webhookDeliveryService;
  }
}
