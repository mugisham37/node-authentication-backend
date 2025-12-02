# Infrastructure Layer

This directory contains the implementation of external services and infrastructure concerns for the Enterprise Authentication System.

## Services Implemented

### Email Service (`email/`)

Production-ready email service with:
- **Template Rendering**: Handlebars-based HTML email templates
- **Queue-Based Delivery**: BullMQ for async processing with retry logic
- **Multiple Email Types**: Verification, password reset, security alerts, welcome emails
- **Circuit Breaker Protection**: Resilient email delivery with automatic failure handling
- **Retry Logic**: Exponential backoff with 3 attempts

**Templates Available:**
- Email verification
- Password reset
- Security alerts
- Welcome emails

See [email/README.md](./email/README.md) for detailed usage.

### SMS Service (`sms/`)

Twilio-based SMS service with:
- **E.164 Phone Validation**: Automatic phone number format validation
- **Retry Logic**: Exponential backoff with 3 attempts
- **Circuit Breaker Protection**: Resilient SMS delivery
- **MFA Support**: Optimized for sending verification codes

**Features:**
- Send SMS messages
- Validate phone numbers (E.164 format)
- Automatic retry on failure
- Circuit breaker for service protection

### Rate Limiting Service (`rate-limit/`)

Redis-based sliding window rate limiting with:
- **Per-IP Rate Limits**: Protect against abuse from specific IPs
- **Per-User Rate Limits**: User-specific rate limiting
- **Endpoint-Specific Limits**: Different limits for different endpoints
- **Trust-Based Adjustment**: Relaxed limits for high-trust users
- **Sliding Window Algorithm**: Accurate rate limiting using Redis sorted sets

**Default Configurations:**
- Authentication endpoints: 10 requests/minute
- Registration: 3 requests/5 minutes
- Password reset: 5 requests/minute
- MFA verification: 1 request/10 seconds

### Webhook Delivery Service (`webhook/`)

Async webhook delivery with:
- **Queue-Based Delivery**: BullMQ for reliable async delivery
- **HMAC Signatures**: Secure webhook verification
- **Retry Logic**: Exponential backoff up to 5 attempts
- **Delivery Tracking**: Track attempts and status
- **Concurrent Processing**: Process up to 10 webhooks simultaneously

**Features:**
- Publish webhook events
- Deliver webhooks with signatures
- Automatic retry on failure
- Track delivery status

## Resilience Patterns

### Circuit Breaker (`../core/resilience/`)

Implemented for all external services to prevent cascading failures:

**Configuration:**
- Failure Threshold: 5 failures before opening
- Success Threshold: 2 successes to close from half-open
- Timeout: 30 seconds for operations
- Reset Timeout: 60 seconds before attempting to close

**States:**
- **Closed**: Normal operation
- **Open**: Rejecting requests after threshold failures
- **Half-Open**: Testing if service recovered

**Protected Services:**
- Email service
- SMS service
- OAuth providers (when implemented)

## Queue Infrastructure

All async operations use BullMQ with Redis:

**Email Queue:**
- Concurrency: 5 emails simultaneously
- Retry: 3 attempts with exponential backoff
- Retention: 24 hours for completed, 7 days for failed

**Webhook Queue:**
- Concurrency: 10 webhooks simultaneously
- Retry: 5 attempts with exponential backoff
- Retention: 24 hours for completed, 7 days for failed

## Configuration

All services require environment variables. See individual service directories for specific configuration requirements.

**Common Environment Variables:**
```env
# Redis (required for all services)
REDIS_HOST=localhost
REDIS_PORT=6379

# Email Service
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM="Enterprise Auth" <noreply@example.com>
EMAIL_USE_QUEUE=true

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

## Usage Examples

### Email Service

```typescript
import { EmailServiceFactory } from './infrastructure/email';
import { Redis } from 'ioredis';

const redis = new Redis();
const emailService = EmailServiceFactory.create(config, redis);

await emailService.sendVerificationEmail({
  to: 'user@example.com',
  name: 'John Doe',
  verificationToken: 'abc123',
  verificationUrl: 'https://example.com/verify?token=abc123',
});
```

### SMS Service

```typescript
import { SMSService } from './infrastructure/sms';

const smsService = new SMSService(twilioConfig);

await smsService.sendSMS({
  to: '+14155552671',
  message: 'Your verification code is: 123456',
});
```

### Rate Limiting

```typescript
import { RateLimitService } from './infrastructure/rate-limit';

const rateLimitService = new RateLimitService(redis);

const result = await rateLimitService.checkRateLimit(
  ipAddress,
  '/api/v1/auth/login',
  trustScore,
);

if (!result.allowed) {
  throw new RateLimitError(result.retryAfter);
}
```

### Webhook Delivery

```typescript
import { WebhookDeliveryServiceFactory } from './infrastructure/webhook';

const webhookService = WebhookDeliveryServiceFactory.create(redis);

await webhookService.publishEvent({
  type: 'user.registered',
  payload: { userId: '123', email: 'user@example.com' },
  webhookId: 'webhook-id',
  webhookUrl: 'https://example.com/webhook',
  secret: 'webhook-secret',
});
```

## Testing

All services include comprehensive error handling and logging. For testing:

1. Use test SMTP services (e.g., Ethereal) for email
2. Use Twilio test credentials for SMS
3. Use Redis in-memory for rate limiting
4. Mock webhook endpoints for delivery testing

## Monitoring

All services emit structured logs and metrics:

- Email queue metrics
- Webhook queue metrics
- Rate limit metrics
- Circuit breaker states

Monitor these metrics to ensure service health and performance.
