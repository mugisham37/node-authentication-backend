# Email Service

Enterprise-grade email service with template rendering, queue-based delivery, and retry logic.

## Features

- **Template Rendering**: Handlebars-based email templates
- **Queue-Based Delivery**: BullMQ for async email processing with retry logic
- **Multiple Email Types**: Verification, password reset, security alerts, welcome emails
- **Retry Logic**: Automatic retry with exponential backoff (3 attempts)
- **Priority Queue**: Security alerts get highest priority
- **HTML & Text**: Automatic text version generation from HTML

## Usage

### Initialize the Service

```typescript
import { EmailServiceFactory } from './infrastructure/email';
import { Redis } from 'ioredis';

const redisConnection = new Redis({
  host: 'localhost',
  port: 6379,
});

const emailService = EmailServiceFactory.create(
  {
    nodemailer: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'your-email@example.com',
        pass: 'your-password',
      },
      from: '"Enterprise Auth" <noreply@example.com>',
    },
    useQueue: true,
  },
  redisConnection
);
```

### Send Verification Email

```typescript
await emailService.sendVerificationEmail({
  to: 'user@example.com',
  name: 'John Doe',
  verificationToken: 'abc123',
  verificationUrl: 'https://example.com/verify?token=abc123',
});
```

### Send Password Reset Email

```typescript
await emailService.sendPasswordResetEmail({
  to: 'user@example.com',
  name: 'John Doe',
  resetToken: 'xyz789',
  resetUrl: 'https://example.com/reset-password?token=xyz789',
});
```

### Send Security Alert

```typescript
await emailService.sendSecurityAlertEmail({
  to: 'user@example.com',
  name: 'John Doe',
  alertType: 'New Device Login',
  alertMessage: 'A new device was used to access your account.',
  timestamp: new Date(),
  ipAddress: '192.168.1.1',
  location: 'New York, USA',
});
```

### Send Welcome Email

```typescript
await emailService.sendWelcomeEmail({
  to: 'user@example.com',
  name: 'John Doe',
});
```

## Configuration

### Environment Variables

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM="Enterprise Auth" <noreply@example.com>
EMAIL_USE_QUEUE=true
```

### Queue Configuration

The email queue uses BullMQ with the following settings:

- **Attempts**: 3 retries on failure
- **Backoff**: Exponential with 2-second initial delay
- **Concurrency**: 5 emails processed simultaneously
- **Retention**: Completed jobs kept for 24 hours, failed jobs for 7 days

### Priority Levels

1. Security alerts (highest)
2. Verification emails
3. Password reset emails
4. Other emails (default)

## Templates

Templates are located in `src/core/mail/templates/` and use Handlebars syntax.

Available templates:
- `verification-email.hbs`
- `password-reset.hbs`
- `security-alert.hbs`
- `welcome.hbs`

## Monitoring

Get queue metrics:

```typescript
const metrics = await emailService.getQueueMetrics();
console.log(metrics);
// {
//   waiting: 5,
//   active: 2,
//   completed: 100,
//   failed: 3,
//   delayed: 0
// }
```

Verify email connection:

```typescript
const isConnected = await emailService.verifyConnection();
```

## Error Handling

The service includes comprehensive error handling:

- Failed emails are automatically retried (3 attempts)
- All errors are logged with context
- Failed jobs are retained for 7 days for debugging
- Circuit breaker pattern can be applied at the service level

## Testing

For testing, you can disable the queue and send emails directly:

```typescript
const emailService = EmailServiceFactory.create(
  {
    nodemailer: config,
    useQueue: false, // Send directly without queue
  },
  redisConnection
);
```

Or use a test SMTP service like Ethereal:

```typescript
import nodemailer from 'nodemailer';

const testAccount = await nodemailer.createTestAccount();

const emailService = EmailServiceFactory.create(
  {
    nodemailer: {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      from: '"Test" <test@example.com>',
    },
    useQueue: false,
  },
  redisConnection
);
```
