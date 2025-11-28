import { Email } from '../value-objects/email.value-object.js';
import { Password } from '../value-objects/password.value-object.js';

/**
 * User entity representing a system user with authentication and authorization.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 2.1, 3.1, 3.6, 4.1, 4.5
 */
export class User {
  id: string;
  email: Email;
  passwordHash: string | null;
  name: string;
  image: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaBackupCodes: string[] | null;
  accountLocked: boolean;
  accountLockedUntil: Date | null;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: {
    id: string;
    email: Email;
    passwordHash: string | null;
    name: string;
    image?: string | null;
    emailVerified?: boolean;
    emailVerifiedAt?: Date | null;
    mfaEnabled?: boolean;
    mfaSecret?: string | null;
    mfaBackupCodes?: string[] | null;
    accountLocked?: boolean;
    failedLoginAttempts?: number;
    lastLoginAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.name = props.name;
    this.image = props.image ?? null;
    this.emailVerified = props.emailVerified ?? false;
    this.emailVerifiedAt = props.emailVerifiedAt ?? null;
    this.mfaEnabled = props.mfaEnabled ?? false;
    this.mfaSecret = props.mfaSecret ?? null;
    this.mfaBackupCodes = props.mfaBackupCodes ?? null;
    this.accountLocked = props.accountLocked ?? false;
    this.failedLoginAttempts = props.failedLoginAttempts ?? 0;
    this.lastLoginAt = props.lastLoginAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Verifies a password against the stored hash
   * Uses constant-time comparison to prevent timing attacks
   * Requirement: 3.5
   */
  async verifyPassword(password: Password): Promise<boolean> {
    if (!this.passwordHash) {
      return false;
    }
    return password.verify(this.passwordHash);
  }

  /**
   * Locks the user account
   * Requirement: 3.3, 3.6
   */
  lockAccount(): void {
    this.accountLocked = true;
    this.updatedAt = new Date();
  }

  /**
   * Unlocks the user account
   */
  unlockAccount(): void {
    this.accountLocked = false;
    this.failedLoginAttempts = 0;
    this.updatedAt = new Date();
  }

  /**
   * Increments failed login attempts and locks account if threshold reached
   * Requirement: 3.6 - Lock account after 5 failed attempts
   */
  incrementFailedAttempts(): void {
    this.failedLoginAttempts++;
    this.updatedAt = new Date();

    if (this.failedLoginAttempts >= 5) {
      this.lockAccount();
    }
  }

  /**
   * Resets failed login attempts counter
   */
  resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.updatedAt = new Date();
  }

  /**
   * Enables MFA for the user
   * Requirement: 4.1, 4.3, 4.4
   */
  enableMFA(secret: string, backupCodes: string[]): void {
    this.mfaEnabled = true;
    this.mfaSecret = secret;
    this.mfaBackupCodes = backupCodes;
    this.updatedAt = new Date();
  }

  /**
   * Disables MFA for the user
   * Requirement: 4.5
   */
  disableMFA(): void {
    this.mfaEnabled = false;
    this.mfaSecret = null;
    this.mfaBackupCodes = null;
    this.updatedAt = new Date();
  }

  /**
   * Verifies an MFA code against the stored secret
   * Note: Actual TOTP (Time-based One-Time Password) verification should be done by MFA service
   * Requirement: 5.1, 5.2
   */
  hasMFAEnabled(): boolean {
    return this.mfaEnabled && this.mfaSecret !== null;
  }

  /**
   * Marks a backup code as used
   * Requirement: 5.4
   */
  useBackupCode(code: string): boolean {
    if (!this.mfaBackupCodes) {
      return false;
    }

    const index = this.mfaBackupCodes.indexOf(code);
    if (index === -1) {
      return false;
    }

    this.mfaBackupCodes.splice(index, 1);
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Updates the last login timestamp
   * Requirement: 3.1
   */
  updateLastLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Verifies the user's email
   * Requirement: 2.1, 2.4
   */
  verifyEmail(): void {
    this.emailVerified = true;
    this.emailVerifiedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Updates the user's password hash
   * Requirement: 10.2
   */
  updatePassword(passwordHash: string): void {
    this.passwordHash = passwordHash;
    this.updatedAt = new Date();
  }

  /**
   * Soft deletes the user
   */
  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Checks if the user is deleted
   */
  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
