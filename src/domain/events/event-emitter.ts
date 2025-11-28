import { DomainEvent } from './domain-event.js';

/**
 * Type for event handlers
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

/**
 * Domain event emitter for publishing and subscribing to domain events.
 * Implements the Observer pattern for domain events.
 */
export class DomainEventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Subscribes a handler to a specific event type
   */
  on<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventName) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventName, handlers);
  }

  /**
   * Unsubscribes a handler from a specific event type
   */
  off<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventName);
    if (!handlers) {
      return;
    }

    const index = handlers.indexOf(handler as EventHandler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this.handlers.delete(eventName);
    }
  }

  /**
   * Publishes an event to all subscribed handlers
   */
  async emit(event: DomainEvent): Promise<void> {
    const eventName = event.getEventName();
    const handlers = this.handlers.get(eventName) || [];

    // Execute all handlers (in parallel for async handlers)
    await Promise.all(handlers.map((handler) => handler(event)));
  }

  /**
   * Clears all event handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Gets the number of handlers for a specific event
   */
  listenerCount(eventName: string): number {
    return this.handlers.get(eventName)?.length || 0;
  }
}

// Singleton instance
export const domainEventEmitter = new DomainEventEmitter();
