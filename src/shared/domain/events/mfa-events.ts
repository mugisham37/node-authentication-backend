import { DomainEvent } from './domain-event.js';

/**
 * Event emitted when MFA is enabled for a user
 */
export class MfaEnabledEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly method: string
  ) {
    super();
  }

  getEventName(): string {
    return 'mfa.enabled';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when MFA is disabled for a user
 */
export class MfaDisabledEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly method: string
  ) {
    super();
  }

  getEventName(): string {
    return 'mfa.disabled';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when MFA verification succeeds
 */
export class MfaVerificationSucceededEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly method: string,
    public readonly ipAddress?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'mfa.verification_succeeded';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when MFA verification fails
 */
export class MfaVerificationFailedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly method: string,
    public readonly reason: string,
    public readonly ipAddress?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'mfa.verification_failed';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when backup codes are generated
 */
export class MfaBackupCodesGeneratedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly codesCount: number
  ) {
    super();
  }

  getEventName(): string {
    return 'mfa.backup_codes_generated';
  }

  getAggregateId(): string {
    return this.userId;
  }
}

/**
 * Event emitted when a backup code is used
 */
export class MfaBackupCodeUsedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly remainingCodes: number
  ) {
    super();
  }

  getEventName(): string {
    return 'mfa.backup_code_used';
  }

  getAggregateId(): string {
    return this.userId;
  }
}
