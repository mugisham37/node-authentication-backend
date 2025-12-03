import { FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../container/container.js';
import { IAuditLogService } from '../../application/services/audit-log.service.js';
import { log } from '../logging/logger.js';

/**
 * Extended FastifyRequest with optional user property
 */
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

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
  const authenticatedRequest = request as AuthenticatedRequest;
  return authenticatedRequest.user?.id;
}

/**
 * Extract IP address from request
 */
function getIpAddress(request: FastifyRequest): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (ips !== undefined && ips !== '' && typeof ips === 'string') {
      const firstIp = ips.split(',')[0];
      if (firstIp) {
        return firstIp.trim();
      }
    }
  }

  // Check for real IP
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
    if (realIpValue) {
      return realIpValue;
    }
  }

  // Fall back to request IP
  return request.ip;
}

/**
 * Extract user agent from request
 */
function getUserAgent(request: FastifyRequest): string | undefined {
  const userAgent = request.headers['user-agent'];
  if (Array.isArray(userAgent)) {
    return userAgent[0] as string | undefined;
  }
  return userAgent;
}

/**
 * Determine if route is security-relevant
 */
function isSecurityRelevantRoute(url: string, _method: string): boolean {
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
 * Action name mapping for routes
 */
const ACTION_MAPPINGS: Array<{ pattern: string; method?: string; action: string }> = [
  // Authentication actions
  { pattern: '/auth/register', action: 'user.register' },
  { pattern: '/auth/login', action: 'user.login' },
  { pattern: '/auth/logout', action: 'user.logout' },
  { pattern: '/auth/refresh', action: 'token.refresh' },
  { pattern: '/auth/verify-email', action: 'email.verify' },
  { pattern: '/auth/password/forgot', action: 'password.reset.request' },
  { pattern: '/auth/password/reset', action: 'password.reset.complete' },
  { pattern: '/auth/password/change', action: 'password.change' },
  // MFA actions
  { pattern: '/mfa/setup', action: 'mfa.enable' },
  { pattern: '/mfa/verify', action: 'mfa.verify' },
  { pattern: '/mfa/disable', action: 'mfa.disable' },
  // OAuth actions
  { pattern: '/oauth/authorize', action: 'oauth.authorize' },
  { pattern: '/oauth/callback', action: 'oauth.callback' },
  // Session actions
  { pattern: '/sessions', method: 'GET', action: 'session.list' },
  { pattern: '/sessions', method: 'DELETE', action: 'session.revoke' },
  // Device actions
  { pattern: '/devices', method: 'GET', action: 'device.list' },
  { pattern: '/devices', method: 'PUT', action: 'device.trust' },
  { pattern: '/devices', method: 'DELETE', action: 'device.remove' },
  // Admin actions
  { pattern: '/admin/users/roles', action: 'admin.users.assign_role' },
  { pattern: '/admin/users/lock', action: 'admin.users.lock' },
  { pattern: '/admin/users/unlock', action: 'admin.users.unlock' },
  { pattern: '/admin/users', method: 'GET', action: 'admin.users.list' },
  { pattern: '/admin/roles', method: 'POST', action: 'admin.roles.create' },
  { pattern: '/admin/roles', method: 'PUT', action: 'admin.roles.update' },
  { pattern: '/admin/roles', method: 'DELETE', action: 'admin.roles.delete' },
  // Account deletion
  { pattern: '/users/account', method: 'DELETE', action: 'user.account.delete' },
];

/**
 * Determine action name from route and method
 */
function getActionName(url: string, method: string): string {
  for (const mapping of ACTION_MAPPINGS) {
    if (url.includes(mapping.pattern)) {
      if (!mapping.method || mapping.method === method) {
        return mapping.action;
      }
    }
  }
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
    const nextPart = parts[i + 1];
    if (
      nextPart &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nextPart)
    ) {
      return {
        resource: parts[i],
        resourceId: nextPart,
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
/**
 * Create audit log entry asynchronously
 */
async function createAuditLogEntry(
  auditLogService: IAuditLogService,
  logData: {
    userId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    status: 'success' | 'failure';
    ipAddress: string;
    userAgent?: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await auditLogService.createAuditLog(logData);
    log.debug('Security event logged', {
      action: logData.action,
      userId: logData.userId,
      status: logData.status,
      statusCode: logData.metadata['statusCode'],
    });
  } catch (error) {
    log.error('Failed to create audit log', error as Error, {
      action: logData.action,
      userId: logData.userId,
      url: logData.metadata['url'],
    });
  }
}

/**
 * Audit logging middleware
 * Logs all security-relevant requests
 */
export function auditLoggingMiddleware(request: FastifyRequest, reply: FastifyReply): void {
  const url = request.url;
  const method = request.method;

  if (!isSecurityRelevantRoute(url, method)) {
    return;
  }

  const auditLogService = container.resolve<IAuditLogService>('auditLogService');
  const userId = getUserId(request);
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);
  const action = getActionName(url, method);
  const { resource, resourceId } = getResourceInfo(url);

  reply.raw.on('finish', () => {
    const statusCode = reply.statusCode;
    const status = statusCode >= 200 && statusCode < 300 ? 'success' : 'failure';

    const metadata = {
      method,
      url,
      statusCode,
      requestId: request.id,
      ...(status === 'failure' && request.body
        ? { requestBody: sanitizeRequestBody(request.body as Record<string, unknown>) }
        : {}),
    };

    void createAuditLogEntry(auditLogService, {
      userId,
      action,
      resource,
      resourceId,
      status,
      ipAddress,
      userAgent,
      metadata,
    });
  });
}

/**
 * Sanitize request body for audit logging
 * Remove sensitive fields like passwords
 */
function sanitizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
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
