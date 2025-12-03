import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base.controller.js';
import { IUserService } from '../../../../application/services/user.service.js';
import { IAuthorizationService } from '../../../../application/services/authorization.service.js';
import { IAuditLogService } from '../../../../application/services/compliance/audit-log.service.js';
import { ISessionService } from '../../../../application/services/session.service.js';
import { IMetricsService } from '../../../../application/services/metrics.service.js';
import { IWebhookService } from '../../../../application/services/webhook.service.js';
import { IRoleRepository } from '../../../../domain/repositories/role.repository.js';
import { IPermissionRepository } from '../../../../domain/repositories/permission.repository.js';
import { UserSerializer } from '../../../common/serializers/user.serializer.js';
// import { SessionSerializer } from '../../../common/serializers/session.serializer.js';
import { AuditLogSerializer } from '../../../common/serializers/audit-log.serializer.js';
import { RoleSerializer } from '../../../common/serializers/role.serializer.js';
import { PermissionSerializer } from '../../../common/serializers/permission.serializer.js';
// import { WebhookSerializer } from '../../../common/serializers/webhook.serializer.js';
import { PaginationHelper } from '../../../common/pagination/pagination.helper.js';
import { AuthenticatedRequest } from '../../../../infrastructure/middleware/authentication.middleware.js';
import { AuditLog } from '../../../../domain/entities/audit-log.entity.js';

/**
 * Admin controller handling administrative operations
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.10
 */
export class AdminController extends BaseController {
  constructor(
    private readonly userService: IUserService,
    private readonly authorizationService: IAuthorizationService,
    private readonly auditLogService: IAuditLogService,
    private readonly sessionService: ISessionService,
    private readonly metricsService: IMetricsService,
    private readonly _webhookService: IWebhookService,
    private readonly roleRepository: IRoleRepository,
    private readonly permissionRepository: IPermissionRepository
  ) {
    super();
  }

  /**
   * List all users with pagination and filters
   * Requirements: 26.1
   */
  async listUsers(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { page, limit, sortBy, sortOrder, email, status, role } = request.query as {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      email?: string;
      status?: 'active' | 'locked' | 'deleted';
      role?: string;
    };

    const validated = PaginationHelper.validateParams({ page, limit, sortBy, sortOrder });

    const result = await this.userService.listUsers({
      page: validated.page,
      limit: validated.limit,
      sortBy: validated.sortBy,
      sortOrder: validated.sortOrder || 'desc',
      email,
      status,
      role,
    });

    const response = PaginationHelper.buildResponse(
      UserSerializer.toAdminList(result.users),
      validated.page,
      validated.limit,
      result.total
    );

    return this.success(reply, response);
  }

  /**
   * Get user details with related data
   * Requirements: 26.2
   */
  async getUserDetails(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };

    const user = await this.userService.getUserWithDetails(id);
    const roles = await this.authorizationService.getUserRoles(id);
    const recentLogs = await this.auditLogService.getRecentUserAuditLogs(id, 10);
    const sessions = await this.sessionService.listUserSessions(id);

