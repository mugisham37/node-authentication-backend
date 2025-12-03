import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a role is assigned to a user
 * Requirement: 11.1
 */
export class RoleAssignedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly assignedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.assigned';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a role is removed from a user
 * Requirement: 11.2
 */
export class RoleRemovedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly removedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.removed';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a role is created
 */
export class RoleCreatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly createdBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.created';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}

/**
 * Event emitted when a role is modified
 * Requirement: 11.5
 */
export class RoleModifiedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly modifiedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.modified';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}

/**
 * Event emitted when a role is deleted
 */
export class RoleDeletedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly deletedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.deleted';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}
