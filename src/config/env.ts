import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment variable schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.string().transform(Number).default('2'),
  DATABASE_POOL_MAX: z.string().transform(Number).default('20'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  REDIS_CLUSTER_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // JWT
  JWT_ACCESS_TOKEN_SECRET: z.string().min(32),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  JWT_ALGORITHM: z.string().default('RS256'),
  JWT_PRIVATE_KEY_PATH: z.string().optional(),
  JWT_PUBLIC_KEY_PATH: z.string().optional(),

  // Password Hashing
  ARGON2_TIME_COST: z.string().transform(Number).default('2'),
  ARGON2_MEMORY_COST: z.string().transform(Number).default('65536'),
  ARGON2_PARALLELISM: z.string().transform(Number).default('1'),

  // Email
  EMAIL_PROVIDER: z.string().default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('Enterprise Auth System'),

  // SMS
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CALLBACK_URL: z.string().url().optional(),

  // Rate Limiting
  RATE_LIMIT_AUTH_MAX: z.string().transform(Number).default('10'),
  RATE_LIMIT_AUTH_WINDOW: z.string().transform(Number).default('60000'),
  RATE_LIMIT_PASSWORD_RESET_MAX: z.string().transform(Number).default('5'),
  RATE_LIMIT_PASSWORD_RESET_WINDOW: z.string().transform(Number).default('60000'),
  RATE_LIMIT_REGISTRATION_MAX: z.string().transform(Number).default('3'),
  RATE_LIMIT_REGISTRATION_WINDOW: z.string().transform(Number).default('300000'),

  // Session
  SESSION_EXPIRY_DAYS: z.string().transform(Number).default('7'),
  SESSION_INACTIVE_DAYS: z.string().transform(Number).default('30'),
  SESSION_TRUST_SCORE_THRESHOLD: z.string().transform(Number).default('50'),

  // MFA
  MFA_TOTP_WINDOW: z.string().transform(Number).default('1'),
  MFA_BACKUP_CODES_COUNT: z.string().transform(Number).default('10'),
  MFA_CHALLENGE_EXPIRY: z.string().transform(Number).default('300'),

  // Security
  ACCOUNT_LOCKOUT_THRESHOLD: z.string().transform(Number).default('5'),
  ACCOUNT_LOCKOUT_DURATION: z.string().transform(Number).default('900'),
  PASSWORD_RESET_TOKEN_EXPIRY: z.string().transform(Number).default('3600'),
  EMAIL_VERIFICATION_TOKEN_EXPIRY: z.string().transform(Number).default('86400'),
  MAGIC_LINK_TOKEN_EXPIRY: z.string().transform(Number).default('900'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Monitoring
  PROMETHEUS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  PROMETHEUS_PORT: z.string().transform(Number).default('9090'),
  OPENTELEMETRY_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  OPENTELEMETRY_ENDPOINT: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LOG_FILE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),

  // Background Jobs
  BULLMQ_REDIS_HOST: z.string().default('localhost'),
  BULLMQ_REDIS_PORT: z.string().transform(Number).default('6379'),
  BULLMQ_CONCURRENCY: z.string().transform(Number).default('5'),

  // Webhooks
  WEBHOOK_MAX_RETRIES: z.string().transform(Number).default('5'),
  WEBHOOK_RETRY_DELAY: z.string().transform(Number).default('1000'),
  WEBHOOK_TIMEOUT: z.string().transform(Number).default('5000'),

  // Feature Flags
  FEATURE_OAUTH_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_MFA_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_PASSWORDLESS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_WEBHOOKS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_WEBSOCKET_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
});

// Parse and validate environment variables
const parseEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
