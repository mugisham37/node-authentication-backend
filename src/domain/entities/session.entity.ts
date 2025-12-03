import { DeviceFingerprint } from '../value-objects/device-fingerprint.value-object.js';
import { IPAddress } from '../value-objects/ip-address.value-object.js';

/**
 * Session entity representing an authenticated user session.
 * Requirements: 3.1, 3.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export class Session {
  id: string;
  userId: string;
  tokenHash: string;
  deviceFingerprint: DeviceFingerprint;
  deviceName: string;
  ipAddress: IPAddress;
  userAgent: string;
  location: string | null;
  isTrusted: boolean;
  trustScore: number;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;

  constructor(props: {
    id: string;
    userId: string;
    tokenHash: string;
    deviceFingerprint: DeviceFingerprint;
    deviceName: string;
    ipAddress: IPAddress;
    userAgent: string;
    location?: string | null;
    isTrusted?: boolean;
    trustScore?: number;
    lastActivityAt?: Date;
    expiresAt: Date;
    createdAt?: Date;
    revokedAt?: Date | null;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.deviceFingerprint = props.deviceFingerprint;
    this.deviceName = props.deviceName;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.location = props.location ?? null;
    this.isTrusted = props.isTrusted ?? false;
    this.trustScore = props.trustScore ?? 0;
    this.lastActivityAt = props.lastActivityAt ?? new Date();
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt ?? new Date();
    this.revokedAt = props.revokedAt ?? null;
  }

  /**
   * Checks if the session has expired
   * Requirement: 7.5
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Checks if the session has been revoked
   * Requirement: 7.2
   */
  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  /**
   * Checks if the session is valid (not expired and not revoked)
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  /**
   * Updates the last activity timestamp
   * Requirement: 7.1
   */
  updateActivity(): void {
    this.lastActivityAt = new Date();
  }

  /**
   * Revokes the session
   * Requirement: 7.2, 7.3
   */
  revoke(): void {
    this.revokedAt = new Date();
  }

  /**
   * Calculates trust score based on device recognition and login patterns
   * Requirement: 7.4
   *
   * Trust score calculation:
   * - Base score: 50
   * - Trusted device: +30
   * - Known location: +20
   * - Recent activity: +10 (if active within last 24 hours)
   * - New location: -20
   * - Suspicious pattern: -30
   *
   * @param previousSessions - Previous sessions for this user
   * @returns Trust score between 0-100
   */
  calculateTrustScore(previousSessions: Session[]): number {
    let score = 50; // Base score

    // Trusted device bonus
    if (this.isTrusted) {
      score += 30;
    }

    // Check if device fingerprint is recognized
    const knownDevice = previousSessions.some(
      (s) => s.deviceFingerprint.equals(this.deviceFingerprint) && s.id !== this.id
    );
    if (knownDevice) {
      score += 15;
    }

    // Check if location is known
    if (this.location) {
      const knownLocation = previousSessions.some(
        (s) => s.location === this.location && s.id !== this.id
      );
      if (knownLocation) {
        score += 20;
      } else {
        // New location reduces trust
        score -= 20;
      }
    }

    // Check for recent activity from same device
    const recentActivity = previousSessions.some((s) => {
      const hoursSinceActivity =
        (new Date().getTime() - s.lastActivityAt.getTime()) / (1000 * 60 * 60);
      return (
        s.deviceFingerprint.equals(this.deviceFingerprint) &&
        hoursSinceActivity < 24 &&
        s.id !== this.id
      );
    });
    if (recentActivity) {
      score += 10;
    }

    // Ensure score is within 0-100 range
    this.trustScore = Math.max(0, Math.min(100, score));
    return this.trustScore;
  }

  /**
   * Marks the device as trusted
   * Requirement: 15.3
   */
  markAsTrusted(): void {
    this.isTrusted = true;
    this.trustScore = Math.min(100, this.trustScore + 30);
  }

  /**
   * Checks if session is inactive for more than 30 days
   * Requirement: 7.5
   */
  isInactive(): boolean {
    const daysSinceActivity =
      (new Date().getTime() - this.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActivity > 30;
  }
}
