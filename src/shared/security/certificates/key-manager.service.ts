import { readFileSync, existsSync } from 'fs';
import { generateKeyPairSync } from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../logging/logger.js';

/**
 * Key Manager Service
 * Manages cryptographic keys for JWT signing, encryption, etc.
 * Requirements: 3.7, 7.2, 19.1
 */
export class KeyManagerService {
  private static jwtPrivateKey: string | null = null;
  private static jwtPublicKey: string | null = null;

  /**
   * Load JWT private key from file or environment
   * @returns string - Private key in PEM format
   */
  static loadJwtPrivateKey(): string {
    if (this.jwtPrivateKey) {
      return this.jwtPrivateKey;
    }

    try {
      // Try to load from file first
      if (env.JWT_PRIVATE_KEY_PATH && existsSync(env.JWT_PRIVATE_KEY_PATH)) {
        this.jwtPrivateKey = readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf8');
        logger.info('JWT private key loaded from file');
        return this.jwtPrivateKey;
      }

      // Fall back to environment variable
      if (env.JWT_PRIVATE_KEY) {
        this.jwtPrivateKey = env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
        logger.info('JWT private key loaded from environment');
        return this.jwtPrivateKey;
      }

      // If neither exists, generate a warning
      logger.warn('JWT private key not found, using symmetric key instead');
      return env.JWT_SECRET;
    } catch (error) {
      logger.error('Failed to load JWT private key', error as Error);
      throw new Error('JWT private key loading failed');
    }
  }

  /**
   * Load JWT public key from file or environment
   * @returns string - Public key in PEM format
   */
  static loadJwtPublicKey(): string {
    if (this.jwtPublicKey) {
      return this.jwtPublicKey;
    }

    try {
      // Try to load from file first
      if (env.JWT_PUBLIC_KEY_PATH && existsSync(env.JWT_PUBLIC_KEY_PATH)) {
        this.jwtPublicKey = readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8');
        logger.info('JWT public key loaded from file');
        return this.jwtPublicKey;
      }

      // Fall back to environment variable
      if (env.JWT_PUBLIC_KEY) {
        this.jwtPublicKey = env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
        logger.info('JWT public key loaded from environment');
        return this.jwtPublicKey;
      }

      // If neither exists, generate a warning
      logger.warn('JWT public key not found, using symmetric key instead');
      return env.JWT_SECRET;
    } catch (error) {
      logger.error('Failed to load JWT public key', error as Error);
      throw new Error('JWT public key loading failed');
    }
  }

  /**
   * Generate a new RSA key pair for JWT signing
   * Use this to generate keys for production
   * @returns object - Private and public keys in PEM format
   */
  static generateJwtKeyPair(): { privateKey: string; publicKey: string } {
    try {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      logger.info('JWT key pair generated successfully');

      return { privateKey, publicKey };
    } catch (error) {
      logger.error('Failed to generate JWT key pair', error as Error);
      throw new Error('Key pair generation failed');
    }
  }

  /**
   * Rotate JWT keys
   * This should be called periodically to enhance security
   * @returns object - New key pair
   */
  static rotateJwtKeys(): { privateKey: string; publicKey: string } {
    logger.info('Rotating JWT keys');

    // Generate new key pair
    const newKeys = this.generateJwtKeyPair();

    // Clear cached keys
    this.jwtPrivateKey = null;
    this.jwtPublicKey = null;

    // In production, you would:
    // 1. Save new keys to secure storage
    // 2. Update environment variables
    // 3. Gradually invalidate old tokens
    // 4. Update key references in the system

    logger.info('JWT keys rotated successfully');

    return newKeys;
  }

  /**
   * Get key rotation schedule
   * Recommended: Rotate keys every 90 days
   * @returns number - Days until next rotation
   */
  static getKeyRotationSchedule(): number {
    // This would typically check when keys were last rotated
    // For now, return a default value
    return 90; // days
  }

  /**
   * Validate key strength
   * @param key - Key to validate
   * @returns boolean - True if key meets security requirements
   */
  static validateKeyStrength(key: string): boolean {
    try {
      // Check minimum key length
      if (key.length < 256) {
        logger.warn('Key too short', { length: key.length });
        return false;
      }

      // Check if it's a valid PEM format (for RSA keys)
      if (key.includes('BEGIN') && key.includes('END')) {
        const lines = key
          .split('\n')
          .filter((line) => !line.includes('BEGIN') && !line.includes('END'));
        const keyData = lines.join('');

        // RSA 4096 key should be around 3272 characters in base64
        if (keyData.length < 2000) {
          logger.warn('RSA key appears to be less than 2048 bits');
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Failed to validate key strength', error as Error);
      return false;
    }
  }
}
