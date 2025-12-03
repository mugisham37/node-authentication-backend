import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a role is created
 */
export class RoleCreatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly name: string,
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
 * Event emitted when a role is updated
 */
export class RoleUpdatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly name: string,
    public readonly updatedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.updated';
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

/**
 * Event emitted when a role is assigned to a user
 */
export class RoleAssignedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly userId: string,
    public readonly assignedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.assigned';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}

/**
 * Event emitted when a role is removed from a user
 */
export class RoleRevokedEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly userId: string,
    public readonly revokedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.revoked';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}

/**
 * Event emitted when permissions are added to a role
 */
export class PermissionsAddedToRoleEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly permissionIds: string[],
    public readonly addedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.permissions_added';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}

/**
 * Event emitted when permissions are removed from a role
 */
export class PermissionsRemovedFromRoleEvent extends DomainEvent {
  constructor(
    public readonly roleId: string,
    public readonly permissionIds: string[],
    public readonly removedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'role.permissions_removed';
  }

  getAggregateId(): string {
    return this.roleId;
  }
}
