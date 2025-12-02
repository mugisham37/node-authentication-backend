import { eq, and, desc, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IWebhookRepository,
  WebhookDelivery,
} from '../../domain/repositories/webhook.repository.js';
import { Webhook } from '../../domain/entities/webhook.entity.js';
import { webhooks, webhookDeliveries } from '../../core/database/schema/webhooks.schema.js';
import {
  NotFoundError,
  ServiceUnavailableError,
} from '../../core/errors/types/application-error.js';

/**
 * Webhook Repository Implementation using Drizzle ORM
 * Requirements: 16.1, 16.5, 16.6
 */
export class WebhookRepository implements IWebhookRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Create a new webhook
   * Requirement: 16.1
   */
  async create(webhook: Webhook): Promise<Webhook> {
    try {
      const result = await this.db
        .insert(webhooks)
        .values({
          id: webhook.id,
          userId: webhook.userId,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
        })
        .returning();

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      // Handle foreign key violation
      if (error.code === '23503') {
        throw new NotFoundError('User');
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'create',
      });
    }
  }

  /**
   * Find webhook by ID
   */
  async findById(id: string): Promise<Webhook | null> {
    try {
      const result = await this.db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findById',
      });
    }
  }

  /**
   * Find all webhooks for a user
   * Requirement: 16.5
   */
  async findByUserId(userId: string): Promise<Webhook[]> {
    try {
      const result = await this.db.select().from(webhooks).where(eq(webhooks.userId, userId));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByUserId',
      });
    }
  }

  /**
   * Find active webhooks subscribed to an event
   * Requirement: 16.2
   */
  async findActiveByEvent(eventType: string): Promise<Webhook[]> {
    try {
      // Use JSONB contains operator to check if event is in the events array
      const result = await this.db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.isActive, true),
            sql`${webhooks.events} @> ${JSON.stringify([eventType])}`
          )
        );

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findActiveByEvent',
      });
    }
  }

  /**
   * Update webhook
   */
  async update(webhook: Webhook): Promise<Webhook> {
    try {
      const result = await this.db
        .update(webhooks)
        .set({
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret,
          isActive: webhook.isActive,
          updatedAt: new Date(),
        })
        .where(eq(webhooks.id, webhook.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Webhook');
      }

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'update',
      });
    }
  }

  /**
   * Delete webhook
   * Requirement: 16.6
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.delete(webhooks).where(eq(webhooks.id, id)).returning();

      if (result.length === 0) {
        throw new NotFoundError('Webhook');
      }
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'delete',
      });
    }
  }

  /**
   * Delete all webhooks for a user
   */
  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.db.delete(webhooks).where(eq(webhooks.userId, userId));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'deleteByUserId',
      });
    }
  }

  /**
   * Create a webhook delivery record
   * Requirement: 16.3
   */
  async createDelivery(
    delivery: Omit<WebhookDelivery, 'id' | 'createdAt'>
  ): Promise<WebhookDelivery> {
    try {
      const result = await this.db
        .insert(webhookDeliveries)
        .values({
          webhookId: delivery.webhookId,
          eventType: delivery.eventType,
          payload: delivery.payload,
          status: delivery.status,
          httpStatusCode: delivery.httpStatusCode,
          responseBody: delivery.responseBody,
          attemptCount: delivery.attemptCount,
          nextRetryAt: delivery.nextRetryAt,
          deliveredAt: delivery.deliveredAt,
        })
        .returning();

      return this.mapDeliveryToObject(result[0]);
    } catch (error: any) {
      // Handle foreign key violation
      if (error.code === '23503') {
        throw new NotFoundError('Webhook');
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'createDelivery',
      });
    }
  }

  /**
   * Update webhook delivery status
   * Requirement: 16.3
   */
  async updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery> {
    try {
      const result = await this.db
        .update(webhookDeliveries)
        .set({
          status: updates.status,
          httpStatusCode: updates.httpStatusCode,
          responseBody: updates.responseBody,
          attemptCount: updates.attemptCount,
          nextRetryAt: updates.nextRetryAt,
          deliveredAt: updates.deliveredAt,
        })
        .where(eq(webhookDeliveries.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('WebhookDelivery');
      }

      return this.mapDeliveryToObject(result[0]);
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'updateDelivery',
      });
    }
  }

  /**
   * Find webhook deliveries by webhook ID
   * Requirement: 16.5
   */
  async findDeliveriesByWebhookId(
    webhookId: string,
    limit: number = 100
  ): Promise<WebhookDelivery[]> {
    try {
      const result = await this.db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit);

      return result.map((row) => this.mapDeliveryToObject(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findDeliveriesByWebhookId',
      });
    }
  }

  /**
   * Find pending deliveries for retry
   * Requirement: 16.3
   */
  async findPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
    try {
      const now = new Date();

      const result = await this.db
        .select()
        .from(webhookDeliveries)
        .where(
          and(eq(webhookDeliveries.status, 'pending'), lte(webhookDeliveries.nextRetryAt, now))
        )
        .orderBy(webhookDeliveries.nextRetryAt)
        .limit(limit);

      return result.map((row) => this.mapDeliveryToObject(row));
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findPendingDeliveries',
      });
    }
  }

  /**
   * Maps database row to Webhook entity
   */
  private mapToEntity(row: any): Webhook {
    return new Webhook({
      id: row.id,
      userId: row.userId,
      url: row.url,
      events: row.events,
      secret: row.secret,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * Maps database row to WebhookDelivery object
   */
  private mapDeliveryToObject(row: unknown): WebhookDelivery {
    return {
      id: row.id,
      webhookId: row.webhookId,
      eventType: row.eventType,
      payload: row.payload,
      status: row.status,
      httpStatusCode: row.httpStatusCode,
      responseBody: row.responseBody,
      attemptCount: row.attemptCount,
      nextRetryAt: row.nextRetryAt,
      deliveredAt: row.deliveredAt,
      createdAt: row.createdAt,
    };
  }
}
