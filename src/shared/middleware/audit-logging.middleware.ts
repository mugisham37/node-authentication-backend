import { FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../../core/container/container.js';
import { IAuditLogService } from '../../application/services/audit-log.service.js';
import { log } from '../../core/logging/logger.js';

/**
 * Audit logging middleware for security events
 * Requirements: 13.1, 13.2, 19.3
 *
 * Logs:
 * - All authentication attempts (success and failure)
 * - All authorization failures
 * - All administrative actions
 * - All security-relevant events
 */

/**
 * Extract user ID from request
 */
function getUserId(request: FastifyRequest): string | undefined {
  return (request as any).user?.id;
}

/**
 * Extract IP address from request
 */
function getIpAddress(request: FastifyRequest): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // Check for real IP
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to request IP
  return request.ip;
}

/**
 * Extract user agent from request
 */
function getUserAgent(request: FastifyRequest): string | undefined {
  const userAgent = request.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}

/**
 * Determine if route is security-relevant
 */
function isSecurityRelevantRoute(url: string, method: string): boolean {
  const securityRoutes = [
    // Authentication routes
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/logout',
    '/api/v1/auth/refresh',
    '/api/v1/auth/verify-email',
    '/api/v1/auth/password/forgot',
    '/api/v1/auth/password/reset',
    '/api/v1/auth/password/change',

    // MFA routes
    '/api/v1/auth/mfa/setup',
    '/api/v1/auth/mfa/verify',
    '/api/v1/auth/mfa/disable',

    // OAuth routes
    '/api/v1/oauth',

    // Session management
    '/api/v1/sessions',

    // Device management
    '/api/v1/devices',

    // Admin routes
    '/api/v1/admin',

    // User account changes
    '/api/v1/users/account',
  ];

  return securityRoutes.some((route) => url.startsWith(route));
}

/**
 * Determine action name from route and method
 */
function getActionName(url: string, method: string): string {
  // Authentication actions
  if (url.includes('/auth/register')) return 'user.register';
  if (url.includes('/auth/login')) return 'user.login';
  if (url.includes('/auth/logout')) return 'user.logout';
  if (url.includes('/auth/refresh')) return 'token.refresh';
  if (url.includes('/auth/verify-email')) return 'email.verify';
  if (url.includes('/auth/password/forgot')) return 'password.reset.request';
  if (url.includes('/auth/password/reset')) return 'password.reset.complete';
  if (url.includes('/auth/password/change')) return 'password.change';

  // MFA actions
  if (url.includes('/mfa/setup')) return 'mfa.enable';
  if (url.includes('/mfa/verify')) return 'mfa.verify';
  if (url.includes('/mfa/disable')) return 'mfa.disable';

  // OAuth actions
  if (url.includes('/oauth') && url.includes('/authorize')) return 'oauth.authorize';
  if (url.includes('/oauth') && url.includes('/callback')) return 'oauth.callback';

  // Session actions
  if (url.includes('/sessions') && method === 'GET') return 'session.list';
  if (url.includes('/sessions') && method === 'DELETE') return 'session.revoke';

  // Device actions
  if (url.includes('/devices') && method === 'GET') return 'device.list';
  if (url.includes('/devices') && method === 'PUT') return 'device.trust';
  if (url.includes('/devices') && method === 'DELETE') return 'device.remove';

  // Admin actions
  if (url.includes('/admin/users') && method === 'GET') return 'admin.users.list';
  if (url.includes('/admin/users') && url.includes('/roles')) return 'admin.users.assign_role';
  if (url.includes('/admin/users') && url.includes('/lock')) return 'admin.users.lock';
  if (url.includes('/admin/users') && url.includes('/unlock')) return 'admin.users.unlock';
  if (url.includes('/admin/roles') && method === 'POST') return 'admin.roles.create';
  if (url.includes('/admin/roles') && method === 'PUT') return 'admin.roles.update';
  if (url.includes('/admin/roles') && method === 'DELETE') return 'admin.roles.delete';

  // Account deletion
  if (url.includes('/users/account') && method === 'DELETE') return 'user.account.delete';

  // Generic action
  return `${method.toLowerCase()}.${url.replace(/^\/api\/v\d+\//, '').replace(/\//g, '.')}`;
}

/**
 * Extract resource information from URL
 */
