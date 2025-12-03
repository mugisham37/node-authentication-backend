import { FastifyRequest, FastifyReply } from 'fastify';
import { log } from '../logging/logger.js';

/**
 * Response optimization middleware
 * Implements partial response support (field selection)
 * Requirement: 19.1
 */

/**
 * Parse fields parameter from query string
 * Supports comma-separated field names: ?fields=id,name,email
 */
function parseFields(fieldsParam?: string): string[] | null {
  if (!fieldsParam) {
    return null;
  }

  return fieldsParam
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
}

/**
 * Filter object to include only specified fields
 */
function filterFields<T extends Record<string, unknown>>(obj: T, fields: string[]): Partial<T> {
  const filtered: Partial<T> = {};

  for (const field of fields) {
    // Support nested fields with dot notation (e.g., "user.name")
    if (field.includes('.')) {
      const parts = field.split('.');
      const rootField = parts[0] as keyof T;

      if (rootField in obj) {
        if (!filtered[rootField]) {
          filtered[rootField] = {} as T[keyof T];
        }

        // Handle nested field
        let current: any = obj[rootField];
        let target: any = filtered[rootField];

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (current && typeof current === 'object' && part in current) {
            if (i === parts.length - 1) {
              target[part] = current[part];
            } else {
              if (!target[part]) {
                target[part] = {};
              }
              target = target[part];
              current = current[part];
            }
          }
        }
      }
    } else {
      // Simple field
      const key = field as keyof T;
      if (key in obj) {
        filtered[key] = obj[key];
      }
    }
  }

  return filtered;
}

/**
 * Filter array of objects to include only specified fields
 */
function filterArrayFields<T extends Record<string, unknown>>(
  arr: T[],
  fields: string[]
): Array<Partial<T>> {
  return arr.map((item) => filterFields(item, fields));
}

/**
 * Middleware to support partial responses (field selection)
 * Usage: GET /api/users?fields=id,name,email
 * Requirement: 19.1
 */
export async function partialResponseMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const fieldsParam = (request.query as any).fields as string | undefined;

  if (!fieldsParam) {
    // No field selection requested, continue normally
    return;
  }

  const fields = parseFields(fieldsParam);

  if (!fields || fields.length === 0) {
    // Invalid fields parameter, continue normally
    return;
  }

  // Hook into the response serialization
  const originalSend = reply.send.bind(reply);

  reply.send = function (payload: unknown) {
    try {
      // Only filter if payload is an object or array
      if (payload && typeof payload === 'object') {
        let filtered: unknown;

        if (Array.isArray(payload)) {
          // Filter array of objects
          filtered = filterArrayFields(payload as Record<string, unknown>[], fields);
        } else if ('data' in payload && Array.isArray((payload as any).data)) {
          // Handle paginated responses with data array
          filtered = {
            ...payload,
            data: filterArrayFields((payload as any).data, fields),
          };
        } else {
          // Filter single object
          filtered = filterFields(payload as Record<string, unknown>, fields);
        }

        log.debug('Applied field filtering', {
          requestedFields: fields,
          originalSize: JSON.stringify(payload).length,
          filteredSize: JSON.stringify(filtered).length,
        });

        return originalSend(filtered);
      }

      return originalSend(payload);
    } catch (error) {
      log.error('Error filtering response fields', error as Error, {
        fields,
      });
      // On error, return original payload
      return originalSend(payload);
    }
  } as any;
}

/**
 * Decorator to mark routes as supporting partial responses
 * This is informational and can be used for API documentation
 */
export function supportsPartialResponse() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Add metadata for documentation
    if (!target._partialResponseRoutes) {
      target._partialResponseRoutes = [];
    }
    target._partialResponseRoutes.push(propertyKey);
    return descriptor;
  };
}

/**
 * Helper to add Cache-Control headers for cacheable responses
 * Requirement: 19.1
 */
export function setCacheHeaders(
  reply: FastifyReply,
  maxAge: number = 300,
  options: {
    public?: boolean;
    immutable?: boolean;
    mustRevalidate?: boolean;
  } = {}
): void {
  const directives: string[] = [];

  if (options.public) {
    directives.push('public');
  } else {
    directives.push('private');
  }

  directives.push(`max-age=${maxAge}`);

  if (options.immutable) {
    directives.push('immutable');
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  reply.header('Cache-Control', directives.join(', '));
}

/**
 * Helper to set no-cache headers for sensitive responses
 */
export function setNoCacheHeaders(reply: FastifyReply): void {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');
}