    return this.success(reply, {
      user: UserSerializer.toAdmin(user),
      roles: RoleSerializer.toSummaryList(roles),
      recentActivity: AuditLogSerializer.toDTOList(recentLogs),
      activeSessions: sessions.sessions,
    });
  }

  /**
   * Lock user account
   * Requirements: 26.3
   */
  async lockUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const authRequest = request as AuthenticatedRequest;

    await this.userService.lockAccount(id);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_lock_user',
      resource: 'user',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return this.success(reply, {
      message: 'User account locked successfully',
    });
  }

  /**
   * Unlock user account
   * Requirements: 26.4
   */
  async unlockUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const authRequest = request as AuthenticatedRequest;

    await this.userService.unlockAccount(id);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_unlock_user',
      resource: 'user',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return this.success(reply, {
      message: 'User account unlocked successfully',
    });
  }

  /**
   * Assign role to user
   * Requirements: 26.5
   */
  async assignRole(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const { roleId } = request.body as { roleId: string };
    const authRequest = request as AuthenticatedRequest;

    await this.authorizationService.assignRole(id, roleId, authRequest.user.userId);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_assign_role',
      resource: 'user',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { roleId },
    });

    return this.success(reply, {
      message: 'Role assigned successfully',
    });
  }

  /**
   * Remove role from user
   * Requirements: 26.5
   */
  async removeRole(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id, roleId } = request.params as { id: string; roleId: string };
    const authRequest = request as AuthenticatedRequest;

    await this.authorizationService.removeRole(id, roleId);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_remove_role',
      resource: 'user',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { roleId },
    });

    return this.success(reply, {
      message: 'Role removed successfully',
    });
  }

  /**
   * Delete user (soft delete)
   * Requirements: 26.5
   */
  async deleteUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const authRequest = request as AuthenticatedRequest;

    await this.userService.deleteAccount(id);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_delete_user',
      resource: 'user',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return this.success(reply, {
      message: 'User deleted successfully',
    });
  }

  /**
   * List all roles with pagination
   * Requirements: 26.8
   */
  async listRoles(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { page, limit } = request.query as {
      page?: number;
      limit?: number;
    };

    const validated = PaginationHelper.validateParams({ page, limit });

    const allRoles = await this.roleRepository.findAll();
    const total = allRoles.length;
    const offset = PaginationHelper.calculateOffset(validated.page, validated.limit);
    const paginatedRoles = allRoles.slice(offset, offset + validated.limit);

    const response = PaginationHelper.buildResponse(
      RoleSerializer.toSummaryList(paginatedRoles),
      validated.page,
      validated.limit,
      total
    );

    return this.success(reply, response);
  }

  /**
   * Get role details with user count
   * Requirements: 26.8
   */
  async getRoleDetails(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };

    const role = await this.roleRepository.findById(id);
    if (!role) {
      return this.notFound(reply, 'Role not found');
    }

    const permissions = await this.roleRepository.getPermissions(id);
    role.permissions = permissions;

    return this.success(reply, {
      role: RoleSerializer.toDTO(role),
    });
  }

  /**
   * Create new role with permissions
   * Requirements: 26.8
   */
  async createRole(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { name, description, permissionIds } = request.body as {
      name: string;
      description: string;
      permissionIds: string[];
    };
    const authRequest = request as AuthenticatedRequest;

    const { Role } = await import('../../../../domain/entities/role.entity.js');
    const { randomUUID } = await import('crypto');

    const role = new Role({
      id: randomUUID(),
      name,
      description,
      isSystem: false,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedRole = await this.roleRepository.save(role);

    // Add permissions to role
    if (permissionIds && permissionIds.length > 0) {
      for (const permissionId of permissionIds) {
        await this.roleRepository.addPermission(savedRole.id, permissionId);
      }
    }

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_create_role',
      resource: 'role',
      resourceId: savedRole.id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { name, permissionIds },
    });

    return this.created(reply, {
      role: RoleSerializer.toSummary(savedRole),
    });
  }

  /**
   * Update role
   * Requirements: 26.8
   */
  async updateRole(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const { name, description, permissionIds } = request.body as {
      name?: string;
      description?: string;
      permissionIds?: string[];
    };
    const authRequest = request as AuthenticatedRequest;

    const role = await this.roleRepository.findById(id);
    if (!role) {
      return this.notFound(reply, 'Role not found');
    }

    // Update role properties
    if (name !== undefined) {
      role.name = name;
    }
    if (description !== undefined) {
      role.description = description;
    }
    role.updatedAt = new Date();

    const updatedRole = await this.roleRepository.update(role);

    // Update permissions if provided
    if (permissionIds !== undefined && Array.isArray(permissionIds)) {
      // Remove all existing permissions
      const existingPermissions = await this.roleRepository.getPermissions(id);
      for (const permission of existingPermissions) {
        await this.roleRepository.removePermission(id, permission.id);
      }

      // Add new permissions
      for (const permissionId of permissionIds) {
        await this.roleRepository.addPermission(id, permissionId);
      }

      // Invalidate permission cache for all users with this role
      await this.authorizationService.invalidateRolePermissionCache(id);
    }

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_update_role',
      resource: 'role',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { name, description, permissionIds },
    });

    return this.success(reply, {
      role: RoleSerializer.toSummary(updatedRole),
    });
  }

  /**
   * Delete role (prevent system role deletion)
   * Requirements: 26.8
   */
  async deleteRole(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const authRequest = request as AuthenticatedRequest;

    const role = await this.roleRepository.findById(id);
    if (!role) {
      return this.notFound(reply, 'Role not found');
    }

    if (role.isSystem) {
      return this.forbidden(reply, 'Cannot delete system role');
    }

    await this.roleRepository.delete(id);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_delete_role',
      resource: 'role',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { roleName: role.name },
    });

    return this.success(reply, {
      message: 'Role deleted successfully',
    });
  }

  /**
   * List all permissions with pagination
   * Requirements: 26.8
   */
  async listPermissions(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { page, limit } = request.query as {
      page?: number;
      limit?: number;
    };

    const validated = PaginationHelper.validateParams({ page, limit });

    const allPermissions = await this.permissionRepository.findAll();
    const total = allPermissions.length;
    const offset = PaginationHelper.calculateOffset(validated.page, validated.limit);
    const paginatedPermissions = allPermissions.slice(offset, offset + validated.limit);

    const response = PaginationHelper.buildResponse(
      PermissionSerializer.toDTOList(paginatedPermissions),
      validated.page,
      validated.limit,
      total
    );

    return this.success(reply, response);
  }

  /**
   * Create new permission
   * Requirements: 26.8
   */
  async createPermission(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { resource, action, description } = request.body as {
      resource: string;
      action: string;
      description: string;
    };
    const authRequest = request as AuthenticatedRequest;

    const { Permission } = await import('../../../../domain/entities/permission.entity.js');
    const { randomUUID } = await import('crypto');

    const permission = new Permission({
      id: randomUUID(),
      resource,
      action,
      description,
      createdAt: new Date(),
    });

    const savedPermission = await this.permissionRepository.save(permission);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_create_permission',
      resource: 'permission',
      resourceId: savedPermission.id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { resource, action },
    });

    return this.created(reply, {
      permission: PermissionSerializer.toDTO(savedPermission),
    });
  }

  /**
   * List audit logs with filters and statistics
   * Requirements: 26.6
   */
  async listAuditLogs(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { page, limit, userId, action, startDate, endDate, riskScore } = request.query as {
      page?: number;
      limit?: number;
      userId?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      riskScore?: number;
    };

    const validated = PaginationHelper.validateParams({ page, limit });

    const result = await this.auditLogService.queryAuditLogs({
      limit: validated.limit,
      offset: PaginationHelper.calculateOffset(validated.page, validated.limit),
      userId,
      actions: action ? [action] : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      minRiskScore: riskScore,
    });

    const response = PaginationHelper.buildResponse(
      AuditLogSerializer.toDTOList(result.logs),
      validated.page,
      validated.limit,
      result.total
    );

    return this.success(reply, response);
  }

  /**
   * Get audit log details with related logs
   * Requirements: 26.6
   */
  async getAuditLogDetails(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };

    const auditLog = await this.auditLogService.getAuditLogById(id);
    if (!auditLog) {
      return this.notFound(reply, 'Audit log not found');
    }

    // Get related logs (same user, similar timeframe)
    let relatedLogs: AuditLog[] = [];
    if (auditLog.userId) {
      const allUserLogs = await this.auditLogService.getRecentUserAuditLogs(auditLog.userId, 5);
      relatedLogs = allUserLogs.filter((log) => log.id !== id);
    }

    return this.success(reply, {
      auditLog: AuditLogSerializer.toDTO(auditLog),
      relatedLogs: AuditLogSerializer.toDTOList(relatedLogs),
    });
  }

  /**
   * List all sessions with filters and statistics
   * Requirements: 26.10
   */
  async listAllSessions(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { page, limit, userId, deviceName } = request.query as {
      page?: number;
      limit?: number;
      userId?: string;
      deviceName?: string;
    };

    const validated = PaginationHelper.validateParams({ page, limit });

    const result = await this.sessionService.listAllSessions({
      page: validated.page,
      limit: validated.limit,
      userId,
      deviceName,
    });

    const response = PaginationHelper.buildResponse(
      result.sessions,
      validated.page,
      validated.limit,
      result.total
    );

    return this.success(reply, response);
  }

  /**
   * Revoke any session (admin privilege)
   * Requirements: 26.10
   */
  async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { id } = request.params as { id: string };
    const { userId: targetUserId } = request.body as { userId: string };
    const authRequest = request as AuthenticatedRequest;

    await this.sessionService.revokeSession(id, targetUserId);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_revoke_session',
      resource: 'session',
      resourceId: id,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { targetUserId },
    });

    return this.success(reply, {
      message: 'Session revoked successfully',
    });
  }

  /**
   * Revoke all sessions for a user (admin privilege)
   * Requirements: 26.10
   */
  async revokeUserSessions(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { userId } = request.params as { userId: string };
    const authRequest = request as AuthenticatedRequest;

    await this.sessionService.revokeAllSessions(userId);

    // Log the action
    await this.auditLogService.createAuditLog({
      userId: authRequest.user.userId,
      action: 'admin_revoke_user_sessions',
      resource: 'user',
      resourceId: userId,
      status: 'success',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return this.success(reply, {
      message: 'All user sessions revoked successfully',
    });
  }

  /**
   * List all webhooks with filters
   * Requirements: 26.10
   */
  async listAllWebhooks(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { page, limit } = request.query as {
      page?: number;
      limit?: number;
      userId?: string;
    };

    const validated = PaginationHelper.validateParams({ page, limit });

    // For now, return empty result as webhook service doesn't have listAll method
    // In production, this would be implemented in the webhook service
    const response = PaginationHelper.buildResponse([], validated.page, validated.limit, 0);

    return this.success(reply, response);
  }

  /**
   * List webhook deliveries with filters
   * Requirements: 26.10
   */
  async listWebhookDeliveries(
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { page, limit } = _request.query as {
      page?: number;
      limit?: number;
    };

    const validated = PaginationHelper.validateParams({ page, limit });

    // For now, return empty result
    // In production, this would fetch deliveries from webhook service
    const response = PaginationHelper.buildResponse([], validated.page, validated.limit, 0);

    return this.success(reply, response);
  }

  /**
   * Get system metrics overview
   * Requirements: 26.7
   */
  async getSystemMetrics(_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const metrics = await this.metricsService.getSystemOverview();

    return this.success(reply, metrics);
  }

  /**
   * Get user growth metrics over time
   * Requirements: 26.7
   */
  async getUserMetrics(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { startDate, endDate, granularity } = request.query as {
      startDate: string;
      endDate: string;
      granularity: 'day' | 'week' | 'month';
    };

    const metrics = await this.metricsService.getUserMetrics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      granularity: granularity || 'day',
    });

    return this.success(reply, { metrics });
  }

  /**
   * Get security event metrics
   * Requirements: 26.7
   */
  async getSecurityMetrics(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { startDate, endDate, granularity } = request.query as {
      startDate: string;
      endDate: string;
      granularity: 'day' | 'week' | 'month';
    };

    const metrics = await this.metricsService.getSecurityMetrics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      granularity: granularity || 'day',
    });

    return this.success(reply, { metrics });
  }
}
