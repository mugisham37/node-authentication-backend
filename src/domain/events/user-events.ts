import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a user is created
 */
export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly username?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.created';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a user's email is verified
 */
export class UserEmailVerifiedEvent extends DomainEvent {
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
 * Event emitted when a user's password is changed
 */
export class UserPasswordChangedEvent extends DomainEvent {
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
 * Event emitted when a user is suspended
 */
export class UserSuspendedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly reason: string,
    public readonly suspendedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.suspended';
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

/**
 * Event emitted when a user updates their profile
 */
export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly updatedFields: string[]
  ) {
    super();
  }

  getEventName(): string {
    return 'user.profile_updated';
  }

  getAggregateId(): string {
    return this.userId;
  }
}
