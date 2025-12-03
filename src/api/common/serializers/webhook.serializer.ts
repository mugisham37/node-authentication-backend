import { Webhook } from '../../../domain/entities/webhook.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * Webhook DTO for responses
 */
export interface WebhookDTO {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Webhook DTO for list responses (excludes secret)
 */
export interface WebhookSummaryDTO {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Webhook serializer for transforming Webhook entities to DTOs
 */
export class WebhookSerializer extends BaseSerializer {
  /**
   * Serialize webhook to DTO (includes secret)
   */
  static toDTO(webhook: Webhook): WebhookDTO {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      isActive: webhook.isActive,
      createdAt: this.formatDate(webhook.createdAt) as string,
      updatedAt: this.formatDate(webhook.updatedAt) as string,
    };
  }

  /**
   * Serialize webhook to summary DTO (excludes secret)
   */
  static toSummary(webhook: Webhook): WebhookSummaryDTO {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      createdAt: this.formatDate(webhook.createdAt) as string,
      updatedAt: this.formatDate(webhook.updatedAt) as string,
    };
  }

  /**
   * Serialize multiple webhooks to DTOs
   */
  static toDTOList(webhooks: Webhook[]): WebhookDTO[] {
    return webhooks.map((webhook) => this.toDTO(webhook));
  }

  /**
   * Serialize multiple webhooks to summary DTOs
   */
  static toSummaryList(webhooks: Webhook[]): WebhookSummaryDTO[] {
    return webhooks.map((webhook) => this.toSummary(webhook));
  }
}
