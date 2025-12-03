import { Webhook } from '../../domain/entities/webhook.entity.js';
import { WebhookDelivery } from '../../domain/repositories/webhook.repository.interface.js';

export interface IWebhookService {
  createWebhook(
    userId: string,
    data: { url: string; events: string[]; description?: string }
  ): Promise<Webhook>;
  getUserWebhooks(userId: string): Promise<Webhook[]>;
  getWebhook(userId: string, webhookId: string): Promise<Webhook>;
  updateWebhook(
    userId: string,
    webhookId: string,
    data: { url?: string; events?: string[]; isActive?: boolean; description?: string }
  ): Promise<Webhook>;
  deleteWebhook(userId: string, webhookId: string): Promise<void>;
  getWebhookDeliveries(
    userId: string,
    webhookId: string,
    params: { page: number; limit: number }
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }>;
}
