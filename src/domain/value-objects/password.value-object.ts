import { ValidationError } from '../../shared/errors/types/application-error.js';
import { Argon2Service } from '../../infrastructure/security/hashing/argon2.service.js';

/**
 * Password value object with complexity validation and Argon2id hashing.
 * Uses centralized Argon2Service for consistent hashing across the application.
 * Requirements: 1.3, 1.4, 1.7
 */
export class Password {
  private readonly value: string;

  constructor(password: string) {
    if (!this.meetsComplexityRequirements(password)) {
      throw new ValidationError(
        'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character'
      );
    }
    this.value = password;
  }

  /**
   * Validates password complexity requirements
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  private meetsComplexityRequirements(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  /**
   * Hashes the password using centralized Argon2Service
   * Configuration per Requirement 1.7:
   * - Algorithm: Argon2id
   * - Time cost: 3
   * - Memory cost: 65536 KB (64 MB)
   * - Parallelism: 4
   */
  async hash(): Promise<string> {
    return await Argon2Service.hashPassword(this.value);
  }

  /**
   * Verifies a password against a hash using constant-time comparison
   */
  async verify(passwordHash: string): Promise<boolean> {
    return await Argon2Service.verifyPassword(passwordHash, this.value);
  }

  /**
   * Returns the raw password value (use with caution)
   */
  getValue(): string {
    return this.value;
  }
}
