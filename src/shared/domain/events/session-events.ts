import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a session is created
 */
export class SessionCreatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly ipAddress?: string,
    public readonly deviceId?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'session.created';
  }

  getAggregateId(): string {
    return this.sessionId;
  }
}

/**
 * Event emitted when a session is refreshed
 */
export class SessionRefreshedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'session.refreshed';
  }

  getAggregateId(): string {
    return this.sessionId;
  }
}

/**
 * Event emitted when a session is revoked
 */
export class SessionRevokedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly revokedBy: string,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'session.revoked';
  }

  getAggregateId(): string {
    return this.sessionId;
  }
}

/**
 * Event emitted when a session expires
 */
export class SessionExpiredEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'session.expired';
  }

  getAggregateId(): string {
    return this.sessionId;
  }
}

/**
 * Event emitted when suspicious session activity is detected
 */
export class SessionSuspiciousActivityEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly activityType: string,
    public readonly details: Record<string, unknown>
  ) {
    super();
  }

  getEventName(): string {
    return 'session.suspicious_activity';
  }

  getAggregateId(): string {
    return this.sessionId;
  }
}
