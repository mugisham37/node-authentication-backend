import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IWebhookService } from '../../application/services/webhook.service.js';
import { authenticationMiddleware, AuthenticatedRequest } from '../middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
  createWebhookBodySchema,
  updateWebhookBodySchema,
  paginationQuerySchema,
} from '../middleware/validation.middleware.js';

/**
 * Register webhook routes
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  const webhookService = container.resolve<IWebhookService>('webhookService');

  /**
   * POST /api/v1/webhooks
   * Create webhook
   */
  app.post(
    '/api/v1/webhooks',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: createWebhookBodySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { url, events, description } = request.body as {
        url: string;
        events: string[];
        description?: string;
      };

      const webhook = await webhookService.createWebhook(authRequest.user.userId, {
        url,
        events,
        description,
      });

      return reply.status(201).send({
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
        },
      });
    }
  );

  /**
   * GET /api/v1/webhooks
   * List user webhooks
   */
  app.get(
    '/api/v1/webhooks',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      const webhooks = await webhookService.getUserWebhooks(authRequest.user.userId);

      return reply.status(200).send({
        webhooks: webhooks.map((webhook) => ({
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
        })),
      });
    }
  );

  /**
   * GET /api/v1/webhooks/:id
   * Get webhook details
   */
  app.get(
    '/api/v1/webhooks/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const webhook = await webhookService.getWebhook(authRequest.user.userId, id);

      return reply.status(200).send({
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
        },
      });
    }
  );

  /**
   * PUT /api/v1/webhooks/:id
   * Update webhook
   */
  app.put(
    '/api/v1/webhooks/:id',
    {
      preHandler: [
        authenticationMiddleware,
        validateRequest({ params: idParamSchema, body: updateWebhookBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const { url, events, isActive, description } = request.body as {
        url?: string;
        events?: string[];
        isActive?: boolean;
        description?: string;
      };

      const webhook = await webhookService.updateWebhook(authRequest.user.userId, id, {
        url,
        events,
        isActive,
        description,
      });

      return reply.status(200).send({
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          updatedAt: webhook.updatedAt,
        },
      });
    }
  );

  /**
   * DELETE /api/v1/webhooks/:id
   * Delete webhook
   */
  app.delete(
    '/api/v1/webhooks/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      await webhookService.deleteWebhook(authRequest.user.userId, id);

      return reply.status(200).send({
        message: 'Webhook deleted successfully',
      });
    }
  );

  /**
   * GET /api/v1/webhooks/:id/deliveries
   * List webhook deliveries
   */
  app.get(
    '/api/v1/webhooks/:id/deliveries',
    {
      preHandler: [
        authenticationMiddleware,
        validateRequest({ params: idParamSchema, query: paginationQuerySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const { page, limit } = request.query as { page: number; limit: number };

      const result = await webhookService.getWebhookDeliveries(authRequest.user.userId, id, {
        page,
        limit,
      });

      return reply.status(200).send({
        deliveries: result.deliveries,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
  );
}
