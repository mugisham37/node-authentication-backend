import { IPAddress } from '../../domain/value-objects/ip-address.value-object.js';
import { DeviceFingerprint } from '../../domain/value-objects/device-fingerprint.value-object.js';
import { log } from '../../core/logging/logger.js';

/**
 * Security alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security alert interface
 * Requirement: 18.4
 */
export interface SecurityAlert {
  id: string;
  userId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Login attempt data for anomaly detection
 */
export interface LoginAttempt {
  userId: string;
  ipAddress: IPAddress;
  location?: string;
  timestamp: Date;
  success: boolean;
  deviceFingerprint?: DeviceFingerprint;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  requiresStepUp: boolean;
  alerts: SecurityAlert[];
}

/**
 * Risk Assessment Service Interface
 * Requirements: 18.1, 18.2, 18.3, 18.5
 */
export interface IRiskAssessmentService {
  /**
   * Assess risk for a login attempt
   * Requirements: 18.1, 18.2, 18.3, 18.5
   */
  assessLoginRisk(
    userId: string,
    ipAddress: IPAddress,
    location: string | undefined,
    deviceFingerprint: DeviceFingerprint,
    previousAttempts: LoginAttempt[]
  ): Promise<RiskAssessment>;

  /**
   * Detect anomalous login patterns
   * Requirement: 18.1
   */
  detectAnomalousPattern(userId: string, attempts: LoginAttempt[]): boolean;

  /**
   * Detect impossible travel
   * Requirement: 18.3
   */
  detectImpossibleTravel(
    currentLocation: string | undefined,
    previousLocation: string | undefined,
    timeDifferenceMs: number
  ): boolean;

  /**
   * Check device fingerprint
   * Requirement: 15.5
   */
  isKnownDevice(deviceFingerprint: DeviceFingerprint, knownFingerprints: string[]): boolean;

  /**
   * Perform velocity check
   * Requirement: 18.1
   */
  checkVelocity(userId: string, attempts: LoginAttempt[], windowMs: number): number;

  /**
   * Check IP reputation
   * Requirement: 18.5
   */
  checkIPReputation(ipAddress: IPAddress): Promise<number>;

  /**
   * Calculate composite risk score
   * Requirement: 18.5
   */
  calculateCompositeRiskScore(factors: {
    failedAttempts: number;
    isNewLocation: boolean;
    isImpossibleTravel: boolean;
    isNewDevice: boolean;
    ipReputationScore: number;
    velocityScore: number;
  }): number;
}

/**
 * Risk Assessment Service Implementation
 * Provides security monitoring and risk scoring for authentication events
 * Requirements: 18.1, 18.2, 18.3, 18.5
 */
export class RiskAssessmentService implements IRiskAssessmentService {
  private readonly HIGH_RISK_THRESHOLD = 70;
  private readonly MEDIUM_RISK_THRESHOLD = 40;
  private readonly STEP_UP_THRESHOLD = 60;

  // Velocity check thresholds
  private readonly MAX_ATTEMPTS_PER_MINUTE = 5;
  private readonly MAX_ATTEMPTS_PER_HOUR = 20;

  // Impossible travel: max speed in km/h (commercial flight speed)
  private readonly MAX_TRAVEL_SPEED_KMH = 900;

  /**
   * Assess risk for a login attempt
   * Requirements: 18.1, 18.2, 18.3, 18.5
   */
  async assessLoginRisk(
    userId: string,
    ipAddress: IPAddress,
    location: string | undefined,
    deviceFingerprint: DeviceFingerprint,
    previousAttempts: LoginAttempt[]
  ): Promise<RiskAssessment> {
    const factors: string[] = [];
    const alerts: SecurityAlert[] = [];

    // Assess failed login attempts
    const failedAttempts = this.assessFailedAttempts(userId, previousAttempts, factors, alerts);

    // Assess location risks
    const { isNewLocation, isImpossibleTravel } = this.assessLocationRisks(
      userId,
      location,
      previousAttempts,
      factors,
      alerts
    );

    // Assess device and velocity
    const { isNewDevice, velocityScore } = this.assessDeviceAndVelocity(
      userId,
      deviceFingerprint,
      previousAttempts,
      factors
    );

    // Check IP reputation
    const ipReputationScore = await this.checkIPReputation(ipAddress);
    if (ipReputationScore > 0.5) {
      factors.push('IP address has poor reputation');
    }

    // Calculate final risk score
    const riskScore = this.calculateCompositeRiskScore({
      failedAttempts,
      isNewLocation,
      isImpossibleTravel,
      isNewDevice,
      ipReputationScore,
      velocityScore,
    });

    const riskLevel = this.getRiskLevel(riskScore);
    const requiresStepUp = riskScore >= this.STEP_UP_THRESHOLD;

    log.info('Risk assessment completed', {
      userId,
      riskScore,
      riskLevel,
      requiresStepUp,
      factorCount: factors.length,
      alertCount: alerts.length,
    });

    return { riskScore, riskLevel, factors, requiresStepUp, alerts };
  }

  /**
   * Detect anomalous login patterns
   * Requirement: 18.1
   */
  detectAnomalousPattern(_userId: string, attempts: LoginAttempt[]): boolean {
    if (attempts.length === 0) {
      return false;
    }

    // Check for multiple failed attempts
    const recentAttempts = attempts.filter(
      (attempt) => Date.now() - attempt.timestamp.getTime() < 15 * 60 * 1000
    );

    const failedCount = recentAttempts.filter((a) => !a.success).length;

    // Anomalous if 3 or more failures in 15 minutes
    return failedCount >= 3;
  }

