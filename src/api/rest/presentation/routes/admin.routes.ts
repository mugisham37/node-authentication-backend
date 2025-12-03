import { FastifyInstance } from 'fastify';
import { container } from '../../../../infrastructure/container/container.js';
import { IUserService } from '../../../../application/services/user.service.js';
import { IAuthorizationService } from '../../../../application/services/authorization.service.js';
import { IAuditLogService } from '../../../../application/services/compliance/audit-log.service.js';
import { ISessionService } from '../../../../application/services/session.service.js';
import { IMetricsService } from '../../../../application/services/metrics.service.js';
import { IWebhookService } from '../../../../application/services/webhook.service.js';
import { IRoleRepository } from '../../../../domain/repositories/role.repository.js';
import { IPermissionRepository } from '../../../../domain/repositories/permission.repository.js';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticationMiddleware } from '../../../../infrastructure/middleware/authentication.middleware.js';
import { requireAdmin } from '../../../../infrastructure/middleware/authorization.middleware.js';
import { apiRateLimiter } from '../../../../infrastructure/middleware/rate-limit.middleware.js';

/**
 * Register admin routes
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.10
 */
export function adminRoutes(app: FastifyInstance): void {
  // Resolve dependencies from container
  const userService = container.resolve<IUserService>('userService');
  const authorizationService = container.resolve<IAuthorizationService>('authorizationService');
  const auditLogService = container.resolve<IAuditLogService>('auditLogService');
  const sessionService = container.resolve<ISessionService>('sessionService');
  const metricsService = container.resolve<IMetricsService>('metricsService');
  const webhookService = container.resolve<IWebhookService>('webhookService');
  const roleRepository = container.resolve<IRoleRepository>('roleRepository');
  const permissionRepository = container.resolve<IPermissionRepository>('permissionRepository');

  // Create admin controller
  const adminController = new AdminController(
    userService,
    authorizationService,
    auditLogService,
    sessionService,
    metricsService,
    webhookService,
    roleRepository,
    permissionRepository
  );

  // Common middleware for all admin routes
  const adminMiddleware = [authenticationMiddleware, requireAdmin, apiRateLimiter];

  // User Management Routes
  /**
   * GET /api/v1/admin/users
   * List all users with pagination and filters
   * Requirements: 26.1
   */
  app.get('/api/v1/admin/users', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.listUsers(request, reply)
  );

  /**
   * GET /api/v1/admin/users/:id
   * Get user details with related data
   * Requirements: 26.2
   */
  app.get('/api/v1/admin/users/:id', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.getUserDetails(request, reply)
  );

  /**
   * PUT /api/v1/admin/users/:id/lock
   * Lock user account
   * Requirements: 26.3
   */
  app.put('/api/v1/admin/users/:id/lock', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.lockUser(request, reply)
  );

  /**
   * PUT /api/v1/admin/users/:id/unlock
   * Unlock user account
   * Requirements: 26.4
   */
  app.put(
    '/api/v1/admin/users/:id/unlock',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.unlockUser(request, reply)
  );

  /**
   * POST /api/v1/admin/users/:id/roles
   * Assign role to user
   * Requirements: 26.5
   */
  app.post(
    '/api/v1/admin/users/:id/roles',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.assignRole(request, reply)
  );

  /**
   * DELETE /api/v1/admin/users/:id/roles/:roleId
   * Remove role from user
   * Requirements: 26.5
   */
  app.delete(
    '/api/v1/admin/users/:id/roles/:roleId',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.removeRole(request, reply)
  );

  /**
   * DELETE /api/v1/admin/users/:id
   * Delete user (soft delete)
   * Requirements: 26.5
   */
  app.delete('/api/v1/admin/users/:id', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.deleteUser(request, reply)
  );

  // Role Management Routes
  /**
   * GET /api/v1/admin/roles
   * List all roles with pagination
   * Requirements: 26.8
   */
  app.get('/api/v1/admin/roles', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.listRoles(request, reply)
  );

  /**
   * GET /api/v1/admin/roles/:id
   * Get role details with user count
   * Requirements: 26.8
   */
  app.get('/api/v1/admin/roles/:id', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.getRoleDetails(request, reply)
  );

  /**
   * POST /api/v1/admin/roles
   * Create new role with permissions
   * Requirements: 26.8
   */
  app.post('/api/v1/admin/roles', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.createRole(request, reply)
  );

  /**
   * PUT /api/v1/admin/roles/:id
   * Update role
   * Requirements: 26.8
   */
  app.put('/api/v1/admin/roles/:id', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.updateRole(request, reply)
  );

  /**
   * DELETE /api/v1/admin/roles/:id
   * Delete role (prevent system role deletion)
   * Requirements: 26.8
   */
  app.delete('/api/v1/admin/roles/:id', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.deleteRole(request, reply)
  );

  // Permission Management Routes
  /**
   * GET /api/v1/admin/permissions
   * List all permissions with pagination
   * Requirements: 26.8
   */
  app.get('/api/v1/admin/permissions', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.listPermissions(request, reply)
  );

  /**
   * POST /api/v1/admin/permissions
   * Create new permission
   * Requirements: 26.8
   */
  app.post('/api/v1/admin/permissions', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.createPermission(request, reply)
  );

  // Audit Log Routes
  /**
   * GET /api/v1/admin/audit-logs
   * List audit logs with filters and statistics
   * Requirements: 26.6
   */
  app.get('/api/v1/admin/audit-logs', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.listAuditLogs(request, reply)
  );

  /**
   * GET /api/v1/admin/audit-logs/:id
   * Get audit log details with related logs
   * Requirements: 26.6
   */
  app.get('/api/v1/admin/audit-logs/:id', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.getAuditLogDetails(request, reply)
  );

  // Session Management Routes
  /**
   * GET /api/v1/admin/sessions
   * List all sessions with filters and statistics
   * Requirements: 26.10
   */
  app.get('/api/v1/admin/sessions', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.listAllSessions(request, reply)
  );

  /**
   * DELETE /api/v1/admin/sessions/:id
   * Revoke any session (admin privilege)
   * Requirements: 26.10
   */
  app.delete(
    '/api/v1/admin/sessions/:id',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.revokeSession(request, reply)
  );

  /**
   * DELETE /api/v1/admin/users/:userId/sessions
   * Revoke all sessions for a user (admin privilege)
   * Requirements: 26.10
   */
  app.delete(
    '/api/v1/admin/users/:userId/sessions',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.revokeUserSessions(request, reply)
  );

  // Webhook Management Routes
  /**
   * GET /api/v1/admin/webhooks
   * List all webhooks with filters
   * Requirements: 26.10
   */
  app.get('/api/v1/admin/webhooks', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.listAllWebhooks(request, reply)
  );

  /**
   * GET /api/v1/admin/webhooks/:webhookId/deliveries
   * List webhook deliveries with filters
   * Requirements: 26.10
   */
  app.get(
    '/api/v1/admin/webhooks/:webhookId/deliveries',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.listWebhookDeliveries(request, reply)
  );

  // Metrics Routes
  /**
   * GET /api/v1/admin/metrics/system
   * Get system metrics overview
   * Requirements: 26.7
   */
  app.get('/api/v1/admin/metrics/system', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.getSystemMetrics(request, reply)
  );

  /**
   * GET /api/v1/admin/metrics/users
   * Get user growth metrics over time
   * Requirements: 26.7
   */
  app.get('/api/v1/admin/metrics/users', { preHandler: adminMiddleware }, async (request, reply) =>
    adminController.getUserMetrics(request, reply)
  );

  /**
   * GET /api/v1/admin/metrics/security
   * Get security event metrics
   * Requirements: 26.7
   */
  app.get(
    '/api/v1/admin/metrics/security',
    { preHandler: adminMiddleware },
    async (request, reply) => adminController.getSecurityMetrics(request, reply)
  );
}
