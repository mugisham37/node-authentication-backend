import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { env } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { ApplicationError } from './core/errors/types/application-error.js';
import { randomUUID } from 'crypto';

export interface AppOptions {
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger !== false ? logger : false,
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: env.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  });

  // Register Helmet for security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
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

  // Request logging middleware
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;
    const userId = (request as any).user?.id;

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
    if (error.name === 'FastifyError' && (error as any).validation) {
      return reply.status(400).send({
        error: {
          type: 'ValidationError',
          message: 'Request validation failed',
          details: (error as unknown).validation,
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
  const { authRoutes } = await import('./presentation/routes/auth.routes.js');
  const { mfaRoutes } = await import('./presentation/routes/mfa.routes.js');
  const { passwordlessRoutes } = await import('./presentation/routes/passwordless.routes.js');
  const { oauthRoutes } = await import('./presentation/routes/oauth.routes.js');
  const { sessionRoutes } = await import('./presentation/routes/session.routes.js');
  const { deviceRoutes } = await import('./presentation/routes/device.routes.js');
  const { userRoutes } = await import('./presentation/routes/user.routes.js');
  const { adminRoutes } = await import('./presentation/routes/admin.routes.js');
  const { webhookRoutes } = await import('./presentation/routes/webhook.routes.js');
  const { monitoringRoutes } = await import('./presentation/routes/monitoring.routes.js');
  const { setupWebSocketRoutes } = await import('./presentation/websocket/websocket-handler.js');

  // Register all routes
  await authRoutes(app);
  await mfaRoutes(app);
  await passwordlessRoutes(app);
  await oauthRoutes(app);
  await sessionRoutes(app);
  await deviceRoutes(app);
  await userRoutes(app);
  await adminRoutes(app);
  await webhookRoutes(app);
  await monitoringRoutes(app);

  // Register WebSocket routes
  await setupWebSocketRoutes(app);

  // Root health check
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
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
  const { setupNotificationEventListeners } = await import(
    './application/services/notification-event-listeners.js'
  );
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
    const { connectionManager } = await import('./presentation/websocket/connection-manager.js');
    connectionManager.closeAllConnections();
    logger.info('All WebSocket connections closed');

    await app.close();
    logger.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}
