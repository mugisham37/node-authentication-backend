import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../logging/logger.js';

/**
 * AES-256-GCM Encryption Service
 * Used for encrypting sensitive data at rest (MFA secrets, OAuth tokens, etc.)
 * Requirements: 4.3, 5.3, 19.1
 */
export class AesEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Get encryption key from environment
   * Key should be 32 bytes (256 bits) for AES-256
   */
  private static getEncryptionKey(): Buffer {
    const key = env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // Ensure key is exactly 32 bytes
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }

    return keyBuffer;
  }

  /**
   * Encrypt plaintext data
   * @param plaintext - Data to encrypt
   * @returns object - Encrypted data with IV and auth tag
   */
  static encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    try {
      const iv = randomBytes(this.IV_LENGTH);
      const cipher = createCipheriv(this.ALGORITHM, this.getEncryptionKey(), iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      logger.debug('Data encrypted successfully');

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      logger.error('Failed to encrypt data', error as Error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt encrypted data
   * @param encrypted - Encrypted data (hex string)
   * @param iv - Initialization vector (hex string)
   * @param tag - Authentication tag (hex string)
   * @returns string - Decrypted plaintext
   */
  static decrypt(encrypted: string, iv: string, tag: string): string {
    try {
      const decipher = createDecipheriv(
        this.ALGORITHM,
        this.getEncryptionKey(),
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('Data decrypted successfully');

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt data', error as Error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt and encode as single string
   * Format: iv:tag:encrypted (all hex-encoded)
   * Convenient for storing in database as single field
   * @param plaintext - Data to encrypt
   * @returns string - Combined encrypted string
   */
  static encryptToString(plaintext: string): string {
    const { encrypted, iv, tag } = this.encrypt(plaintext);
    return `${iv}:${tag}:${encrypted}`;
  }

  /**
   * Decrypt from combined string format
   * @param encryptedString - Combined string (iv:tag:encrypted)
   * @returns string - Decrypted plaintext
   */
  static decryptFromString(encryptedString: string): string {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format');
    }

    const [iv, tag, encrypted] = parts;
    return this.decrypt(encrypted, iv, tag);
  }

  /**
   * Encrypt object to JSON string
   * @param data - Object to encrypt
   * @returns string - Encrypted JSON
   */
  static encryptObject(data: object): string {
    const json = JSON.stringify(data);
    return this.encryptToString(json);
  }

  /**
   * Decrypt and parse JSON object
   * @param encryptedString - Encrypted JSON string
   * @returns object - Decrypted object
   */
  static decryptObject<T = unknown>(encryptedString: string): T {
    const json = this.decryptFromString(encryptedString);
    return JSON.parse(json) as T;
  }

  /**
   * Generate a new encryption key
   * Use this to generate ENCRYPTION_KEY for .env file
   * @returns string - Hex-encoded 256-bit key
   */
  static generateKey(): string {
    return randomBytes(32).toString('hex');
  }
}