  /**
   * Detect impossible travel
   * Requirement: 18.3
   */
  detectImpossibleTravel(
    currentLocation: string | undefined,
    previousLocation: string | undefined,
    timeDifferenceMs: number
  ): boolean {
    // If either location is missing, we can't detect impossible travel
    if (!currentLocation || !previousLocation) {
      return false;
    }

    // If locations are the same, no travel occurred
    if (currentLocation === previousLocation) {
      return false;
    }

    // Estimate distance (simplified - in production, use geolocation API)
    const distance = this.estimateDistance(currentLocation, previousLocation);

    // Calculate required speed in km/h
    const timeHours = timeDifferenceMs / (1000 * 60 * 60);
    const requiredSpeed = distance / timeHours;

    // Impossible if required speed exceeds maximum travel speed
    return requiredSpeed > this.MAX_TRAVEL_SPEED_KMH;
  }

  /**
   * Check if device fingerprint is known
   * Requirement: 15.5
   */
  isKnownDevice(deviceFingerprint: DeviceFingerprint, knownFingerprints: string[]): boolean {
    const fingerprintStr = deviceFingerprint.toString();
    return knownFingerprints.includes(fingerprintStr);
  }

  /**
   * Perform velocity check
   * Requirement: 18.1
   */
  checkVelocity(_userId: string, attempts: LoginAttempt[], windowMs: number): number {
    const now = Date.now();
    const recentAttempts = attempts.filter(
      (attempt) => now - attempt.timestamp.getTime() < windowMs
    );

    // Calculate velocity score (0-1)
    const maxExpected =
      windowMs === 60 * 1000 ? this.MAX_ATTEMPTS_PER_MINUTE : this.MAX_ATTEMPTS_PER_HOUR;
    const velocityScore = Math.min(recentAttempts.length / maxExpected, 1);

    return velocityScore;
  }

  /**
   * Check IP reputation
   * Requirement: 18.5
   * Note: In production, this would integrate with IP reputation services
   */
  checkIPReputation(ipAddress: IPAddress): Promise<number> {
    // Simplified implementation - in production, integrate with services like:
    // - AbuseIPDB
    // - IPQualityScore
    // - MaxMind GeoIP2

    const ip = ipAddress.toString();

    // Check if IP is private/local (low risk)
    if (this.isPrivateIP(ip)) {
      return Promise.resolve(0);
    }

    // Check if IP is in known bad ranges (simplified)
    // In production, maintain a database of known malicious IPs
    const knownBadRanges = ['192.0.2.', '198.51.100.', '203.0.113.']; // TEST-NET ranges

    for (const range of knownBadRanges) {
      if (ip.startsWith(range)) {
        return Promise.resolve(0.8); // High risk
      }
    }

    // Default to low risk for unknown IPs
    return Promise.resolve(0.1);
  }

  /**
   * Calculate composite risk score
   * Requirement: 18.5
   */
  calculateCompositeRiskScore(factors: {
    failedAttempts: number;
    isNewLocation: boolean;
    isImpossibleTravel: boolean;
    isNewDevice: boolean;
    ipReputationScore: number;
    velocityScore: number;
  }): number {
    let score = 0;

    // Failed attempts (0-30 points)
    score += Math.min(factors.failedAttempts * 10, 30);

    // New location (10 points)
    if (factors.isNewLocation) {
      score += 10;
    }

    // Impossible travel (40 points - very high risk)
    if (factors.isImpossibleTravel) {
      score += 40;
    }

    // New device (15 points)
    if (factors.isNewDevice) {
      score += 15;
    }

    // IP reputation (0-20 points)
    score += factors.ipReputationScore * 20;

    // Velocity (0-15 points)
    score += factors.velocityScore * 15;

    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Helper: Check if location is unusual
   */
  private isUnusualLocation(
    currentLocation: string | undefined,
    previousAttempts: LoginAttempt[]
  ): boolean {
    if (!currentLocation) {
      return false;
    }

    // Get unique locations from previous successful attempts
    const knownLocations = new Set(
      previousAttempts.filter((a) => a.success && a.location).map((a) => a.location)
    );

    return !knownLocations.has(currentLocation);
  }

  /**
   * Helper: Estimate distance between two locations
   * Simplified implementation - in production, use proper geolocation
   */
  private estimateDistance(location1: string, location2: string): number {
    // Very simplified - just check if locations are different
    // In production, parse location strings and calculate actual distance
    // using Haversine formula or geolocation API

    if (location1 === location2) {
      return 0;
    }

    // Assume different locations are at least 100km apart
    // This is a placeholder - real implementation would calculate actual distance
    return 100;
  }

  /**
   * Helper: Check if IP is private/local
   */
  private isPrivateIP(ip: string): boolean {
    return (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('127.') ||
      ip === 'localhost' ||
      ip === '::1'
    );
  }

  /**
   * Helper: Get risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) {
      return 'critical';
    }
    if (score >= this.HIGH_RISK_THRESHOLD) {
      return 'high';
    }
    if (score >= this.MEDIUM_RISK_THRESHOLD) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Helper: Create security alert
   */
  private createAlert(
    userId: string,
    type: string,
    severity: AlertSeverity,
    metadata: Record<string, unknown>
  ): SecurityAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      severity,
      message: this.getAlertMessage(type),
      metadata,
      timestamp: new Date(),
    };
  }

  /**
   * Helper: Get alert message for type
   */
  private getAlertMessage(type: string): string {
    const messages: Record<string, string> = {
      failed_login_pattern: 'Multiple failed login attempts detected',
      unusual_location: 'Login from unusual location detected',
      impossible_travel: 'Impossible travel detected - requires additional verification',
      new_device: 'Login from new device detected',
      high_velocity: 'High velocity of login attempts detected',
      poor_ip_reputation: 'Login from IP address with poor reputation',
    };

    return messages[type] || 'Security alert';
  }
}
