import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// HTTP Request metrics
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

// Authentication metrics
export const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'],
  registers: [register],
});

export const authenticationDuration = new Histogram({
  name: 'authentication_duration_seconds',
  help: 'Duration of authentication operations in seconds',
  labelNames: ['method'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [register],
});

// Authorization metrics
export const authorizationChecks = new Counter({
  name: 'authorization_checks_total',
  help: 'Total number of authorization checks',
  labelNames: ['resource', 'action', 'result'],
  registers: [register],
});

export const authorizationDuration = new Histogram({
  name: 'authorization_duration_seconds',
  help: 'Duration of authorization checks in seconds',
  labelNames: ['resource', 'action'],
  buckets: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05],
  registers: [register],
});

// Database metrics
export const databaseQueryCounter = new Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const databaseConnectionPool = new Gauge({
  name: 'database_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['state'],
  registers: [register],
});

// Cache metrics
export const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  registers: [register],
});

// Business metrics
export const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['method'],
  registers: [register],
});

export const userLogins = new Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['method', 'mfa_enabled'],
  registers: [register],
});

export const passwordResets = new Counter({
  name: 'password_resets_total',
  help: 'Total number of password resets',
  registers: [register],
});

export const mfaEnablements = new Counter({
  name: 'mfa_enablements_total',
  help: 'Total number of MFA enablements',
  labelNames: ['type'],
  registers: [register],
});

export const sessionCreations = new Counter({
  name: 'session_creations_total',
  help: 'Total number of session creations',
  registers: [register],
});

export const sessionRevocations = new Counter({
  name: 'session_revocations_total',
  help: 'Total number of session revocations',
  labelNames: ['reason'],
  registers: [register],
});

export const activeSessions = new Gauge({
  name: 'active_sessions',
  help: 'Current number of active sessions',
  registers: [register],
});

// Security metrics
export const securityEvents = new Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity'],
  registers: [register],
});

export const failedLoginAttempts = new Counter({
  name: 'failed_login_attempts_total',
  help: 'Total number of failed login attempts',
  labelNames: ['reason'],
  registers: [register],
});

export const accountLockouts = new Counter({
  name: 'account_lockouts_total',
  help: 'Total number of account lockouts',
  registers: [register],
});

export const rateLimitExceeded = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit violations',
  labelNames: ['endpoint'],
  registers: [register],
});

// Webhook metrics
export const webhookDeliveries = new Counter({
  name: 'webhook_deliveries_total',
  help: 'Total number of webhook deliveries',
  labelNames: ['event_type', 'status'],
  registers: [register],
});

export const webhookDeliveryDuration = new Histogram({
  name: 'webhook_delivery_duration_seconds',
  help: 'Duration of webhook deliveries in seconds',
  labelNames: ['event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Job queue metrics
export const jobQueueSize = new Gauge({
  name: 'job_queue_size',
  help: 'Current size of job queue',
  labelNames: ['queue_name', 'state'],
  registers: [register],
});

export const jobProcessingDuration = new Histogram({
  name: 'job_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

// Export metrics endpoint handler
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export default {
  register,
  httpRequestCounter,
  httpRequestDuration,
  authenticationAttempts,
  authenticationDuration,
  authorizationChecks,
  authorizationDuration,
  databaseQueryCounter,
  databaseQueryDuration,
  databaseConnectionPool,
  cacheOperations,
  cacheHitRate,
  userRegistrations,
  userLogins,
  passwordResets,
  mfaEnablements,
  sessionCreations,
  sessionRevocations,
  activeSessions,
  securityEvents,
  failedLoginAttempts,
  accountLockouts,
  rateLimitExceeded,
  webhookDeliveries,
  webhookDeliveryDuration,
  jobQueueSize,
  jobProcessingDuration,
  getMetrics,
};
