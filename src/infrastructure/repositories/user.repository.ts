import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IUserRepository } from '../../domain/repositories/user.repository.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { users } from '../../core/database/schema/users.schema.js';
import { oauthAccounts } from '../../core/database/schema/oauth.schema.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../core/errors/types/application-error.js';

/**
 * User Repository Implementation using Drizzle ORM
 * Requirements: 1.1, 1.2, 3.1, 9.4, 9.5
 */
export class UserRepository implements IUserRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Find a user by their unique ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findById',
      });
    }
  }

  /**
   * Find a user by their email address
   * Uses index optimization for performance
   * Requirement: 1.2
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const normalizedEmail = email.toLowerCase();
      const result = await this.db
        .select()
        .from(users)
        .where(and(eq(users.email, normalizedEmail), isNull(users.deletedAt)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByEmail',
      });
    }
  }

  /**
   * Find a user by OAuth provider and provider account ID
   * Requirement: 9.4, 9.5
   */
  async findByOAuthProvider(provider: string, providerId: string): Promise<User | null> {
    try {
      const result = await this.db
        .select({
          user: users,
        })
        .from(users)
        .innerJoin(oauthAccounts, eq(oauthAccounts.userId, users.id))
        .where(
          and(
            eq(oauthAccounts.provider, provider),
            eq(oauthAccounts.providerAccountId, providerId),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0].user);
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findByOAuthProvider',
      });
    }
  }

  /**
   * Save a new user to the database
   * Throws ConflictError if email already exists
   * Requirement: 1.1, 1.2
   */
  async save(user: User): Promise<User> {
    try {
      const result = await this.db
        .insert(users)
        .values({
          id: user.id,
          email: user.email.toString(),
          passwordHash: user.passwordHash,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          mfaEnabled: user.mfaEnabled,
          mfaSecret: user.mfaSecret,
          mfaBackupCodes: user.mfaBackupCodes,
          accountLocked: user.accountLocked,
          failedLoginAttempts: user.failedLoginAttempts,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        })
        .returning();

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      // Handle unique constraint violation (duplicate email)
      if (error.code === '23505') {
        throw new ConflictError('Email already exists', {
          email: user.email.toString(),
        });
      }

      // Handle foreign key violation
      if (error.code === '23503') {
        throw new ConflictError('Invalid reference', {
          originalError: error.message,
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'save',
      });
    }
  }

  /**
   * Update an existing user
   */
  async update(user: User): Promise<User> {
    try {
      const result = await this.db
        .update(users)
        .set({
          email: user.email.toString(),
          passwordHash: user.passwordHash,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          mfaEnabled: user.mfaEnabled,
          mfaSecret: user.mfaSecret,
          mfaBackupCodes: user.mfaBackupCodes,
          accountLocked: user.accountLocked,
          failedLoginAttempts: user.failedLoginAttempts,
          lastLoginAt: user.lastLoginAt,
          updatedAt: new Date(),
          deletedAt: user.deletedAt,
        })
        .where(eq(users.id, user.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('User');
      }

      return this.mapToEntity(result[0]);
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictError('Email already exists', {
          email: user.email.toString(),
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'update',
      });
    }
  }

  /**
   * Delete a user by ID (soft delete)
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db
        .update(users)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('User');
      }
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ServiceUnavailableError('Database', {
        originalError: error.message,
        operation: 'delete',
      });
    }
  }

  /**
   * Maps database row to User entity
   */
  private mapToEntity(row: any): User {
    return new User({
      id: row.id,
      email: new Email(row.email),
      passwordHash: row.passwordHash,
      name: row.name,
      image: row.image,
      emailVerified: row.emailVerified,
      emailVerifiedAt: row.emailVerifiedAt,
      mfaEnabled: row.mfaEnabled,
      mfaSecret: row.mfaSecret,
      mfaBackupCodes: row.mfaBackupCodes,
      accountLocked: row.accountLocked,
      accountLockedUntil: row.accountLockedUntil,
      failedLoginAttempts: row.failedLoginAttempts,
      lastFailedLoginAt: row.lastFailedLoginAt,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
