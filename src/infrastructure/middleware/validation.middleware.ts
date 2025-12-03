import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/types/application-error.js';

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Validate a single request part with a Zod schema
 */
function validatePart<T>(
  data: T,
  schema: ZodSchema,
  partName: string,
  errors: Record<string, Array<{ path: string; message: string }>>
): T {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    if (error instanceof ZodError) {
      errors[partName] = formatZodErrors(error);
    }
    return data;
  }
}

/**
 * Creates a validation middleware using Zod schemas
 * @param schemas - Object containing Zod schemas for different parts of the request
 * @returns Fastify middleware function
 */
export function validateRequest(schemas: ValidationSchemas) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const errors: Record<string, Array<{ path: string; message: string }>> = {};

    try {
      if (schemas.body) {
        request.body = validatePart(request.body, schemas.body, 'body', errors);
      }

      if (schemas.query) {
        request.query = validatePart(request.query, schemas.query, 'query', errors);
      }

      if (schemas.params) {
        request.params = validatePart(request.params, schemas.params, 'params', errors);
      }

      if (schemas.headers) {
        request.headers = validatePart(request.headers, schemas.headers, 'headers', errors);
      }

      if (Object.keys(errors).length > 0) {
        throw new ValidationError('Request validation failed', errors);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Request validation failed');
    }
  };
}

/**
 * Formats Zod validation errors into a more readable structure
 */
function formatZodErrors(error: ZodError): Array<{ path: string; message: string }> {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Common validation schemas
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Email validation
export const emailSchema = z.string().email('Invalid email format').toLowerCase();

// Password validation (8+ chars, uppercase, lowercase, number, special char)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Phone number validation (E.164 format)
export const phoneNumberSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{1,14}$/,
    'Invalid phone number format. Expected E.164 format (e.g., +1234567890)'
  );

// Pagination schemas
export const paginationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('10'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Date range schemas
export const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Common ID parameter schema
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Validation schemas for authentication endpoints
 */

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  image: z.string().url('Invalid image URL').optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

/**
 * Validation schemas for MFA endpoints
 */

export const setupMfaBodySchema = z.object({
  type: z.enum(['totp', 'sms'], {
    errorMap: () => ({ message: 'MFA type must be either "totp" or "sms"' }),
  }),
  phoneNumber: phoneNumberSchema.optional(),
});

export const verifyMfaBodySchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  code: z
    .string()
    .length(6, 'MFA code must be 6 digits')
    .regex(/^\d+$/, 'MFA code must be numeric'),
});

export const disableMfaBodySchema = z.object({
  code: z
    .string()
    .length(6, 'MFA code must be 6 digits')
    .regex(/^\d+$/, 'MFA code must be numeric'),
});

/**
 * Validation schemas for user management
 */

export const updateProfileBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
  image: z.string().url('Invalid image URL').optional(),
});

/**
 * Validation schemas for webhooks
 */

export const createWebhookBodySchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event type is required'),
  description: z.string().max(500, 'Description is too long').optional(),
});

export const updateWebhookBodySchema = z.object({
  url: z.string().url('Invalid webhook URL').optional(),
  events: z.array(z.string()).min(1, 'At least one event type is required').optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500, 'Description is too long').optional(),
});

/**
 * Validation schemas for admin endpoints
 */

export const assignRolesBodySchema = z.object({
  roleIds: z.array(uuidSchema).min(1, 'At least one role ID is required'),
});

export const createRoleBodySchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  permissionIds: z.array(uuidSchema).optional(),
});

export const updateRoleBodySchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional(),
  permissionIds: z.array(uuidSchema).optional(),
});

export const auditLogQuerySchema = paginationQuerySchema.extend({
  userId: uuidSchema.optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minRiskScore: z.string().transform(Number).pipe(z.number().int().min(0).max(100)).optional(),
});
