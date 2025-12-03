import { DeviceFingerprint } from '../value-objects/device-fingerprint.value-object.js';

/**
 * Device entity representing a user's registered device.
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.6
 */
export class Device {
  id: string;
  userId: string;
  fingerprint: DeviceFingerprint;
  name: string;
  type: string;
  isTrusted: boolean;
  lastSeenAt: Date;
  createdAt: Date;

  constructor(props: {
    id: string;
    userId: string;
    fingerprint: DeviceFingerprint;
    name: string;
    type: string;
    isTrusted?: boolean;
    lastSeenAt?: Date;
    createdAt?: Date;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.fingerprint = props.fingerprint;
    this.name = props.name;
    this.type = props.type;
    this.isTrusted = props.isTrusted ?? false;
    this.lastSeenAt = props.lastSeenAt ?? new Date();
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Marks the device as trusted
   * Requirement: 15.3
   */
  markAsTrusted(): void {
    this.isTrusted = true;
  }

  /**
   * Marks the device as untrusted
   */
  markAsUntrusted(): void {
    this.isTrusted = false;
  }

  /**
   * Updates the last seen timestamp
   * Requirement: 15.1
   */
  updateLastSeen(): void {
    this.lastSeenAt = new Date();
  }

  /**
   * Checks if the device has been unused for more than 90 days
   * Requirement: 15.6
   */
  isUnused(): boolean {
    const daysSinceLastSeen =
      (new Date().getTime() - this.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastSeen > 90;
  }

  /**
   * Gets a user-friendly device type name
   */
  getDeviceTypeName(): string {
    const typeNames: Record<string, string> = {
      mobile: 'Mobile',
      tablet: 'Tablet',
      desktop: 'Desktop',
      laptop: 'Laptop',
      unknown: 'Unknown Device',
    };
    return typeNames[this.type.toLowerCase()] || this.type;
  }
}
