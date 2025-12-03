/**
 * OpenAPI schemas for MFA endpoints
 */

export const mfaChallengeResponseSchema = {
  description: 'MFA challenge required',
  type: 'object',
  properties: {
    mfaRequired: {
      type: 'boolean',
      example: true,
    },
    challengeId: {
      type: 'string',
      description: 'MFA challenge identifier (valid for 5 minutes)',
      example: 'ch_1234567890',
    },
  },
  required: ['mfaRequired', 'challengeId'],
} as const;

export const setupMfaRequestSchema = {
  description: 'MFA setup request',
  type: 'object',
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: ['totp', 'sms'],
      description: 'Type of MFA to enable',
      example: 'totp',
    },
    phoneNumber: {
      type: 'string',
      description: 'Phone number in E.164 format (required for SMS MFA)',
      example: '+1234567890',
    },
  },
} as const;

export const setupMfaResponseSchema = {
  description: 'MFA setup response',
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['totp', 'sms'],
    },
    secret: {
      type: 'string',
      description: 'TOTP secret (only for TOTP)',
    },
    qrCode: {
      type: 'string',
      description: 'QR code URL (only for TOTP)',
    },
    phoneNumber: {
      type: 'string',
      description: 'Phone number (only for SMS)',
    },
    message: {
      type: 'string',
      description: 'Setup instructions',
    },
  },
} as const;

export const verifyMfaRequestSchema = {
  description: 'MFA verification request',
  type: 'object',
  required: ['challengeId', 'code'],
  properties: {
    challengeId: {
      type: 'string',
      description: 'MFA challenge identifier',
      example: 'ch_1234567890',
    },
    code: {
      type: 'string',
      description: '6-digit MFA code',
      example: '123456',
      minLength: 6,
      maxLength: 6,
    },
  },
} as const;

export const verifyMfaResponseSchema = {
  description: 'MFA verification response',
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        image: { type: 'string', nullable: true },
        emailVerified: { type: 'boolean' },
        mfaEnabled: { type: 'boolean' },
      },
    },
    accessToken: {
      type: 'string',
      description: 'JWT access token',
    },
    refreshToken: {
      type: 'string',
      description: 'Refresh token',
    },
    session: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        deviceName: { type: 'string' },
        trustScore: { type: 'number' },
      },
    },
  },
} as const;

export const disableMfaRequestSchema = {
  description: 'MFA disable request',
  type: 'object',
  required: ['code'],
  properties: {
    code: {
      type: 'string',
      description: '6-digit MFA code or backup code',
      example: '123456',
    },
  },
} as const;

export const disableMfaResponseSchema = {
  description: 'MFA disable response',
  type: 'object',
  properties: {
    message: {
      type: 'string',
      example: 'MFA disabled successfully',
    },
  },
} as const;

export const backupCodesResponseSchema = {
  description: 'MFA backup codes',
  type: 'object',
  properties: {
    backupCodes: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'List of backup codes',
      example: ['ABC12345', 'DEF67890'],
    },
  },
} as const;

/**
 * MFA tag for OpenAPI documentation
 */
export const mfaTag = ['Multi-Factor Authentication'];
