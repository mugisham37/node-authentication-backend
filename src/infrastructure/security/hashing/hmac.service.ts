import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../../logging/logger.js';

/**
 * HMAC Service for message authentication
 * Used for webhook signatures, API signatures, and token validation
 * Requirements: 16.3, 16.4, 19.1
 */
export class HmacService {
  private static readonly ALGORITHM = 'sha256';

  /**
   * Generate HMAC signature for a payload
   * @param payload - Data to sign (string or object)
   * @param secret - Secret key for signing
   * @returns string - Hex-encoded HMAC signature
   */
  static generateSignature(payload: string | object, secret: string): string {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const signature = createHmac(this.ALGORITHM, secret).update(data).digest('hex');

      logger.debug('HMAC signature generated');
      return signature;
    } catch (error) {
      logger.error('Failed to generate HMAC signature', error as Error);
      throw new Error('Signature generation failed');
    }
  }

  /**
   * Verify HMAC signature using timing-safe comparison
   * @param payload - Data that was signed
   * @param signature - Signature to verify
   * @param secret - Secret key used for signing
   * @returns boolean - True if signature is valid
   */
  static verifySignature(payload: string | object, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, secret);

      // Use timing-safe comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        logger.warn('HMAC signature verification failed: length mismatch');
        return false;
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);
      logger.debug('HMAC signature verification completed', { isValid });

      return isValid;
    } catch (error) {
      logger.error('Failed to verify HMAC signature', error as Error);
      return false;
    }
  }

  /**
   * Generate webhook signature with timestamp
   * Includes timestamp to prevent replay attacks
   * @param payload - Webhook payload
   * @param secret - Webhook secret
   * @param timestamp - Unix timestamp (defaults to now)
   * @returns object - Signature and timestamp
   */
  static generateWebhookSignature(
    payload: object,
    secret: string,
    timestamp?: number
  ): { signature: string; timestamp: number } {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${JSON.stringify(payload)}`;
    const signature = this.generateSignature(signedPayload, secret);

    return { signature, timestamp: ts };
  }

  /**
   * Verify webhook signature with timestamp validation
   * @param payload - Webhook payload
   * @param signature - Signature to verify
   * @param secret - Webhook secret
   * @param timestamp - Timestamp from webhook
   * @param toleranceSeconds - Maximum age of webhook (default: 300s = 5min)
   * @returns boolean - True if signature is valid and not expired
   */
  static verifyWebhookSignature(
    payload: object,
    signature: string,
    secret: string,
    timestamp: number,
    toleranceSeconds: number = 300
  ): boolean {
    // Check timestamp is not too old (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      logger.warn('Webhook signature verification failed: timestamp too old', {
        timestamp,
        now,
        difference: Math.abs(now - timestamp),
      });
      return false;
    }

    // Verify signature
    const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
    return this.verifySignature(signedPayload, signature, secret);
  }

  /**
   * Generate API request signature
   * Used for signing API requests between services
   * @param method - HTTP method
   * @param path - Request path
   * @param body - Request body
   * @param secret - API secret
   * @param timestamp - Unix timestamp
   * @returns string - Request signature
   */
  static generateApiSignature(
    method: string,
    path: string,
    body: string | object,
    secret: string,
    timestamp: number
  ): string {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const signatureBase = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyString}`;
    return this.generateSignature(signatureBase, secret);
  }
}
