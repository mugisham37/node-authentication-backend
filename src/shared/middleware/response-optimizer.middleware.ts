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
      processNestedField(obj, filtered, field);
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
 * Process nested field with dot notation
 */
function processNestedField<T extends Record<string, unknown>>(
  obj: T,
  filtered: Partial<T>,
  field: string
): void {
  const parts = field.split('.');
  const rootField = parts[0] as keyof T;
  const part = parts[1];

  if (!(rootField in obj) || part === undefined) {
    return;
  }

  if (!filtered[rootField]) {
    filtered[rootField] = {} as T[keyof T];
  }

  const current = obj[rootField];
  const target = filtered[rootField];

  if (
    current &&
    typeof current === 'object' &&
    !Array.isArray(current) &&
    typeof target === 'object' &&
    !Array.isArray(target) &&
    part in current
  ) {
    const nestedCurrent = current as Record<string, unknown>;
    const nestedTarget = target as Record<string, unknown>;
    nestedTarget[part] = nestedCurrent[part];
  }
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
 * Process payload and apply field filtering
 */
function processPayload(payload: unknown, fields: string[]): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return filterArrayFields(payload as Record<string, unknown>[], fields);
  }

  const payloadRecord = payload as Record<string, unknown>;
  if ('data' in payloadRecord && Array.isArray(payloadRecord['data'])) {
    return {
      ...payload,
      data: filterArrayFields(payloadRecord['data'] as Record<string, unknown>[], fields),
    };
  }

  return filterFields(payload as Record<string, unknown>, fields);
}

/**
 * Middleware to support partial responses (field selection)
 * Usage: GET /api/users?fields=id,name,email
 * Requirement: 19.1
 */
export function partialResponseMiddleware(request: FastifyRequest, reply: FastifyReply): void {
  interface QueryWithFields {
    fields?: string;
    [key: string]: unknown;
  }

  const queryParams = request.query as QueryWithFields;
  const fieldsParam = queryParams.fields;

  if (!fieldsParam) {
    return;
  }

  const fields = parseFields(fieldsParam);

  if (!fields || fields.length === 0) {
    return;
  }

  const originalSend = reply.send.bind(reply);
  type SendFunction = (payload: unknown) => FastifyReply;

  reply.send = function (this: FastifyReply, payload: unknown): FastifyReply {
    try {
      const filtered = processPayload(payload, fields);

      log.debug('Applied field filtering', {
        requestedFields: fields,
        originalSize: JSON.stringify(payload).length,
        filteredSize: JSON.stringify(filtered).length,
      });

      return originalSend.call(this, filtered);
    } catch (error) {
      log.error('Error filtering response fields', error as Error, {
        fields,
      });
      return originalSend.call(this, payload);
    }
  } as SendFunction as typeof reply.send;
}

/**
 * Decorator to mark routes as supporting partial responses
 * This is informational and can be used for API documentation
 */
interface PartialResponseTarget {
  _partialResponseRoutes?: string[];
  [key: string]: unknown;
}

export function supportsPartialResponse() {
  return function (
    target: PartialResponseTarget,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
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

  void reply.header('Cache-Control', directives.join(', '));
}

/**
 * Helper to set no-cache headers for sensitive responses
 */
export function setNoCacheHeaders(reply: FastifyReply): void {
  void reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  void reply.header('Pragma', 'no-cache');
  void reply.header('Expires', '0');
}
