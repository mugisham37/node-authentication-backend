/* cSpell:ignore clickjacking frameguard hsts passwordless */
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import compress from '@fastify/compress';
import etag from '@fastify/etag';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './infrastructure/config/env.js';
import { swaggerConfig, swaggerUiConfig } from './infrastructure/config/swagger.config.js';
import { logger } from './infrastructure/logging/logger.js';
import { ApplicationError } from './shared/errors/types/application-error.js';
import { randomUUID } from 'crypto';

export interface AppOptions {
  logger?: boolean;
}

// eslint-disable-next-line max-lines-per-function
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger !== false,
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register CORS
  // Requirements: All API requirements, 19.2
  await app.register(cors, {
    // Configure allowed origins from environment
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    // Enable credentials support (cookies, authorization headers)
    credentials: env.CORS_CREDENTIALS,
    // Configure allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // Configure allowed request headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
      'Accept',
      'Accept-Language',
      'Content-Language',
    ],
    // Configure exposed response headers
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'Content-Range',
      'X-Total-Count',
    ],
    // Preflight cache duration (24 hours)
    maxAge: 86400,
    // Allow preflight to pass through
    preflightContinue: false,
    // Provide successful preflight status
    optionsSuccessStatus: 204,
  });

  // Register Helmet for security headers
  // Requirements: All security requirements, 19.1
  await app.register(helmet, {
    // Content Security Policy - prevents XSS attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // X-Frame-Options - prevents clickjacking attacks
    frameguard: {
      action: 'deny',
    },
    // X-Content-Type-Options - prevents MIME type sniffing
    noSniff: true,
    // Referrer-Policy - controls referrer information
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // Strict-Transport-Security - enforces HTTPS
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // X-DNS-Prefetch-Control - controls DNS prefetching
    dnsPrefetchControl: {
      allow: false,
    },
    // X-Download-Options - prevents IE from executing downloads
    ieNoOpen: true,
    // X-Permitted-Cross-Domain-Policies - controls cross-domain policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    crossOriginEmbedderPolicy: false,
  });

  // Register Swagger for OpenAPI documentation (Requirements: 23.1, 23.2)
  await app.register(swagger, swaggerConfig);

  // Register Swagger UI (Requirements: 23.3)
  await app.register(swaggerUi, swaggerUiConfig);

  // Register compression for response optimization (Requirement: 19.1)
  await app.register(compress, {
    global: true,
    threshold: 1024, // Only compress responses larger than 1KB
    encodings: ['gzip', 'deflate'],
    zlibOptions: {
      level: 6, // Balanced compression level
    },
  });

  // Register ETag support for cacheable responses (Requirement: 19.1)
  await app.register(etag, {
    algorithm: 'fnv1a', // Fast hash algorithm
  });

  // Register rate limiting
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
    },
    skipOnError: true,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Metrics middleware - track request count and duration
  // Requirements: 22.1
  const { metricsMiddleware } = await import('./infrastructure/middleware/metrics.middleware.js');
  app.addHook('onRequest', metricsMiddleware);

  // Tracing middleware - create trace spans for all operations
  // Requirements: 22.3
  const { tracingMiddleware } = await import('./infrastructure/middleware/tracing.middleware.js');
  app.addHook('onRequest', tracingMiddleware);

  // Request logging middleware
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
      'Incoming request'
    );
  });

  // Audit logging middleware for security events
  // Requirements: 13.1, 13.2, 19.3
  const { auditLoggingMiddleware } =
    await import('./infrastructure/middleware/audit-logging.middleware.js');
  app.addHook('onRequest', auditLoggingMiddleware);

  // Response logging middleware
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.getResponseTime(),
      },
      'Request completed'
    );
  });

  // Global error handler
  // eslint-disable-next-line max-lines-per-function
  app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;
    const userId = (request as FastifyRequest & { user?: { id?: string } }).user?.id;

    // Log error with full context
    request.log.error(
      {
        requestId,
        userId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        },
      },
      'Request error'
    );

    // Send alert for non-operational errors (Requirement 18.4)
    if (error instanceof ApplicationError && !error.isOperational) {
      const { alertingService, AlertSeverity } =
        await import('./infrastructure/monitoring/alerting.service.js');
      alertingService.alertSecurityEvent(
        'non_operational_error',
        AlertSeverity.CRITICAL,
        `Non-operational error: ${error.message}`,
        {
          requestId,
          userId,
          errorName: error.name,
          url: request.url,
          method: request.method,
        }
      );
    }

    // Handle ApplicationError
    if (error instanceof ApplicationError) {
      return reply.status(error.statusCode).send({
        error: {
          type: error.name,
          message: error.message,
          details: error.details,
          requestId,
        },
      });
    }

    // Handle Fastify validation errors
    if (error.name === 'FastifyError' && 'validation' in error) {
      return reply.status(400).send({
        error: {
          type: 'ValidationError',
          message: 'Request validation failed',
          details: (error as { validation?: unknown }).validation,
          requestId,
        },
      });
    }

    // Unknown error - hide details from client
    return reply.status(500).send({
      error: {
        type: 'InternalServerError',
        message: 'An unexpected error occurred',
        requestId,
      },
    });
  });

  // Not found handler
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({
      error: {
        type: 'NotFoundError',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });

  // Register WebSocket support
  await app.register(websocket);

  // Register routes
  await registerRoutes(app);

  // Initialize notification event listeners
  await initializeNotificationSystem();

  return app;
}

