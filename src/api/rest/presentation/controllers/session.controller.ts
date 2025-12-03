import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import { ISessionService } from '../../../../application/services/session.service.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';

/**
 * Session controller handling session management operations
 */
export class SessionController extends BaseController {
  constructor(private readonly sessionService: ISessionService) {
    super();
  }

  /**
   * List user sessions
   */
  async listSessions(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;

    const result = await this.sessionService.listUserSessions(authRequest.user.userId);

    return this.success(reply, {
      sessions: result.sessions.map((session) => ({
        ...session,
        isCurrent: session.id === authRequest.user.sessionId,
      })),
      total: result.total,
    });
  }

  /**
   * Revoke specific session
   */
  async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    await this.sessionService.revokeSession(id, authRequest.user.userId);

    return this.success(reply, {
      message: 'Session revoked successfully',
    });
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const authRequest = request as AuthenticatedRequest;
    const currentSessionId = authRequest.user.sessionId;

    if (!currentSessionId) {
      return this.error(reply, 'Current session ID not found');
    }

    await this.sessionService.revokeAllSessionsExceptCurrent(
      authRequest.user.userId,
      currentSessionId
    );

    return this.success(reply, {
      message: 'All other sessions revoked successfully',
    });
  }
}
