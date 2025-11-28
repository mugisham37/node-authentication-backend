import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a new device is registered
 * Requirement: 15.1, 17.1
 */
export class DeviceRegisteredEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly deviceName: string,
    public readonly deviceType: string
  ) {
    super();
  }

  getEventName(): string {
    return 'device.registered';
  }

  getAggregateId(): string {
    return this.deviceId;
  }
}

/**
 * Event emitted when a device is marked as trusted
 * Requirement: 15.3
 */
export class DeviceTrustedEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'device.trusted';
  }

  getAggregateId(): string {
    return this.deviceId;
  }
}

/**
 * Event emitted when a device is removed
 * Requirement: 15.4
 */
export class DeviceRemovedEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly removedBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'device.removed';
  }

  getAggregateId(): string {
    return this.deviceId;
  }
}