/**
 * Register all application routes
 */
async function registerRoutes(app: FastifyInstance): Promise<void> {
  const { authRoutes } = await import('./api/rest/presentation/routes/auth.routes.js');
  const { mfaRoutes } = await import('./api/rest/presentation/routes/mfa.routes.js');
  const { passwordlessRoutes } =
    await import('./api/rest/presentation/controllers/passwordless.controller.js');
  const { oauthRoutes } = await import('./api/rest/presentation/routes/oauth.routes.js');
  const { sessionRoutes } = await import('./api/rest/presentation/routes/session.routes.js');
  const { deviceRoutes } = await import('./api/rest/presentation/routes/device.routes.js');
  const { userRoutes } = await import('./api/rest/presentation/routes/user.routes.js');
  const { adminRoutes } = await import('./api/rest/presentation/routes/admin.routes.js');
  const { webhookRoutes } = await import('./api/rest/presentation/routes/webhook.routes.js');
  const { monitoringRoutes } = await import('./api/rest/presentation/routes/monitoring.routes.js');
  const { setupWebSocketRoutes } = await import('./api/rest/websocket/websocket-handler.js');

  // Register all routes
  await authRoutes(app);
  await mfaRoutes(app);
  await passwordlessRoutes(app);
  oauthRoutes(app);
  await sessionRoutes(app);
  await deviceRoutes(app);
  await userRoutes(app);
  await adminRoutes(app);
  await webhookRoutes(app);
  await monitoringRoutes(app);

  // Register WebSocket routes
  setupWebSocketRoutes(app);

  // Root health check
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
}

/**
 * Initialize notification system event listeners
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */
async function initializeNotificationSystem(): Promise<void> {
  const { setupNotificationEventListeners } =
    await import('./application/services/notification-event-listeners.js');
  setupNotificationEventListeners();
  logger.info('Notification system initialized');
}

export async function startServer(app: FastifyInstance): Promise<void> {
  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    logger.info(`Server listening on port ${env.PORT}`);
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

export async function gracefulShutdown(app: FastifyInstance): Promise<void> {
  logger.info('Received shutdown signal, closing server gracefully...');

  try {
    // Close all WebSocket connections
    const { connectionManager } = await import('./api/rest/websocket/connection-manager.js');
    connectionManager.closeAllConnections();
    logger.info('All WebSocket connections closed');

    await app.close();
    logger.info('Server closed successfully');

    // Shutdown distributed tracing (Requirement 22.3)
    const { shutdownTracing } = await import('./infrastructure/monitoring/tracing.js');
    await shutdownTracing();
    logger.info('Distributed tracing shutdown complete');

    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}
