/**
 * Email Job Processor
 * Processes email jobs from the queue
 * Requirements: 1.6, 2.1, 10.1
 */

import { Job } from 'bullmq';
import { logger } from '../../../shared/logging/logger.js';
import type { IEmailService } from '../../../shared/application/services/email.service.js';
import {
  EMAIL_JOB_TYPES,
  EmailVerificationJobData,
  PasswordResetJobData,
  SecurityAlertJobData,
  WelcomeEmailJobData,
} from '../jobs/email-jobs.js';

export class EmailProcessor {
  constructor(private readonly emailService: IEmailService) {}

  /**
   * Process email jobs based on job type
   */
  async process(job: Job): Promise<void> {
    const name = job.name;
    const data: unknown = job.data;

    logger.info('Processing email job', {
      jobId: job.id,
      jobType: name,
      attempt: job.attemptsMade + 1,
    });

    try {
      switch (name) {
        case EMAIL_JOB_TYPES.VERIFICATION:
          await this.processVerificationEmail(data as EmailVerificationJobData);
          break;

        case EMAIL_JOB_TYPES.PASSWORD_RESET:
          await this.processPasswordResetEmail(data as PasswordResetJobData);
          break;

        case EMAIL_JOB_TYPES.SECURITY_ALERT:
          await this.processSecurityAlertEmail(data as SecurityAlertJobData);
          break;

        case EMAIL_JOB_TYPES.WELCOME:
          await this.processWelcomeEmail(data as WelcomeEmailJobData);
          break;

        default:
          logger.warn('Unknown email job type', { jobType: name });
          throw new Error(`Unknown email job type: ${String(name)}`);
      }

      logger.info('Email job completed successfully', {
        jobId: job.id,
        jobType: name,
      });
    } catch (error) {
      logger.error('Email job processing failed', {
        jobId: job.id,
        jobType: name,
        error: error instanceof Error ? error.message : String(error),
        attempt: job.attemptsMade + 1,
      });
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Process email verification job
   * Requirement: 1.6, 2.1
   */
  private async processVerificationEmail(data: EmailVerificationJobData): Promise<void> {
    await this.emailService.sendVerificationEmail({
      to: data.to,
      name: data.name,
      verificationToken: data.verificationToken,
      verificationUrl: data.verificationUrl,
    });

    logger.debug('Verification email sent', {
      to: data.to,
    });
  }

  /**
   * Process password reset email job
   * Requirement: 10.1
   */
  private async processPasswordResetEmail(data: PasswordResetJobData): Promise<void> {
    await this.emailService.sendPasswordResetEmail({
      to: data.to,
      name: data.name,
      resetToken: data.resetToken,
      resetUrl: data.resetUrl,
    });

    logger.debug('Password reset email sent', {
      to: data.to,
    });
  }

  /**
   * Process security alert email job
   * Requirement: 13.4
   */
  private async processSecurityAlertEmail(data: SecurityAlertJobData): Promise<void> {
    await this.emailService.sendSecurityAlertEmail({
      to: data.to,
      name: data.name,
      alertType: data.alertType,
      alertMessage: data.alertMessage,
      timestamp: data.timestamp,
      ipAddress: data.ipAddress,
      location: data.location,
    });

    logger.debug('Security alert email sent', {
      to: data.to,
      alertType: data.alertType,
    });
  }

  /**
   * Process welcome email job
   * Requirement: 1.6
   */
  private async processWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    await this.emailService.sendWelcomeEmail({
      to: data.to,
      name: data.name,
    });

    logger.debug('Welcome email sent', {
      to: data.to,
    });
  }
}
