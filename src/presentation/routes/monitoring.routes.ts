import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { register as promRegister } from 'prom-client';

/**
 * Register monitoring routes
 */
export async function monitoringRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/health
   * Health check endpoint
   */
  app.get('/api/v1/health', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check database connectivity
    let dbHealthy = true;
    try {
      // TODO: Add actual database health check
      // await db.raw('SELECT 1');
    } catch (error) {
      dbHealthy = false;
    }

    // Check Redis connectivity
    let redisHealthy = true;
    try {
      // TODO: Add actual Redis health check
      // await redis.ping();
    } catch (error) {
      redisHealthy = false;
    }

    const isHealthy = dbHealthy && redisHealthy;
    const statusCode = isHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
      },
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  /**
   * GET /api/v1/metrics
   * Prometheus metrics endpoint
   */
  app.get('/api/v1/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await promRegister.metrics();

    return reply.header('Content-Type', promRegister.contentType).status(200).send(metrics);
  });
}
