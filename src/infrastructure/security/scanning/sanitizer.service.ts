import { logger } from '../../logging/logger.js';

/**
 * Input Sanitization Service
 * Prevents XSS, SQL injection, and other injection attacks
 * Requirements: 19.1, 19.2
 */
export class SanitizerService {
  /**
   * Sanitize HTML input by removing dangerous tags and attributes
   * @param input - HTML string to sanitize
   * @returns string - Sanitized HTML
   */
  static sanitizeHtml(input: string): string {
    if (!input) {
      return '';
    }

    try {
      // Remove script tags and their content
      let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove dangerous event handlers
      sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
      sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

      // Remove javascript: protocol
      sanitized = sanitized.replace(/javascript:/gi, '');

      // Remove data: protocol (can be used for XSS)
      sanitized = sanitized.replace(/data:text\/html/gi, '');

      logger.debug('HTML sanitized');
      return sanitized.trim();
    } catch (error) {
      logger.error('Failed to sanitize HTML', error as Error);
      return '';
    }
  }

  /**
   * Strip all HTML tags from input
   * @param input - String with HTML tags
   * @returns string - Plain text without HTML
   */
  static stripHtml(input: string): string {
    if (!input) {
      return '';
    }
    return input.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Sanitize SQL input (though Prisma/Drizzle handle this)
   * Additional layer of defense
   * @param input - SQL string to sanitize
   * @returns string - Sanitized SQL
   */
  static sanitizeSql(input: string): string {
    if (!input) {
      return '';
    }

    try {
      // Escape single quotes
      let sanitized = input.replace(/'/g, "''");

      // Remove SQL comments
      sanitized = sanitized.replace(/--.*$/gm, '');
      sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

      // Remove dangerous SQL keywords (basic protection)
      const dangerousKeywords = [
        /;\s*DROP\s+/gi,
        /;\s*DELETE\s+/gi,
        /;\s*TRUNCATE\s+/gi,
        /;\s*ALTER\s+/gi,
        /;\s*CREATE\s+/gi,
        /UNION\s+SELECT/gi,
      ];

      for (const pattern of dangerousKeywords) {
        if (pattern.test(sanitized)) {
          logger.warn('Dangerous SQL pattern detected', { input });
          return '';
        }
      }

      return sanitized;
    } catch (error) {
      logger.error('Failed to sanitize SQL', error as Error);
      return '';
    }
  }

  /**
   * Validate that input doesn't contain script injection
   * @param input - String to validate
   * @returns boolean - True if safe
   */
  static validateNoScriptInjection(input: string): boolean {
    if (!input) {
      return true;
    }

    const dangerousPatterns = [
      /<script/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick, onerror, etc.
      /eval\s*\(/i,
      /expression\s*\(/i,
    ];

    const hasDangerousPattern = dangerousPatterns.some((pattern) => pattern.test(input));

    if (hasDangerousPattern) {
      logger.warn('Script injection attempt detected', { input: input.substring(0, 100) });
    }

    return !hasDangerousPattern;
  }

  /**
   * Sanitize filename to prevent directory traversal
   * @param filename - Filename to sanitize
   * @returns string - Safe filename
   */
  static sanitizeFilename(filename: string): string {
    if (!filename) {
      return '';
    }

    try {
      // Remove path separators
      let sanitized = filename.replace(/[/\\]/g, '');

      // Remove null bytes
      sanitized = sanitized.replace(/\0/g, '');

      // Remove leading dots (hidden files)
      sanitized = sanitized.replace(/^\.+/, '');

      // Only allow alphanumeric, dash, underscore, and dot
      sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Limit length
      if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255);
      }

      logger.debug('Filename sanitized', { original: filename, sanitized });
      return sanitized;
    } catch (error) {
      logger.error('Failed to sanitize filename', error as Error);
      return 'file';
    }
  }

  /**
   * Sanitize URL to prevent open redirect attacks
   * @param url - URL to sanitize
   * @param allowedDomains - List of allowed domains
   * @returns string | null - Sanitized URL or null if invalid
   */
  static sanitizeUrl(url: string, allowedDomains: string[] = []): string | null {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url);

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        logger.warn('Invalid URL protocol', { url, protocol: parsed.protocol });
        return null;
      }

      // Check against allowed domains if provided
      if (allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some((domain) => parsed.hostname.endsWith(domain));
        if (!isAllowed) {
          logger.warn('URL domain not allowed', { url, hostname: parsed.hostname });
          return null;
        }
      }

      return parsed.toString();
    } catch (error) {
      logger.warn('Invalid URL format', { url });
      return null;
    }
  }

  /**
   * Sanitize email address
   * @param email - Email to sanitize
   * @returns string - Sanitized email
   */
  static sanitizeEmail(email: string): string {
    if (!email) {
      return '';
    }

    // Convert to lowercase and trim
    let sanitized = email.toLowerCase().trim();

    // Remove any characters that aren't valid in email addresses
    sanitized = sanitized.replace(/[^a-z0-9@._+-]/g, '');

    return sanitized;
  }

  /**
   * Sanitize phone number to E.164 format
   * @param phone - Phone number to sanitize
   * @returns string - Sanitized phone number
   */
  static sanitizePhoneNumber(phone: string): string {
    if (!phone) {
      return '';
    }

    // Remove all non-digit characters except leading +
    let sanitized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!sanitized.startsWith('+')) {
      sanitized = '+' + sanitized;
    }

    return sanitized;
  }
}
