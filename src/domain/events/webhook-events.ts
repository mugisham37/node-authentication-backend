import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a webhook is created
 * Requirement: 16.1
 */
export class WebhookCreatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly userId: string,
    public readonly url: string,
    public readonly events: string[]
  ) {
    super();
  }

  getEventName(): string {
    return 'webhook.created';
  }

  getAggregateId(): string {
    return this.webhookId;
  }
}

/**
 * Event emitted when a webhook is deleted
 * Requirement: 16.6
 */
export class WebhookDeletedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly userId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'webhook.deleted';
  }

  getAggregateId(): string {
    return this.webhookId;
  }
}

/**
 * Event emitted when a webhook delivery succeeds
 * Requirement: 16.2
 */
export class WebhookDeliveredEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly eventType: string,
    public readonly statusCode: number
  ) {
    super();
  }

  getEventName(): string {
    return 'webhook.delivered';
  }

  getAggregateId(): string {
    return this.webhookId;
  }
}

/**
 * Event emitted when a webhook delivery fails
 * Requirement: 16.3
 */
export class WebhookDeliveryFailedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly eventType: string,
    public readonly error: string,
    public readonly attemptCount: number
  ) {
    super();
  }

  getEventName(): string {
    return 'webhook.delivery_failed';
  }

  getAggregateId(): string {
    return this.webhookId;
  }
}
