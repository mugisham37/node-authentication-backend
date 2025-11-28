import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when MFA is enabled for a user
 * Requirement: 4.3, 17.3
 */
export class MFAEnabledEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly mfaType: 'totp' | 'sms'
  ) {
    super();
  }

  getEventName(): string {
    return 'user.mfa_enabled';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when MFA is disabled for a user
 * Requirement: 4.5, 17.3
 */
export class MFADisabledEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly disabledBy: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.mfa_disabled';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when MFA verification succeeds
 * Requirement: 5.1
 */
export class MFAVerifiedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly mfaType: 'totp' | 'sms' | 'backup_code'
  ) {
    super();
  }

  getEventName(): string {
    return 'user.mfa_verified';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when MFA verification fails
 * Requirement: 5.2
 */
export class MFAVerificationFailedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly reason: string
  ) {
    super();
  }

  getEventName(): string {
    return 'user.mfa_verification_failed';
  }

  getAggregateId(): string {
    return this.userId;
  }
}
