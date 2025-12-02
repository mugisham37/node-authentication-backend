import { Webhook } from '../entities/webhook.entity.js';

/**
 * Webhook Delivery status and tracking
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failure';
  httpStatusCode: number | null;
  responseBody: string | null;
  attemptCount: number;
  nextRetryAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

/**
 * Webhook Repository Interface
 * Requirements: 16.1, 16.5, 16.6
 */
export interface IWebhookRepository {
  /**
   * Create a new webhook
   * Requirement: 16.1
   */
  create(webhook: Webhook): Promise<Webhook>;

  /**
   * Find webhook by ID
   */
  findById(id: string): Promise<Webhook | null>;

  /**
   * Find all webhooks for a user
   * Requirement: 16.5
   */
  findByUserId(userId: string): Promise<Webhook[]>;

  /**
   * Find active webhooks subscribed to an event
   * Requirement: 16.2
   */
  findActiveByEvent(eventType: string): Promise<Webhook[]>;

  /**
   * Update webhook
   */
  update(webhook: Webhook): Promise<Webhook>;

  /**
   * Delete webhook
   * Requirement: 16.6
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all webhooks for a user
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Create a webhook delivery record
   * Requirement: 16.3
   */
  createDelivery(delivery: Omit<WebhookDelivery, 'id' | 'createdAt'>): Promise<WebhookDelivery>;

  /**
   * Update webhook delivery status
   * Requirement: 16.3
   */
  updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery>;

  /**
   * Find webhook deliveries by webhook ID
   * Requirement: 16.5
   */
  findDeliveriesByWebhookId(webhookId: string, limit?: number): Promise<WebhookDelivery[]>;

  /**
   * Find pending deliveries for retry
   * Requirement: 16.3
   */
  findPendingDeliveries(limit?: number): Promise<WebhookDelivery[]>;
}
