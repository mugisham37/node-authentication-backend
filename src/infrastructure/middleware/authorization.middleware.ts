import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './authentication.middleware.js';
import { AuthorizationError } from '../../shared/errors/types/application-error.js';
import { container } from '../container/container.js';
import { IAuthorizationService } from '../../application/services/authorization.service.js';
import { logAuthorizationFailure } from './audit-logging.middleware.js';

export interface PermissionCheck {
  resource: string;
  action: string;
}

/**
 * Creates an authorization middleware that checks if the authenticated user has required permissions
 * @param resource - The resource type (e.g., 'users', 'roles', 'webhooks')
 * @param action - The action to perform (e.g., 'read', 'write', 'delete')
 * @returns Fastify middleware function
 */
export function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    // Ensure user is authenticated
    if (!authRequest.user || !authRequest.user.userId) {
      throw new AuthorizationError('Authentication required');
    }

    const userId = authRequest.user.userId;

    // Get authorization service from container
    const authorizationService = container.resolve<IAuthorizationService>('authorizationService');

    // Check permission
    const hasPermission = await authorizationService.checkPermission(userId, resource, action);

    if (!hasPermission) {
      // Log authorization failure (Requirement: 13.2, 19.3)
      await logAuthorizationFailure(request, { resource, action });

      throw new AuthorizationError(`Insufficient permissions to ${action} ${resource}`, {
        resource,
        action,
        userId,
      });
    }
  };
}

/**
 * Creates an authorization middleware that checks multiple permissions (user must have at least one)
 * @param permissions - Array of permission checks
 * @returns Fastify middleware function
 */
export function requireAnyPermission(permissions: PermissionCheck[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user || !authRequest.user.userId) {
      throw new AuthorizationError('Authentication required');
    }

    const userId = authRequest.user.userId;
    const authorizationService = container.resolve<IAuthorizationService>('authorizationService');

    // Check if user has any of the required permissions
    const permissionChecks = await Promise.all(
      permissions.map((perm) =>
        authorizationService.checkPermission(userId, perm.resource, perm.action)
      )
    );

    const hasAnyPermission = permissionChecks.some((hasPermission) => hasPermission);

    if (!hasAnyPermission) {
      // Log authorization failure (Requirement: 13.2, 19.3)
      const firstPermission = permissions[0];
      if (firstPermission) {
        await logAuthorizationFailure(request, firstPermission);
      }

      throw new AuthorizationError('Insufficient permissions', {
        requiredPermissions: permissions,
        userId,
      });
    }
  };
}

/**
 * Creates an authorization middleware that checks multiple permissions (user must have all)
 * @param permissions - Array of permission checks
 * @returns Fastify middleware function
 */
export function requireAllPermissions(permissions: PermissionCheck[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user || !authRequest.user.userId) {
      throw new AuthorizationError('Authentication required');
    }

    const userId = authRequest.user.userId;
    const authorizationService = container.resolve<IAuthorizationService>('authorizationService');

    // Check if user has all required permissions
    const permissionChecks = await Promise.all(
      permissions.map((perm) =>
        authorizationService.checkPermission(userId, perm.resource, perm.action)
      )
    );

    const hasAllPermissions = permissionChecks.every((hasPermission) => hasPermission);

    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter((_, index) => !permissionChecks[index]);

      // Log authorization failure (Requirement: 13.2, 19.3)
      const firstMissing = missingPermissions[0];
      if (firstMissing) {
        await logAuthorizationFailure(request, firstMissing);
      }

      throw new AuthorizationError('Insufficient permissions', {
        requiredPermissions: permissions,
        missingPermissions,
        userId,
      });
    }
  };
}

/**
 * Middleware that requires user to have admin role
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authRequest = request as AuthenticatedRequest;

  if (!authRequest.user || !authRequest.user.userId) {
    throw new AuthorizationError('Authentication required');
  }

  const authorizationService = container.resolve<IAuthorizationService>('authorizationService');
  const userRoles = await authorizationService.getUserRoles(authRequest.user.userId);

  const isAdmin = userRoles.some((role) => role.name === 'admin');

  if (!isAdmin) {
    // Log authorization failure (Requirement: 13.2, 19.3)
    await logAuthorizationFailure(request, { resource: 'admin', action: 'access' });

    throw new AuthorizationError('Admin access required', {
      userId: authRequest.user.userId,
    });
  }
}

/**
 * Middleware that checks if user owns the resource or is an admin
 * @param getUserIdFromRequest - Function to extract resource owner ID from request
 */
export function requireOwnershipOrAdmin(
  getUserIdFromRequest: (request: FastifyRequest) => string | Promise<string>
) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user || !authRequest.user.userId) {
      throw new AuthorizationError('Authentication required');
    }

    const currentUserId = authRequest.user.userId;
    const resourceOwnerId = await getUserIdFromRequest(request);

    // Check if user owns the resource
    if (currentUserId === resourceOwnerId) {
      return; // User owns the resource
    }

    // Check if user is admin
    const authorizationService = container.resolve<IAuthorizationService>('authorizationService');
    const userRoles = await authorizationService.getUserRoles(currentUserId);
    const isAdmin = userRoles.some((role) => role.name === 'admin');

    if (!isAdmin) {
      // Log authorization failure (Requirement: 13.2, 19.3)
      await logAuthorizationFailure(request, { resource: 'resource', action: 'access' });

      throw new AuthorizationError('Access denied. You can only access your own resources.', {
        userId: currentUserId,
        resourceOwnerId,
      });
    }
  };
}
