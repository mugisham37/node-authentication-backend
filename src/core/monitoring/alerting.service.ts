import { logger } from '../logging/logger.js';
import { securityEvents } from './metrics.js';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Alert types
 */
export enum AlertType {
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_LATENCY = 'high_latency',
  SECURITY_EVENT = 'security_event',
  SYSTEM_HEALTH = 'system_health',
  FAILED_LOGIN_ATTEMPTS = 'failed_login_attempts',
  ACCOUNT_LOCKOUT = 'account_lockout',
  UNUSUAL_ACTIVITY = 'unusual_activity',
}

/**
 * Alert interface
 */
export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Alert thresholds configuration
 */
interface AlertThresholds {
  errorRatePerMinute: number;
  latencyP95Ms: number;
  failedLoginsPerMinute: number;
  accountLockoutsPerHour: number;
}

/**
 * Default alert thresholds
 */
const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRatePerMinute: 100, // 100 errors per minute
  latencyP95Ms: 1000, // 1 second
  failedLoginsPerMinute: 50, // 50 failed logins per minute
  accountLockoutsPerHour: 10, // 10 account lockouts per hour
};

/**
 * Alerting service for monitoring and alerting
 * Requirements: 18.4 - Configure alerts for high error rates, high latency, security events, and system health issues
 */
export class AlertingService {
  private thresholds: AlertThresholds;
  private alertHistory: Map<string, Date> = new Map();
  private readonly cooldownPeriodMs = 5 * 60 * 1000; // 5 minutes cooldown between same alerts

  constructor(thresholds: Partial<AlertThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Send an alert
   * Requirements: 18.4
   */
  async sendAlert(alert: Alert): Promise<void> {
    // Check if we should send this alert (cooldown period)
    const alertKey = `${alert.type}-${alert.severity}`;
    const lastAlertTime = this.alertHistory.get(alertKey);

    if (lastAlertTime) {
      const timeSinceLastAlert = Date.now() - lastAlertTime.getTime();
      if (timeSinceLastAlert < this.cooldownPeriodMs) {
        // Skip alert due to cooldown
        return;
      }
    }

    // Update alert history
    this.alertHistory.set(alertKey, new Date());

    // Log the alert
    logger.error(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, {
      alertType: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp,
      metadata: alert.metadata,
    });

    // Track security events metric
    if (alert.type === AlertType.SECURITY_EVENT) {
      securityEvents.inc({
        event_type: (alert.metadata?.eventType as string) || 'unknown',
        severity: alert.severity,
      });
    }

    // In production, this would integrate with:
    // - PagerDuty for critical alerts
    // - Slack/Teams for warning alerts
    // - Email for info alerts
    // - Prometheus Alertmanager
    // - Datadog/New Relic alerting

    // For now, we just log the alert
    await this.notifyAlertChannels(alert);
  }

  /**
   * Alert on high error rate
   * Requirements: 18.4
   */
  async alertHighErrorRate(errorCount: number, timeWindowMinutes: number): Promise<void> {
    const errorRate = errorCount / timeWindowMinutes;

    if (errorRate > this.thresholds.errorRatePerMinute) {
      await this.sendAlert({
        type: AlertType.HIGH_ERROR_RATE,
        severity: AlertSeverity.ERROR,
        message: `High error rate detected: ${errorRate.toFixed(2)} errors/minute`,
        timestamp: new Date(),
        metadata: {
          errorCount,
          timeWindowMinutes,
          errorRate,
          threshold: this.thresholds.errorRatePerMinute,
        },
      });
    }
  }

  /**
   * Alert on high latency
   * Requirements: 18.4
   */
  async alertHighLatency(p95LatencyMs: number, endpoint: string): Promise<void> {
    if (p95LatencyMs > this.thresholds.latencyP95Ms) {
      await this.sendAlert({
        type: AlertType.HIGH_LATENCY,
        severity: AlertSeverity.WARNING,
        message: `High latency detected on ${endpoint}: ${p95LatencyMs}ms (p95)`,
        timestamp: new Date(),
        metadata: {
          endpoint,
          p95LatencyMs,
          threshold: this.thresholds.latencyP95Ms,
        },
      });
    }
  }

  /**
   * Alert on security events
   * Requirements: 18.4
   */
  async alertSecurityEvent(
    eventType: string,
    severity: AlertSeverity,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.sendAlert({
      type: AlertType.SECURITY_EVENT,
      severity,
      message: `Security event: ${message}`,
      timestamp: new Date(),
      metadata: {
        eventType,
        ...metadata,
      },
    });
  }

  /**
   * Alert on system health issues
   * Requirements: 18.4
   */
  async alertSystemHealth(
    component: string,
    status: 'degraded' | 'down',
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const severity = status === 'down' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

    await this.sendAlert({
      type: AlertType.SYSTEM_HEALTH,
      severity,
      message: `System health issue in ${component}: ${message}`,
      timestamp: new Date(),
      metadata: {
        component,
        status,
        ...metadata,
      },
    });
  }

  /**
   * Alert on multiple failed login attempts
   * Requirements: 18.4
   */
  async alertFailedLoginAttempts(
    failedAttempts: number,
    timeWindowMinutes: number,
    ipAddress?: string
  ): Promise<void> {
    const attemptRate = failedAttempts / timeWindowMinutes;

    if (attemptRate > this.thresholds.failedLoginsPerMinute) {
      await this.sendAlert({
        type: AlertType.FAILED_LOGIN_ATTEMPTS,
        severity: AlertSeverity.WARNING,
        message: `High rate of failed login attempts: ${attemptRate.toFixed(2)} attempts/minute`,
        timestamp: new Date(),
        metadata: {
          failedAttempts,
          timeWindowMinutes,
          attemptRate,
          threshold: this.thresholds.failedLoginsPerMinute,
          ipAddress,
        },
      });
    }
  }

  /**
   * Alert on account lockouts
   * Requirements: 18.4
   */
  async alertAccountLockout(userId: string, email: string, reason: string): Promise<void> {
    await this.sendAlert({
      type: AlertType.ACCOUNT_LOCKOUT,
      severity: AlertSeverity.WARNING,
      message: `Account locked: ${email}`,
      timestamp: new Date(),
      metadata: {
        userId,
        email,
        reason,
      },
    });
  }

  /**
   * Notify alert channels (placeholder for actual integrations)
   */
  private async notifyAlertChannels(alert: Alert): Promise<void> {
    // In production, implement actual notification channels:
    // - PagerDuty API for critical alerts
    // - Slack webhook for warnings
    // - Email service for info alerts
    // - SMS for critical security events

    // For now, just log that we would notify
    logger.info('Alert notification sent', {
      type: alert.type,
      severity: alert.severity,
      channels: this.getChannelsForSeverity(alert.severity),
    });
  }

  /**
   * Get notification channels based on severity
   */
  private getChannelsForSeverity(severity: AlertSeverity): string[] {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return ['pagerduty', 'slack', 'email', 'sms'];
      case AlertSeverity.ERROR:
        return ['slack', 'email'];
      case AlertSeverity.WARNING:
        return ['slack'];
      case AlertSeverity.INFO:
        return ['email'];
      default:
        return [];
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
