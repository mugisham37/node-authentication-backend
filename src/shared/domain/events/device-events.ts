import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when a new device is registered
 */
export class DeviceRegisteredEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly deviceName?: string,
    public readonly deviceType?: string
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
 * Event emitted when a device is verified/trusted
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
 * Event emitted when a device trust is revoked
 */
export class DeviceTrustRevokedEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'device.trust_revoked';
  }

  getAggregateId(): string {
    return this.deviceId;
  }
}

/**
 * Event emitted when a device is deleted/removed
 */
export class DeviceRemovedEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string
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

/**
 * Event emitted when suspicious device activity is detected
 */
export class DeviceSuspiciousActivityEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly activityType: string,
    public readonly details: Record<string, unknown>
  ) {
    super();
  }

  getEventName(): string {
    return 'device.suspicious_activity';
  }

  getAggregateId(): string {
    return this.deviceId;
  }
}

/**
 * Event emitted when a device fingerprint is updated
 */
export class DeviceFingerprintUpdatedEvent extends DomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly fingerprintType: string
  ) {
    super();
  }

  getEventName(): string {
    return 'device.fingerprint_updated';
  }

  getAggregateId(): string {
    return this.deviceId;
  }
}
