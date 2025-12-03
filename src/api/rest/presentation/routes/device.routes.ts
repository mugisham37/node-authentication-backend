import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IDeviceService } from '../../../../application/services/device.service.js';
import {
  authenticationMiddleware,
  AuthenticatedRequest,
} from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register device management routes
 */
/* eslint-disable max-lines-per-function, @typescript-eslint/require-await */
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

      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const devices = await deviceService.listDevices(authRequest.user.userId);

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
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
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

      /* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
      await deviceService.markDeviceAsTrusted(authRequest.user.userId, id);

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
/* eslint-enable max-lines-per-function, @typescript-eslint/require-await */
