import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IUserService } from '../../application/services/user.service.js';
import { IAuthorizationService } from '../../application/services/authorization.service.js';
import { IAuditLogService } from '../../application/services/audit-log.service.js';
import { authenticationMiddleware } from '../middleware/authentication.middleware.js';
import { requireAdmin } from '../middleware/authorization.middleware.js';
import {
  validateRequest,
  idParamSchema,
  assignRolesBodySchema,
  createRoleBodySchema,
  updateRoleBodySchema,
  paginationQuerySchema,
  auditLogQuerySchema,
} from '../middleware/validation.middleware.js';

/**
 * Register admin routes
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const userService = container.resolve<IUserService>('userService');
  const authorizationService = container.resolve<IAuthorizationService>('authorizationService');
  const auditLogService = container.resolve<IAuditLogService>('auditLogService');

  /**
   * GET /api/v1/admin/users
   * List all users with pagination
   */
  app.get(
    '/api/v1/admin/users',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ query: paginationQuerySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, sortBy, sortOrder } = request.query as {
        page: number;
        limit: number;
        sortBy?: string;
        sortOrder: 'asc' | 'desc';
      };

      const result = await userService.listUsers({ page, limit, sortBy, sortOrder });

      return reply.status(200).send({
        users: result.users.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          accountLocked: user.accountLocked,
          createdAt: user.createdAt,
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
  );

  /**
   * GET /api/v1/admin/users/:id
   * Get user details
   */
  app.get(
    '/api/v1/admin/users/:id',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ params: idParamSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const user = await userService.getUserById(id);
      const roles = await authorizationService.getUserRoles(id);

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          accountLocked: user.accountLocked,
          failedLoginAttempts: user.failedLoginAttempts,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        roles: roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
        })),
      });
    }
  );

  /**
   * PUT /api/v1/admin/users/:id/roles
   * Assign roles to user
   */
  app.put(
    '/api/v1/admin/users/:id/roles',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ params: idParamSchema, body: assignRolesBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { roleIds } = request.body as { roleIds: string[] };

      await authorizationService.assignRolesToUser(id, roleIds);

      return reply.status(200).send({
        message: 'Roles assigned successfully',
      });
    }
  );

  /**
   * PUT /api/v1/admin/users/:id/lock
   * Lock user account
   */
  app.put(
    '/api/v1/admin/users/:id/lock',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ params: idParamSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      await userService.lockAccount(id);

      return reply.status(200).send({
        message: 'Account locked successfully',
      });
    }
  );

  /**
   * PUT /api/v1/admin/users/:id/unlock
   * Unlock user account
   */
  app.put(
    '/api/v1/admin/users/:id/unlock',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ params: idParamSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      await userService.unlockAccount(id);

      return reply.status(200).send({
        message: 'Account unlocked successfully',
      });
    }
  );

  /**
   * GET /api/v1/admin/audit-logs
   * Query audit logs
   */
  app.get(
    '/api/v1/admin/audit-logs',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ query: auditLogQuerySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        page: number;
        limit: number;
        userId?: string;
        action?: string;
        startDate?: string;
        endDate?: string;
        minRiskScore?: number;
      };

      const result = await auditLogService.queryLogs(query);

      return reply.status(200).send({
        logs: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
  );

  /**
   * GET /api/v1/admin/roles
   * List all roles
   */
  app.get(
    '/api/v1/admin/roles',
    {
      preHandler: [authenticationMiddleware, requireAdmin],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const roles = await authorizationService.getAllRoles();

      return reply.status(200).send({
        roles: roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          createdAt: role.createdAt,
        })),
      });
    }
  );

  /**
   * POST /api/v1/admin/roles
   * Create new role
   */
  app.post(
    '/api/v1/admin/roles',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ body: createRoleBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, description, permissionIds } = request.body as {
        name: string;
        description?: string;
        permissionIds?: string[];
      };

      const role = await authorizationService.createRole({ name, description, permissionIds });

      return reply.status(201).send({
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
        },
      });
    }
  );

  /**
   * PUT /api/v1/admin/roles/:id
   * Update role
   */
  app.put(
    '/api/v1/admin/roles/:id',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ params: idParamSchema, body: updateRoleBodySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { name, description, permissionIds } = request.body as {
        name?: string;
        description?: string;
        permissionIds?: string[];
      };

      const role = await authorizationService.updateRole(id, { name, description, permissionIds });

      return reply.status(200).send({
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
        },
      });
    }
  );

  /**
   * DELETE /api/v1/admin/roles/:id
   * Delete role (if not system role)
   */
  app.delete(
    '/api/v1/admin/roles/:id',
    {
      preHandler: [
        authenticationMiddleware,
        requireAdmin,
        validateRequest({ params: idParamSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      await authorizationService.deleteRole(id);

      return reply.status(200).send({
        message: 'Role deleted successfully',
      });
    }
  );
}
