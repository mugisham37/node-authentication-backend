import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a new session is created
 * Requirement: 3.1, 7.1
 */
export class SessionCreatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly deviceFingerprint: string,
    public readonly ipAddress: string
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
 * Event emitted when a session is revoked
 * Requirement: 7.2, 17.4
 */
export class SessionRevokedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly revokedBy: string
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
 * Requirement: 7.5
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
 * Event emitted when a user logs out
 * Requirement: 7.3
 */
export class UserLoggedOutEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.logged_out';
  }

  getAggregateId(): string {
    return this.userId;
  }
}
