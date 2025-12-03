import { hash, verify } from '@node-rs/argon2';
import { logger } from '../../logging/logger.js';

/**
 * Argon2 Password Hashing Service
 * Centralized password hashing using Argon2id algorithm
 * Requirements: 1.4, 1.7, 19.1
 */
export class Argon2Service {
  /**
   * Argon2id configuration optimized for security and performance
   * Based on OWASP recommendations for 2024
   */
  private static readonly CONFIG = {
    memoryCost: 65536, // 64 MB
    timeCost: 3, // 3 iterations
    outputLen: 32, // 32 bytes (256 bits)
    parallelism: 4, // 4 threads
  };

  /**
   * Hash a password using Argon2id
   * @param password - Plain text password to hash
   * @returns Promise<string> - Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const hashed = await hash(password, this.CONFIG);
      logger.debug('Password hashed successfully');
      return hashed;
    } catch (error) {
      logger.error('Failed to hash password', error as Error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against a hash
   * @param hash - Stored password hash
   * @param password - Plain text password to verify
   * @returns Promise<boolean> - True if password matches
   */
  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      const isValid = await verify(hash, password);
      logger.debug('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Failed to verify password', error as Error);
      return false;
    }
  }

  /**
   * Check if a hash needs rehashing (e.g., after config changes)
   * @param hash - Stored password hash
   * @returns boolean - True if rehashing is needed
   */
  static needsRehash(hash: string): boolean {
    // Argon2 hashes contain the parameters used
    // Format: $argon2id$v=19$m=65536,t=3,p=4$...
    try {
      const params = hash.split('$')[3];
      if (!params) return true;

      const paramMap = new Map(
        params.split(',').map((p) => {
          const [key, value] = p.split('=');
          return [key, parseInt(value, 10)];
        })
      );

      return (
        paramMap.get('m') !== this.CONFIG.memoryCost ||
        paramMap.get('t') !== this.CONFIG.timeCost ||
        paramMap.get('p') !== this.CONFIG.parallelism
      );
    } catch {
      return true;
    }
  }
}
