import { z } from 'zod';

/**
 * Phone number validation schema (E.164 format)
 */
const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +1234567890)');

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
