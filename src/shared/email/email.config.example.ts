import type { EmailServiceConfig } from './email.factory.js';

/**
 * Example email service configuration
 * Copy this to your environment configuration and adjust values
 */
export const emailConfigExample: EmailServiceConfig = {
  nodemailer: {
    host: process.env['SMTP_HOST'] || 'smtp.example.com',
    port: parseInt(process.env['SMTP_PORT'] || '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true', // true for 465, false for other ports
    auth: {
      user: process.env['SMTP_USER'] || 'your-email@example.com',
      pass: process.env['SMTP_PASS'] || 'your-password',
    },
    from: process.env['SMTP_FROM'] || '"Enterprise Auth" <noreply@example.com>',
  },
  useQueue: process.env['EMAIL_USE_QUEUE'] !== 'false', // Default to true
};

/**
 * Environment variables required:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (usually 587 for TLS, 465 for SSL)
 * - SMTP_SECURE: 'true' for SSL, 'false' for TLS
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - SMTP_FROM: From address for emails
 * - EMAIL_USE_QUEUE: 'true' to use BullMQ queue, 'false' for direct sending
 */
