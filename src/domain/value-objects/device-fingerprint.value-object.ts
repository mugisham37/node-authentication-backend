import { createHash } from 'crypto';
import { ValidationError } from '../../shared/errors/types/application-error.js';

/**
 * DeviceFingerprint value object representing a unique device identifier.
 * Combines user agent, screen resolution, timezone, and canvas fingerprint.
 * Requirements: 15.5
 */
export class DeviceFingerprint {
  private readonly value: string;

  constructor(components: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    canvasFingerprint?: string;
  }) {
    if (!components.userAgent || typeof components.userAgent !== 'string') {
      throw new ValidationError('User agent is required for device fingerprint');
    }

    this.value = this.generateFingerprint(components);
  }

  /**
   * Generates a unique fingerprint by hashing device components
   */
  private generateFingerprint(components: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    canvasFingerprint?: string;
  }): string {
    const parts = [
      components.userAgent,
      components.screenResolution || 'unknown',
      components.timezone || 'unknown',
      components.canvasFingerprint || 'unknown',
    ];

    const combined = parts.join('|');
    return createHash('sha256').update(combined).digest('hex');
  }

  toString(): string {
    return this.value;
  }

  equals(other: DeviceFingerprint): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }

  /**
   * Creates a fingerprint from a raw string (for loading from database)
   */
  static fromString(fingerprint: string): DeviceFingerprint {
    if (!fingerprint || typeof fingerprint !== 'string') {
      throw new ValidationError('Invalid fingerprint string');
    }

    // Create a dummy instance with minimal data
    const instance = Object.create(DeviceFingerprint.prototype) as DeviceFingerprint;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (instance as any).value = fingerprint;
    return instance;
  }
}
