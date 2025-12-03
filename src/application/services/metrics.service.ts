import { IUserRepository } from '../../domain/repositories/user.repository.interface.js';
import { ISessionRepository } from '../../domain/repositories/session.repository.js';
import { IAuditLogRepository } from '../../domain/repositories/audit-log.repository.js';
import { log } from '../../infrastructure/logging/logger.js';

/**
 * System metrics overview
 * Requirements: 26.7
 */
export interface SystemMetrics {
  users: {
    total: number;
    active: number;
    locked: number;
    deleted: number;
    verifiedEmail: number;
    mfaEnabled: number;
  };
  sessions: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
  };
  security: {
    failedLogins: number;
    accountLockouts: number;
    highRiskEvents: number;
  };
  timestamp: Date;
}

/**
 * User growth metrics over time
 * Requirements: 26.7
 */
export interface UserMetrics {
  period: string;
  registrations: number;
  deletions: number;
  netGrowth: number;
  totalUsers: number;
}

/**
 * Security event metrics
 * Requirements: 26.7
 */
export interface SecurityMetrics {
  period: string;
  failedLogins: number;
  accountLockouts: number;
  passwordResets: number;
  mfaEnablements: number;
  suspiciousActivities: number;
  highRiskEvents: number;
}

/**
 * Metrics Service Interface
 * Requirements: 26.7
 */
export interface IMetricsService {
  /**
   * Get system overview metrics
   */
  getSystemOverview(): Promise<SystemMetrics>;

  /**
   * Get user growth metrics over time
   */
  getUserMetrics(params: {
    startDate: Date;
    endDate: Date;
    granularity: 'day' | 'week' | 'month';
  }): Promise<UserMetrics[]>;

  /**
   * Get security event metrics
   */
  getSecurityMetrics(params: {
    startDate: Date;
    endDate: Date;
    granularity: 'day' | 'week' | 'month';
  }): Promise<SecurityMetrics[]>;
}

/**
 * Metrics Service Implementation
 * Provides aggregated metrics for admin dashboard
 * Requirements: 26.7
 */
