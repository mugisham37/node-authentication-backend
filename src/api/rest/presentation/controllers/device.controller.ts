import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import { IDeviceService } from '../../../../application/services/device.service.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';

/**
 * Device controller handling device management operations
 */
export class DeviceController extends BaseController {
  constructor(private readonly deviceService: IDeviceService) {
    super();
  }

  /**
   * List user devices
   */
  async listDevices(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;

    const devices = await this.deviceService.listDevices(authRequest.user.userId);

    return this.success(reply, {
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

  /**
   * Mark device as trusted
   */
  async trustDevice(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    await this.deviceService.markDeviceAsTrusted(authRequest.user.userId, id);

    return this.success(reply, {
      message: 'Device marked as trusted',
    });
  }

  /**
   * Remove device
   */
  async removeDevice(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    await this.deviceService.removeDevice(authRequest.user.userId, id);

    return this.success(reply, {
      message: 'Device removed successfully',
    });
  }
}
