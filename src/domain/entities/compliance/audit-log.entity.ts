import { IPAddress } from '../../../../domain/value-objects/ip-address.value-object.js';

/**
 * AuditLog entity representing an immutable record of security-relevant events.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */
export class AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  status: 'success' | 'failure' | 'pending';
  ipAddress: IPAddress | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  riskScore: number;
  createdAt: Date;

  constructor(props: {
    id: string;
    userId?: string | null;
    action: string;
    resource?: string | null;
    resourceId?: string | null;
    status: 'success' | 'failure' | 'pending';
    ipAddress?: IPAddress | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
    riskScore?: number;
    createdAt?: Date;
  }) {
    this.id = props.id;
    this.userId = props.userId ?? null;
    this.action = props.action;
    this.resource = props.resource ?? null;
    this.resourceId = props.resourceId ?? null;
    this.status = props.status;
    this.ipAddress = props.ipAddress ?? null;
    this.userAgent = props.userAgent ?? null;
    this.metadata = props.metadata ?? {};
    this.riskScore = props.riskScore ?? 0;
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Calculates risk score based on action type and context
   * Requirement: 13.3
   *
   * Risk scoring:
   * - Failed login: 30
   * - Account lockout: 50
   * - Password change: 40
   * - MFA disable: 60
   * - Role assignment: 50
   * - Permission change: 50
   * - Unusual location: +20
   * - Multiple failures: +10 per failure
   * - Success: 10
   */
  static calculateRiskScore(
    action: string,
    status: 'success' | 'failure' | 'pending',
    metadata: Record<string, unknown> = {}
  ): number {
    let score = 0;

    // Base score by action type
    const actionScores: Record<string, number> = {
      'user.login.failed': 30,
      'user.login.success': 10,
      'user.account.locked': 50,
      'user.password.changed': 40,
      'user.mfa.disabled': 60,
      'user.mfa.enabled': 20,
      'role.assigned': 50,
      'role.removed': 50,
      'permission.granted': 50,
      'permission.revoked': 50,
      'user.registered': 10,
      'user.deleted': 40,
      'session.created': 10,
      'session.revoked': 20,
    };

    score = actionScores[action] || 10;

    // Increase score for failures
    if (status === 'failure') {
      score += 20;
    }

    // Increase score for unusual location
    if (metadata['unusualLocation']) {
      score += 20;
    }

    // Increase score for multiple failures
    if (metadata['failureCount'] && typeof metadata['failureCount'] === 'number') {
      score += Math.min(metadata['failureCount'] * 10, 50);
    }

    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Checks if this is a high-risk event
   * Requirement: 13.4
   */
  isHighRisk(): boolean {
    return this.riskScore >= 60;
  }

  /**
   * Checks if this is a medium-risk event
   */
  isMediumRisk(): boolean {
    return this.riskScore >= 40 && this.riskScore < 60;
  }

  /**
   * Checks if this is a low-risk event
   */
  isLowRisk(): boolean {
    return this.riskScore < 40;
  }

  /**
   * Gets a human-readable risk level
   */
  getRiskLevel(): 'low' | 'medium' | 'high' {
    if (this.isHighRisk()) {
      return 'high';
    }
    if (this.isMediumRisk()) {
      return 'medium';
    }
    return 'low';
  }
}
