import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IDeviceService } from '../../../../application/services/device.service.js';
import { DeviceController } from '../controllers/device.controller.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import {
  validateRequest,
  idParamSchema,
} from '../../../../infrastructure/middleware/validation.middleware.js';

/**
 * Register device management routes
 */
export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  const deviceService = container.resolve<IDeviceService>('deviceService');
  const deviceController = new DeviceController(deviceService);

  /**
   * GET /api/v1/devices
   * List user devices
   */
  app.get(
    '/api/v1/devices',
    {
      preHandler: [authenticationMiddleware],
    },
    async (request, reply) => deviceController.listDevices(request, reply)
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
    async (request, reply) => deviceController.trustDevice(request, reply)
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
    async (request, reply) => deviceController.removeDevice(request, reply)
  );
}
