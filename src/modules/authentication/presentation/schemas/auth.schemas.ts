/**
 * OpenAPI schema definitions for authentication routes
 * Extracted from shared openapi-schemas for module organization
 * Requirements: 23.1, 23.2
 */

/**
 * Authentication request/response schemas
 */
export const registerRequestSchema = {
  description: 'User registration request',
  type: 'object',
  required: ['email', 'password', 'name'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
      example: 'user@example.com',
    },
    password: {
      type: 'string',
      minLength: 8,
      description:
        'Password (min 8 chars, must include uppercase, lowercase, number, special char)',
      example: 'SecurePass123!',
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'User full name',
      example: 'John Doe',
    },
    image: {
      type: 'string',
      format: 'uri',
      description: 'Profile image URL (optional)',
      example: 'https://example.com/avatar.jpg',
    },
  },
} as const;

export const registerResponseSchema = {
  description: 'Successful registration',
  type: 'object',
  properties: {
    user: { $ref: '#/components/schemas/User' },
    accessToken: {
      type: 'string',
      description: 'JWT access token (expires in 15 minutes)',
      example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
    refreshToken: {
      type: 'string',
      description: 'Refresh token (expires in 7 days)',
      example: 'a1b2c3d4e5f6...',
    },
  },
  required: ['user', 'accessToken', 'refreshToken'],
} as const;

export const loginRequestSchema = {
  description: 'Login request',
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
      example: 'user@example.com',
    },
    password: {
      type: 'string',
      description: 'User password',
      example: 'SecurePass123!',
    },
  },
} as const;

export const loginResponseSchema = {
  description: 'Successful login',
  type: 'object',
  properties: {
    user: { $ref: '#/components/schemas/User' },
    accessToken: {
      type: 'string',
      description: 'JWT access token',
    },
    refreshToken: {
      type: 'string',
      description: 'Refresh token',
    },
    session: { $ref: '#/components/schemas/Session' },
  },
} as const;

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

export const refreshTokenRequestSchema = {
  description: 'Token refresh request',
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: {
      type: 'string',
      description: 'Valid refresh token',
      example: 'a1b2c3d4e5f6...',
    },
  },
} as const;

export const refreshTokenResponseSchema = {
  description: 'New tokens',
  type: 'object',
  properties: {
    accessToken: {
      type: 'string',
      description: 'New JWT access token',
    },
    refreshToken: {
      type: 'string',
      description: 'New refresh token (old token is invalidated)',
    },
  },
  required: ['accessToken', 'refreshToken'],
} as const;

export const verifyEmailRequestSchema = {
  description: 'Email verification request',
  type: 'object',
  required: ['token'],
  properties: {
    token: {
      type: 'string',
      description: 'Email verification token from email',
      example: 'vt_1234567890abcdef',
    },
  },
} as const;

export const messageResponseSchema = {
  description: 'Success message',
  type: 'object',
  properties: {
    message: {
      type: 'string',
      example: 'Operation completed successfully',
    },
  },
  required: ['message'],
} as const;

export const forgotPasswordRequestSchema = {
  description: 'Password reset request',
  type: 'object',
  required: ['email'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
      example: 'user@example.com',
    },
  },
} as const;

export const resetPasswordRequestSchema = {
  description: 'Password reset with token',
  type: 'object',
  required: ['token', 'password'],
  properties: {
    token: {
      type: 'string',
      description: 'Password reset token from email',
      example: 'rt_1234567890abcdef',
    },
    password: {
      type: 'string',
      minLength: 8,
      description: 'New password',
      example: 'NewSecurePass123!',
    },
  },
} as const;

export const currentUserResponseSchema = {
  description: 'Current user profile',
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'User roles',
        },
      },
    },
  },
} as const;

/**
 * Common tags for authentication endpoints
 */
export const authenticationTag = ['Authentication'];

/**
 * Security scheme for bearer token authentication
 */
export const bearerAuthSecurity = [{ bearerAuth: [] }];
