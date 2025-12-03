import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a new user registers
 * Requirement: 1.1
 */
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly name: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.registered';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user successfully logs in
 * Requirement: 3.1
 */
export class UserLoggedInEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.logged_in';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user's password is changed
 * Requirement: 10.2, 17.2
 */
export class PasswordChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly changedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.password_changed';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user's email is verified
 * Requirement: 2.1
 */
export class EmailVerifiedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.email_verified';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user account is locked
 * Requirement: 3.6
 */
export class AccountLockedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly reason: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.account_locked';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user account is unlocked
 */
export class AccountUnlockedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly unlockedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.account_unlocked';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user is deleted
 */
export class UserDeletedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly deletedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.deleted';
  }

  getAggregateId(): string {
    return this.userId;
  }
}