function getResourceInfo(url: string): { resource?: string; resourceId?: string } {
  const parts = url.split('/').filter(Boolean);

  // Try to find resource and ID pattern
  for (let i = 0; i < parts.length - 1; i++) {
    // Check if next part looks like a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[i + 1])) {
      return {
        resource: parts[i],
        resourceId: parts[i + 1],
      };
    }
  }

  // Extract resource from URL
  const resource = parts[parts.length - 1];
  return { resource };
}

/**
 * Audit logging middleware
 * Logs all security-relevant requests
 */
export async function auditLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const url = request.url;
  const method = request.method;

  // Only log security-relevant routes
  if (!isSecurityRelevantRoute(url, method)) {
    return;
  }

  // Get audit log service
  const auditLogService = container.resolve<IAuditLogService>('auditLogService');

  // Extract request information
  const userId = getUserId(request);
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);
  const action = getActionName(url, method);
  const { resource, resourceId } = getResourceInfo(url);

  // Hook into response to log after completion
  reply.addHook('onSend', async (request, reply, payload) => {
    try {
      const statusCode = reply.statusCode;
      const status = statusCode >= 200 && statusCode < 300 ? 'success' : 'failure';

      // Create audit log
      await auditLogService.createAuditLog({
        userId,
        action,
        resource,
        resourceId,
        status,
        ipAddress,
        userAgent,
        metadata: {
          method,
          url,
          statusCode,
          requestId: request.id,
          // Include request body for failed authentication attempts (for security analysis)
          ...(status === 'failure' && request.body
            ? { requestBody: sanitizeRequestBody(request.body) }
            : {}),
        },
      });

      log.debug('Security event logged', {
        action,
        userId,
        status,
        statusCode,
      });
    } catch (error) {
      // Don't throw - audit logging should not break the request
      log.error('Failed to create audit log', error as Error, {
        action,
        userId,
        url,
      });
    }

    return payload;
  });
}

/**
 * Sanitize request body for audit logging
 * Remove sensitive fields like passwords
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'newPassword', 'currentPassword', 'token', 'secret', 'code'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Log authorization failure
 * Called by authorization middleware when permission check fails
 */
export async function logAuthorizationFailure(
  request: FastifyRequest,
  requiredPermission: { resource: string; action: string }
): Promise<void> {
  try {
    const auditLogService = container.resolve<IAuditLogService>('auditLogService');

    await auditLogService.createAuditLog({
      userId: getUserId(request),
      action: 'authorization.denied',
      resource: requiredPermission.resource,
      status: 'failure',
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      metadata: {
        requiredPermission,
        url: request.url,
        method: request.method,
        requestId: request.id,
      },
    });

    log.warn('Authorization failure logged', {
      userId: getUserId(request),
      requiredPermission,
      url: request.url,
    });
  } catch (error) {
    log.error('Failed to log authorization failure', error as Error);
  }
}

/**
 * Log authentication attempt
 * Called by authentication routes
 */
export async function logAuthenticationAttempt(
  email: string,
  success: boolean,
  ipAddress: string,
  userAgent?: string,
  userId?: string,
  reason?: string
): Promise<void> {
  try {
    const auditLogService = container.resolve<IAuditLogService>('auditLogService');

    await auditLogService.createAuditLog({
      userId,
      action: 'user.login.attempt',
      status: success ? 'success' : 'failure',
      ipAddress,
      userAgent,
      metadata: {
        email,
        ...(reason ? { reason } : {}),
      },
    });

    log.info('Authentication attempt logged', {
      email,
      success,
      userId,
    });
  } catch (error) {
    log.error('Failed to log authentication attempt', error as Error);
  }
}

/**
 * Log administrative action
 * Called by admin routes
 */
export async function logAdministrativeAction(
  request: FastifyRequest,
  action: string,
  targetUserId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const auditLogService = container.resolve<IAuditLogService>('auditLogService');

    await auditLogService.createAuditLog({
      userId: getUserId(request),
      action: `admin.${action}`,
      resource: 'user',
      resourceId: targetUserId,
      status: 'success',
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      metadata: {
        ...details,
        requestId: request.id,
      },
    });

    log.info('Administrative action logged', {
      adminUserId: getUserId(request),
      action,
      targetUserId,
    });
  } catch (error) {
    log.error('Failed to log administrative action', error as Error);
  }
}