export class MetricsService implements IMetricsService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  /**
   * Get system overview metrics
   * Requirements: 26.7
   */
  async getSystemOverview(): Promise<SystemMetrics> {
    try {
      // Get all users
      const allUsers = await this.userRepository.findAll();

      // Calculate user metrics
      const totalUsers = allUsers.length;
      const activeUsers = allUsers.filter((u) => !u.accountLocked && !u.deletedAt).length;
      const lockedUsers = allUsers.filter((u) => u.accountLocked).length;
      const deletedUsers = allUsers.filter((u) => u.deletedAt !== null).length;
      const verifiedEmailUsers = allUsers.filter((u) => u.emailVerified).length;
      const mfaEnabledUsers = allUsers.filter((u) => u.mfaEnabled).length;

      // Get all sessions
      const allSessions = await this.sessionRepository.findAll();

      // Calculate session metrics
      const totalSessions = allSessions.length;
      const activeSessions = allSessions.filter((s) => !s.isExpired() && !s.isRevoked()).length;
      const expiredSessions = allSessions.filter((s) => s.isExpired()).length;
      const revokedSessions = allSessions.filter((s) => s.isRevoked()).length;

      // Get security metrics from audit logs (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLogs = await this.auditLogRepository.query({
        startDate: yesterday,
        endDate: new Date(),
      });

      const failedLogins = recentLogs.filter(
        (log) => log.action === 'login' && log.status === 'failure'
      ).length;

      const accountLockouts = recentLogs.filter((log) => log.action === 'account_locked').length;

      const highRiskEvents = recentLogs.filter((log) => log.isHighRisk()).length;

      const metrics: SystemMetrics = {
        users: {
          total: totalUsers,
          active: activeUsers,
          locked: lockedUsers,
          deleted: deletedUsers,
          verifiedEmail: verifiedEmailUsers,
          mfaEnabled: mfaEnabledUsers,
        },
        sessions: {
          total: totalSessions,
          active: activeSessions,
          expired: expiredSessions,
          revoked: revokedSessions,
        },
        security: {
          failedLogins,
          accountLockouts,
          highRiskEvents,
        },
        timestamp: new Date(),
      };

      log.info('System metrics retrieved', { metrics });

      return metrics;
    } catch (error) {
      log.error('Failed to get system overview', error as Error);
      throw error;
    }
  }

  /**
   * Get user growth metrics over time
   * Requirements: 26.7
   */
  async getUserMetrics(params: {
    startDate: Date;
    endDate: Date;
    granularity: 'day' | 'week' | 'month';
  }): Promise<UserMetrics[]> {
    try {
      // Get audit logs for user registrations and deletions
      const logs = await this.auditLogRepository.query({
        startDate: params.startDate,
        endDate: params.endDate,
        actions: ['user_registered', 'user_deleted'],
      });

      // Group by time period
      const periods = this.generateTimePeriods(
        params.startDate,
        params.endDate,
        params.granularity
      );

      const metrics: UserMetrics[] = [];
      let cumulativeTotal = 0;

      for (const period of periods) {
        const periodLogs = logs.filter(
          (log) => log.createdAt >= period.start && log.createdAt < period.end
        );

        const registrations = periodLogs.filter((log) => log.action === 'user_registered').length;
        const deletions = periodLogs.filter((log) => log.action === 'user_deleted').length;
        const netGrowth = registrations - deletions;
        cumulativeTotal += netGrowth;

        metrics.push({
          period: period.label,
          registrations,
          deletions,
          netGrowth,
          totalUsers: cumulativeTotal,
        });
      }

      log.info('User metrics retrieved', {
        startDate: params.startDate,
        endDate: params.endDate,
        granularity: params.granularity,
        periodsCount: metrics.length,
      });

      return metrics;
    } catch (error) {
      log.error('Failed to get user metrics', error as Error, params);
      throw error;
    }
  }

  /**
   * Get security event metrics
   * Requirements: 26.7
   */
  async getSecurityMetrics(params: {
    startDate: Date;
    endDate: Date;
    granularity: 'day' | 'week' | 'month';
  }): Promise<SecurityMetrics[]> {
    try {
      // Get audit logs for security events
      const logs = await this.auditLogRepository.query({
        startDate: params.startDate,
        endDate: params.endDate,
        actions: [
          'login',
          'account_locked',
          'password_reset',
          'mfa_enabled',
          'suspicious_activity',
        ],
      });

      // Group by time period
      const periods = this.generateTimePeriods(
        params.startDate,
        params.endDate,
        params.granularity
      );

      const metrics: SecurityMetrics[] = [];

      for (const period of periods) {
        const periodLogs = logs.filter(
          (log) => log.createdAt >= period.start && log.createdAt < period.end
        );

        const failedLogins = periodLogs.filter(
          (log) => log.action === 'login' && log.status === 'failure'
        ).length;

        const accountLockouts = periodLogs.filter((log) => log.action === 'account_locked').length;

        const passwordResets = periodLogs.filter((log) => log.action === 'password_reset').length;

        const mfaEnablements = periodLogs.filter((log) => log.action === 'mfa_enabled').length;

        const suspiciousActivities = periodLogs.filter(
          (log) => log.action === 'suspicious_activity'
        ).length;

        const highRiskEvents = periodLogs.filter((log) => log.isHighRisk()).length;

        metrics.push({
          period: period.label,
          failedLogins,
          accountLockouts,
          passwordResets,
          mfaEnablements,
          suspiciousActivities,
          highRiskEvents,
        });
      }

      log.info('Security metrics retrieved', {
        startDate: params.startDate,
        endDate: params.endDate,
        granularity: params.granularity,
        periodsCount: metrics.length,
      });

      return metrics;
    } catch (error) {
      log.error('Failed to get security metrics', error as Error, params);
      throw error;
    }
  }

  /**
   * Generate time periods for metrics aggregation
   */
  private generateTimePeriods(
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month'
  ): Array<{ start: Date; end: Date; label: string }> {
    const periods: Array<{ start: Date; end: Date; label: string }> = [];
    let current = new Date(startDate);

    while (current < endDate) {
      const periodStart = new Date(current);
      let periodEnd: Date;
      let label: string;

      switch (granularity) {
        case 'day':
          periodEnd = new Date(current);
          periodEnd.setDate(periodEnd.getDate() + 1);
          label = periodStart.toISOString().split('T')[0] || '';
          break;
        case 'week':
          periodEnd = new Date(current);
          periodEnd.setDate(periodEnd.getDate() + 7);
          label = `Week of ${periodStart.toISOString().split('T')[0]}`;
          break;
        case 'month':
          periodEnd = new Date(current);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          label = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      // Don't exceed end date
      if (periodEnd > endDate) {
        periodEnd = new Date(endDate);
      }

      periods.push({
        start: periodStart,
        end: periodEnd,
        label,
      });

      current = periodEnd;
    }

    return periods;
  }
}
