import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IDeviceService } from '../../application/services/device.service.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../middleware/authentication.middleware.js';
import { validateRequest, idParamSchema } from '../middleware/validation.middleware.js';

/**
 * Register device management routes
 */
export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  const deviceService = container.resolve<IDeviceService>('deviceService');

  /**
   * GET /api/v1/devices
   * List user devices
   */
  app.get(
    '/api/v1/devices',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;

      const devices = await deviceService.getUserDevices(authRequest.user.userId);

      return reply.status(200).send({
        devices: devices.map((device) => ({
          id: device.id,
          name: device.name,
          type: device.type,
          isTrusted: device.isTrusted,
          lastSeenAt: device.lastSeenAt,
          createdAt: device.createdAt,
        })),
      });
    }
  );

  /**
   * PUT /api/v1/devices/:id/trust
   * Mark device as trusted
   */
  app.put(
    '/api/v1/devices/:id/trust',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      await deviceService.trustDevice(authRequest.user.userId, id);

      return reply.status(200).send({
        message: 'Device marked as trusted',
      });
    }
  );

  /**
   * DELETE /api/v1/devices/:id
   * Remove device
   */
  app.delete(
    '/api/v1/devices/:id',
    {
      preHandler: [authenticationMiddleware, validateRequest({ params: idParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      await deviceService.removeDevice(authRequest.user.userId, id);

      return reply.status(200).send({
        message: 'Device removed successfully',
      });
    }
  );
}
