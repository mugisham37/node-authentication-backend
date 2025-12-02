/**
 * Queue Module Exports
 * Central export point for all queue-related functionality
 */

// Queue classes
export { EmailQueue } from './email-queue.js';
export { WebhookQueue } from './webhook-queue.js';
export { AuditLogQueue } from './audit-log-queue.js';
export { CleanupQueue } from './cleanup-queue.js';
export { QueueManager } from './queue-manager.js';
export type { QueueManagerConfig } from './queue-manager.js';

// Job types
export * from './jobs/email-jobs.js';
export * from './jobs/webhook-jobs.js';
export * from './jobs/audit-log-jobs.js';
export * from './jobs/cleanup-jobs.js';

// Processors
export { EmailProcessor } from './processors/email-processor.js';
export { WebhookProcessor } from './processors/webhook-processor.js';
export { AuditLogProcessor } from './processors/audit-log-processor.js';
export { CleanupProcessor } from './processors/cleanup-processor.js';
export type { CleanupResult } from './processors/cleanup-processor.js';
export type { WebhookDeliveryResult } from './processors/webhook-processor.js';
export type { SecurityAlert } from './processors/audit-log-processor.js';
