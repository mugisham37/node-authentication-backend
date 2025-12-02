/**
 * Cleanup Job Definitions
 * Requirements: 7.5, 15.6
 */

export interface SessionCleanupJobData {
  batchSize?: number;
}

export interface TokenCleanupJobData {
  batchSize?: number;
}

export interface DeviceCleanupJobData {
  batchSize?: number;
  inactiveDays?: number;
}

export const CLEANUP_JOB_TYPES = {
  SESSION: 'cleanup:sessions',
  TOKEN: 'cleanup:tokens',
  DEVICE: 'cleanup:devices',
} as const;

export type CleanupJobType = (typeof CLEANUP_JOB_TYPES)[keyof typeof CLEANUP_JOB_TYPES];
