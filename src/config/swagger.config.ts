import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';
import { env } from './env.js';

/**
 * Swagger/OpenAPI configuration
 * Requirements: 23.1, 23.2
 */
export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'Enterprise Authentication System API',
      description: `
# Enterprise Authentication System

A production-ready, enterprise-grade authentication and authorization backend designed to handle millions of concurrent users with sub-millisecond response times.

## Features

- **Multiple Authentication Methods**: Email/password, MFA (TOTP/SMS), passwordless (magic links, WebAuthn), OAuth/Social
- **Sophisticated Authorization**: Role-based access control (RBAC) with permission caching
- **Security**: Argon2id password hashing, RS256 JWT tokens, rate limiting, device fingerprinting
- **Real-time Updates**: WebSocket notifications for security events
- **Audit & Compliance**: Complete audit trails with risk scoring
- **High Availability**: Horizontal scaling, circuit breakers, graceful degradation

## Authentication

Most endpoints require authentication via JWT access token in the Authorization header:

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

Access tokens expire after 15 minutes. Use the refresh token endpoint to obtain new access tokens.

## Rate Limiting

All endpoints are rate-limited to prevent abuse:
- Authentication endpoints: 10 requests/minute per IP
- Password reset: 5 requests/minute per IP
- Registration: 3 requests per 5 minutes per IP
- MFA verification: 1 request per 10 seconds per user

Rate limit headers are included in responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Time when the rate limit resets
- \`Retry-After\`: Seconds to wait before retrying (on 429 errors)

## Error Responses

All errors follow a consistent format:

\`\`\`json
{
  "error": {
    "type": "ErrorType",
    "message": "Human-readable error message",
    "details": {},
    "requestId": "uuid"
  }
}
\`\`\`

Common error types:
- \`ValidationError\` (400): Invalid request data
- \`AuthenticationError\` (401): Invalid or missing credentials
- \`AuthorizationError\` (403): Insufficient permissions
- \`NotFoundError\` (404): Resource not found
- \`ConflictError\` (409): Resource already exists
- \`RateLimitError\` (429): Too many requests
- \`InternalServerError\` (500): Unexpected server error

## Pagination

List endpoints support pagination via query parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10, max: 100)
- \`sortBy\`: Field to sort by
- \`sortOrder\`: Sort direction (\`asc\` or \`desc\`)

## Versioning

The API is versioned via URL path: \`/api/v1/...\`

Breaking changes will result in a new version (v2, v3, etc.) while maintaining backward compatibility for previous versions.
      `.trim(),
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url:
          env.NODE_ENV === 'production'
            ? 'https://api.example.com'
            : `http://localhost:${env.PORT}`,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User registration, login, logout, and token management',
      },
      {
        name: 'Multi-Factor Authentication',
        description: 'TOTP and SMS-based MFA setup and verification',
      },
      {
        name: 'Passwordless',
        description: 'Magic link and WebAuthn authentication',
      },
      {
        name: 'OAuth',
        description: 'Social authentication via Google, GitHub, and Microsoft',
      },
      {
        name: 'Sessions',
        description: 'Session management and device tracking',
      },
      {
        name: 'Devices',
        description: 'Device registration and trust management',
      },
      {
        name: 'Users',
        description: 'User profile and account management',
      },
      {
        name: 'Admin',
        description: 'Administrative operations (requires admin role)',
      },
      {
        name: 'Webhooks',
        description: 'Webhook registration and management',
      },
      {
        name: 'Monitoring',
        description: 'Health checks and metrics',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from login or registration',
        },
      },
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['type', 'message', 'requestId'],
              properties: {
                type: {
                  type: 'string',
                  description: 'Error type identifier',
                  example: 'ValidationError',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                  example: 'Request validation failed',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                  additionalProperties: true,
                },
                requestId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Unique request identifier for debugging',
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          required: ['id', 'email', 'name', 'emailVerified', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            name: {
              type: 'string',
              description: 'User full name',
            },
            image: {
              type: 'string',
              format: 'uri',
              description: 'User profile image URL',
              nullable: true,
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether email has been verified',
            },
            mfaEnabled: {
              type: 'boolean',
              description: 'Whether MFA is enabled',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
          },
        },
        Session: {
          type: 'object',
          required: ['id', 'deviceName', 'trustScore'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Session identifier',
            },
            deviceName: {
              type: 'string',
              description: 'Device name or type',
            },
            deviceFingerprint: {
              type: 'string',
              description: 'Unique device fingerprint',
            },
            ipAddress: {
              type: 'string',
              description: 'IP address of the session',
            },
            location: {
              type: 'string',
              description: 'Geographic location',
              nullable: true,
            },
            isTrusted: {
              type: 'boolean',
              description: 'Whether device is marked as trusted',
            },
            trustScore: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Trust score (0-100)',
            },
            lastActivityAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last activity timestamp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Session creation timestamp',
            },
          },
        },
        Device: {
          type: 'object',
          required: ['id', 'name', 'type', 'isTrusted', 'lastSeenAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Device identifier',
            },
            name: {
              type: 'string',
              description: 'Device name',
            },
            type: {
              type: 'string',
              description: 'Device type (desktop, mobile, tablet)',
            },
            fingerprint: {
              type: 'string',
              description: 'Unique device fingerprint',
            },
            isTrusted: {
              type: 'boolean',
              description: 'Whether device is trusted',
            },
            lastSeenAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last seen timestamp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Device registration timestamp',
            },
          },
        },
        Role: {
          type: 'object',
          required: ['id', 'name', 'isSystem'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Role identifier',
            },
            name: {
              type: 'string',
              description: 'Role name',
            },
            description: {
              type: 'string',
              description: 'Role description',
              nullable: true,
            },
            isSystem: {
              type: 'boolean',
              description: 'Whether role is a system role (cannot be deleted)',
            },
            permissions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Permission',
              },
            },
          },
        },
        Permission: {
          type: 'object',
          required: ['id', 'resource', 'action'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Permission identifier',
            },
            resource: {
              type: 'string',
              description: 'Resource type (e.g., users, roles, webhooks)',
            },
            action: {
              type: 'string',
              description: 'Action type (e.g., read, write, delete)',
            },
            description: {
              type: 'string',
              description: 'Permission description',
              nullable: true,
            },
          },
        },
        Webhook: {
          type: 'object',
          required: ['id', 'url', 'events', 'isActive'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Webhook identifier',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Webhook callback URL',
            },
            events: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Subscribed event types',
            },
            secret: {
              type: 'string',
              description: 'Webhook secret for signature verification',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether webhook is active',
            },
            description: {
              type: 'string',
              description: 'Webhook description',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Webhook creation timestamp',
            },
          },
        },
        AuditLog: {
          type: 'object',
          required: ['id', 'action', 'status', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Audit log identifier',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User who performed the action',
              nullable: true,
            },
            action: {
              type: 'string',
              description: 'Action performed',
            },
            resource: {
              type: 'string',
              description: 'Resource type affected',
              nullable: true,
            },
            resourceId: {
              type: 'string',
              format: 'uuid',
              description: 'Resource identifier',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['success', 'failure'],
              description: 'Action status',
            },
            ipAddress: {
              type: 'string',
              description: 'IP address',
              nullable: true,
            },
            userAgent: {
              type: 'string',
              description: 'User agent string',
              nullable: true,
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
              additionalProperties: true,
            },
            riskScore: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Risk score (0-100)',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Log creation timestamp',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          required: ['page', 'limit', 'total', 'totalPages'],
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Items per page',
            },
            total: {
              type: 'integer',
              minimum: 0,
              description: 'Total number of items',
            },
            totalPages: {
              type: 'integer',
              minimum: 0,
              description: 'Total number of pages',
            },
          },
        },
      },
    },
    externalDocs: {
      description: 'Find more information in the GitHub repository',
      url: 'https://github.com/example/enterprise-auth-system',
    },
  },
  transform: ({ schema, url }) => {
    // Transform Zod schemas to OpenAPI schemas
    return {
      schema,
      url,
    };
  },
};

/**
 * Swagger UI configuration
 * Requirements: 23.3
 */
export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
  },
  uiHooks: {
    onRequest: function (_request, _reply, next) {
      next();
    },
    preHandler: function (_request, _reply, next) {
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, _request, _reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};
