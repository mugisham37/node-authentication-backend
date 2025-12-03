import { FastifyRequest, FastifyReply } from 'fastify';
import { httpRequestCounter, httpRequestDuration } from '../monitoring/metrics.js';

/**
 * Middleware to track HTTP request metrics
 * Requirements: 22.1 - Record request count, duration, and status code
 */
export function metricsMiddleware(request: FastifyRequest, reply: FastifyReply): void {
  const startTime = Date.now();

  // Track request completion
  reply.raw.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    // Increment request counter
    httpRequestCounter.inc({
      method,
      route,
      status_code: statusCode,
    });

    // Record request duration
    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode,
      },
      duration
    );
  });
}
