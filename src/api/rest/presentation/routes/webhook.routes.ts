import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IWebhookService } from '../../../../application/services/webhook.service.js';
import { WebhookController } from '../controllers/webhook.controller.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
  createWebhookBodySchema,
  updateWebhookBodySchema,
  paginationQuerySchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register webhook routes
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  const webhookService = container.resolve<IWebhookService>('webhookService');
  const webhookController = new WebhookController(webhookService);

  /**
   * POST /api/v1/webhooks
   * Create webhook
   */
  app.post(
    '/api/v1/webhooks',
    {
      preHandler: [authenticationMiddleware, validateRequest({ body: createWebhookBodySchema })],
    },
    async (request, reply) => webhookController.createWebhook(request, reply)
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
    async (request, reply) => webhookController.listWebhooks(request, reply)
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
    async (request, reply) => webhookController.getWebhook(request, reply)
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
    async (request, reply) => webhookController.updateWebhook(request, reply)
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
    async (request, reply) => webhookController.deleteWebhook(request, reply)
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
    async (request, reply) => webhookController.listDeliveries(request, reply)
  );
}
