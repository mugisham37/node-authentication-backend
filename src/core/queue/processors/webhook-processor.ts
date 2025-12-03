/**
 * Webhook Job Processor
 * Processes webhook delivery jobs with retry logic
 * Requirements: 16.2, 16.3, 16.4
 */

import { Job } from 'bullmq';
import crypto from 'crypto';
import { logger } from '../../../shared/logging/logger.js';
import { WebhookJobData } from '../jobs/webhook-jobs.js';

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  deliveredAt?: Date;
}

export class WebhookProcessor {
  /**
   * Process webhook delivery job
   * Requirements: 16.2, 16.3, 16.4
   */
  async process(job: Job<WebhookJobData>): Promise<WebhookDeliveryResult> {
    const { webhookId, webhookUrl, webhookSecret, eventType, payload, attemptCount } = job.data;

    logger.info('Processing webhook delivery job', {
      jobId: job.id,
      webhookId,
      eventType,
      url: webhookUrl,
      attempt: job.attemptsMade + 1,
      totalAttempts: attemptCount,
    });

    try {
      // Generate HMAC signature (Requirement: 16.4)
      const signature = this.generateSignature(payload, webhookSecret);

      // Prepare request
      const requestBody = JSON.stringify(payload);
      const timestamp = new Date().toISOString();

      // Send HTTP POST request (Requirement: 16.2)
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-ID': webhookId,
          'User-Agent': 'Enterprise-Auth-System/1.0',
        },
        body: requestBody,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseBody = await response.text();

      if (response.ok) {
        logger.info('Webhook delivered successfully', {
          jobId: job.id,
          webhookId,
          statusCode: response.status,
        });

        return {
          success: true,
          statusCode: response.status,
          responseBody: responseBody.substring(0, 1000), // Limit response body size
          deliveredAt: new Date(),
        };
      } else {
        logger.warn('Webhook delivery failed with non-2xx status', {
          jobId: job.id,
          webhookId,
          statusCode: response.status,
          responseBody: responseBody.substring(0, 500),
        });

        throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Webhook delivery failed', {
        jobId: job.id,
        webhookId,
        error: errorMessage,
        attempt: job.attemptsMade + 1,
      });

      // Re-throw to trigger retry (Requirement: 16.3)
      throw error;
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   * Requirement: 16.4
   */
  private generateSignature(payload: Record<string, unknown>, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Calculate next retry delay with exponential backoff
   * Requirement: 16.3
   */
  static calculateRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 2^attempt * 1000ms
    // Attempt 1: 2 seconds
    // Attempt 2: 4 seconds
    // Attempt 3: 8 seconds
    // Attempt 4: 16 seconds
    // Attempt 5: 32 seconds
    const baseDelay = 1000;
    const maxDelay = 60000; // Cap at 60 seconds

    const delay = Math.min(Math.pow(2, attemptNumber) * baseDelay, maxDelay);
    return delay;
  }
}
