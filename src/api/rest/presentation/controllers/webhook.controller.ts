import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import { IWebhookService } from '../../../../application/services/webhook.service.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';

/**
 * Webhook controller handling webhook CRUD operations and delivery tracking
 */
export class WebhookController extends BaseController {
  constructor(private readonly webhookService: IWebhookService) {
    super();
  }

  /**
   * Create webhook
   */
  async createWebhook(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { url, events, description } = request.body as {
      url: string;
      events: string[];
      description?: string;
    };

    const webhook = await this.webhookService.createWebhook(authRequest.user.userId, {
      url,
      events,
      description,
    });

    return this.created(reply, {
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

  /**
   * List user webhooks
   */
  async listWebhooks(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;

    const webhooks = await this.webhookService.getUserWebhooks(authRequest.user.userId);

    return this.success(reply, {
      webhooks: webhooks.map((webhook) => ({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
      })),
    });
  }

  /**
   * Get webhook details
   */
  async getWebhook(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const webhook = await this.webhookService.getWebhook(authRequest.user.userId, id);

    return this.success(reply, {
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

  /**
   * Update webhook
   */
  async updateWebhook(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };
    const { url, events, isActive, description } = request.body as {
      url?: string;
      events?: string[];
      isActive?: boolean;
      description?: string;
    };

    const webhook = await this.webhookService.updateWebhook(authRequest.user.userId, id, {
      url,
      events,
      isActive,
      description,
    });

    return this.success(reply, {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        updatedAt: webhook.updatedAt,
      },
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    await this.webhookService.deleteWebhook(authRequest.user.userId, id);

    return this.success(reply, {
      message: 'Webhook deleted successfully',
    });
  }

  /**
   * List webhook deliveries
   */
  async listDeliveries(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };
    const { page, limit } = request.query as { page: number; limit: number };

    const result = await this.webhookService.getWebhookDeliveries(authRequest.user.userId, id, {
      page,
      limit,
    });

    const totalPages = Math.ceil(result.total / limit);

    return this.success(reply, {
      deliveries: result.deliveries,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
    });
  }
}
