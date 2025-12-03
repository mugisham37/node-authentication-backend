import { FastifyRequest, FastifyReply } from 'fastify';
import { withSpan, addSpanAttributes } from '../monitoring/tracing.js';

/**
 * Extended FastifyRequest with optional user property
 */
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    email?: string;
    [key: string]: unknown;
  };
}

/**
 * Middleware to create trace spans for HTTP requests
 * Requirements: 22.3 - Create trace spans for all operations and implement trace context propagation
 */
export async function tracingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const spanName = `HTTP ${request.method} ${request.routeOptions?.url || request.url}`;

  // Create a span for this request
  await withSpan(
    spanName,
    async () => {
      // Add request attributes to span
      addSpanAttributes({
        'http.method': request.method,
        'http.url': request.url,
        'http.route': request.routeOptions?.url || request.url,
        'http.user_agent': request.headers['user-agent'] || '',
        'http.request_id': request.id,
      });

      // Add user context if available
      const authenticatedRequest = request as AuthenticatedRequest;
      const user = authenticatedRequest.user;
      if (user) {
        addSpanAttributes({
          'user.id': user.userId,
          'user.email': user.email || '',
        });
      }

      // Track response - setup listener without awaiting
      reply.raw.on('finish', () => {
        addSpanAttributes({
          'http.status_code': reply.statusCode,
        });
      });

      // Return promise to satisfy async requirement
      return Promise.resolve();
    },
    {
      'http.method': request.method,
      'http.url': request.url,
    }
  );
}
