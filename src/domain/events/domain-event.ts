/**
 * Base class for all domain events.
 * Domain events represent something that happened in the domain that domain experts care about.
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }

  /**
   * Returns the event name (used for event routing)
   */
  abstract getEventName(): string;

  /**
   * Returns the aggregate ID that this event relates to
   */
  abstract getAggregateId(): string;
}
