# BullMQ Job Queue System

This directory contains the BullMQ-based job queue system for handling asynchronous operations in the Enterprise Authentication System.

## Overview

The queue system is organized into four main queues:

1. **Email Queue** - Handles email sending operations
2. **Webhook Queue** - Handles webhook delivery with retry logic
3. **Audit Log Queue** - Handles async audit log creation
4. **Cleanup Queue** - Handles scheduled cleanup of expired data

## Architecture

```
queue/
├── jobs/              # Job type definitions
│   ├── email-jobs.ts
│   ├── webhook-jobs.ts
│   ├── audit-log-jobs.ts
│   └── cleanup-jobs.ts
├── processors/        # Job processors
│   ├── email-processor.ts
│   ├── webhook-processor.ts
│   ├── audit-log-processor.ts
│   └── cleanup-processor.ts
├── email-queue.ts     # Email queue implementation
├── webhook-queue.ts   # Webhook queue implementation
├── audit-log-queue.ts # Audit log queue implementation
├── cleanup-queue.ts   # Cleanup queue implementation
├── queue-manager.ts   # Central queue manager
└── index.ts          # Exports
```

## Usage

### Initialize Queue Manager

```typescript
import { QueueManager } from './core/queue';
import { getRedisConnection } from './core/cache/redis';

const queueManager = new QueueManager({
  redisConnection: getRedisConnection(),
  emailService,
  auditLogRepository,
  sessionRepository,
  deviceRepository,
});

await queueManager.initialize();
```

### Email Jobs

```typescript
const emailQueue = queueManager.getEmailQueue();

// Send verification email
await emailQueue.addVerificationEmail({
  to: 'user@example.com',
  name: 'John Doe',
  verificationToken: 'token123',
  verificationUrl: 'https://example.com/verify?token=token123',
});

// Send password reset email
await emailQueue.addPasswordResetEmail({
  to: 'user@example.com',
  name: 'John Doe',
  resetToken: 'reset123',
  resetUrl: 'https://example.com/reset?token=reset123',
});

// Send security alert
await emailQueue.addSecurityAlertEmail({
  to: 'user@example.com',
  name: 'John Doe',
  alertType: 'suspicious_login',
  alertMessage: 'Login from new location detected',
  timestamp: new Date(),
  ipAddress: '192.168.1.1',
  location: 'New York, US',
});

// Send welcome email
await emailQueue.addWelcomeEmail({
  to: 'user@example.com',
  name: 'John Doe',
});
```

### Webhook Jobs

```typescript
const webhookQueue = queueManager.getWebhookQueue();

await webhookQueue.addWebhookJob({
  webhookId: 'webhook-123',
  webhookUrl: 'https://example.com/webhook',
  webhookSecret: 'secret123',
  eventType: 'user.registered',
  payload: {
    userId: 'user-123',
    email: 'user@example.com',
    timestamp: new Date().toISOString(),
  },
  attemptCount: 0,
});
```

### Audit Log Jobs

```typescript
const auditLogQueue = queueManager.getAuditLogQueue();

await auditLogQueue.addAuditLog({
  userId: 'user-123',
  action: 'login',
  resource: 'session',
  resourceId: 'session-456',
  status: 'success',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  metadata: {
    deviceName: 'Chrome on Windows',
  },
});
```

### Cleanup Jobs

```typescript
const cleanupQueue = queueManager.getCleanupQueue();

// Cleanup jobs are scheduled automatically on initialization
// Manual triggers are also available:

// Trigger session cleanup
await cleanupQueue.triggerSessionCleanup(1000);

// Trigger token cleanup
await cleanupQueue.triggerTokenCleanup(1000);

// Trigger device cleanup
await cleanupQueue.triggerDeviceCleanup(90, 1000);
```

## Job Priorities

### Email Queue
- Security alerts: Priority 1 (highest)
- Verification emails: Priority 2
- Password reset: Priority 3
- Welcome emails: Priority 5 (lowest)

### Audit Log Queue
- Failures: Priority 1
- Security-critical actions: Priority 2
- Other actions: Priority 5

## Retry Logic

### Email Jobs
- Attempts: 3
- Backoff: Exponential starting at 2 seconds

### Webhook Jobs
- Attempts: 5 (Requirement 16.3)
- Backoff: Exponential starting at 2 seconds
- Delays: 2s, 4s, 8s, 16s, 32s

### Audit Log Jobs
- Attempts: 3
- Backoff: Exponential starting at 1 second

### Cleanup Jobs
- Attempts: 3
- Backoff: Exponential starting at 5 seconds

## Scheduled Jobs

The cleanup queue automatically schedules the following jobs:

- **Session Cleanup**: Every hour (cron: `0 * * * *`)
- **Token Cleanup**: Every 6 hours (cron: `0 */6 * * *`)
- **Device Cleanup**: Daily at 2 AM (cron: `0 2 * * *`)

## Monitoring

Get metrics for all queues:

```typescript
const metrics = await queueManager.getAllQueueMetrics();

console.log(metrics);
// {
//   email: { waiting: 5, active: 2, completed: 100, failed: 1, delayed: 0 },
//   webhook: { waiting: 3, active: 1, completed: 50, failed: 2, delayed: 0 },
//   auditLog: { waiting: 10, active: 5, completed: 1000, failed: 0, delayed: 0 },
//   cleanup: { waiting: 0, active: 0, completed: 10, failed: 0, delayed: 3 }
// }
```

## Shutdown

```typescript
await queueManager.shutdown();
```

## Requirements Mapping

- **Email Jobs**: Requirements 1.6, 2.1, 10.1
- **Webhook Jobs**: Requirements 16.2, 16.3, 16.4
- **Audit Log Jobs**: Requirements 13.1, 13.2, 13.3, 13.4, 13.6
- **Cleanup Jobs**: Requirements 7.5, 15.6

## Notes

- All queues use Redis for job storage and coordination
- Workers process jobs concurrently (configurable per queue)
- Failed jobs are retained for debugging (7-30 days depending on queue)
- Completed jobs are retained for a shorter period (24 hours - 7 days)
- The system is designed to be horizontally scalable across multiple instances
