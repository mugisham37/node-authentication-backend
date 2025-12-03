/**
 * Webhook Job Definitions
 * Requirements: 16.2, 16.3
 */

export interface WebhookJobData {
  webhookId: string;
  webhookUrl: string;
  webhookSecret: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  deliveryId?: string;
}

export const WEBHOOK_JOB_TYPES = {
  DELIVER: 'webhook:deliver',
} as const;

export type WebhookJobType = (typeof WEBHOOK_JOB_TYPES)[keyof typeof WEBHOOK_JOB_TYPES];
