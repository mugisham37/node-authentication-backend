import { eq, and, isNull, like, count, desc, asc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IUserRepository,
  UserPaginationOptions,
  PaginatedUsers,
} from '../../domain/repositories/user.repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { users, type User as UserRow } from '../database/schema/users.schema.js';
import { oauthAccounts } from '../database/schema/oauth.schema.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../shared/errors/types/application-error.js';

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

      const user = result[0];
      if (!user) {
        return null;
      }

      return this.mapToEntity(user);
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

      const user = result[0];
      if (!user) {
        return null;
      }

      return this.mapToEntity(user);
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

      if (result.length === 0 || !result[0]?.user) {
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
      const nameParts = user.name.split(' ');
      const result = await this.db
        .insert(users)
        .values({
          id: user.id,
          email: user.email.toString(),
          passwordHash: user.passwordHash,
          username: null,
          firstName: nameParts[0] || null,
          lastName: nameParts.slice(1).join(' ') || null,
          phoneNumber: null,
          isEmailVerified: user.emailVerified,
          isPhoneVerified: false,
          isActive: !user.isDeleted(),
          isSuspended: user.accountLocked,
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: null,
          failedLoginAttempts: user.failedLoginAttempts.toString(),
          lockoutUntil: user.accountLockedUntil,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        })
        .returning();

      const createdUser = result[0];
      if (!createdUser) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'No result returned from insert',
          operation: 'save',
        });
      }

      return this.mapToEntity(createdUser);
    } catch (error) {
      return this.handleSaveError(error, user.email.toString());
    }
  }

  /**
   * Handle errors during user save operation
   */
  private handleSaveError(error: unknown, email: string): never {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') {
      throw new ConflictError('Email already exists', { email });
    }
    if (err.code === '23503') {
      throw new ConflictError('Invalid reference', {
        originalError: err.message || 'Unknown error',
      });
    }
    throw new ServiceUnavailableError('Database', {
      originalError: err.message || 'Unknown error',
      operation: 'save',
    });
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
          firstName: user.name.split(' ')[0] || null,
          lastName: user.name.split(' ').slice(1).join(' ') || null,
          isEmailVerified: user.emailVerified,
          isActive: !user.isDeleted(),
          isSuspended: user.accountLocked,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts.toString(),
          lockoutUntil: user.accountLockedUntil,
          updatedAt: new Date(),
          deletedAt: user.deletedAt,
        })
        .where(eq(users.id, user.id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('User');
      }

      const updatedUser = result[0];
      if (!updatedUser) {
        throw new ServiceUnavailableError('Database', {
          originalError: 'No result returned from update',
          operation: 'update',
        });
      }

      return this.mapToEntity(updatedUser);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      const err = error as { code?: string; message?: string };
      // Handle unique constraint violation
      if (err.code === '23505') {
        throw new ConflictError('Email already exists', {
          email: user.email.toString(),
        });
      }

      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
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
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      const err = error as { message?: string };
      throw new ServiceUnavailableError('Database', {
        originalError: err.message || 'Unknown error',
        operation: 'delete',
      });
    }
  }

  /**
   * Find users with pagination and filtering
   * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6
   */
  async findPaginated(options: UserPaginationOptions): Promise<PaginatedUsers> {
    try {
      // Build where conditions
      const conditions = [];

      // Filter by email
      if (options.email) {
        conditions.push(like(users.email, `%${options.email}%`));
      }

      // Filter by status
      if (options.status === 'active') {
        conditions.push(isNull(users.deletedAt));
        conditions.push(eq(users.isSuspended, false));
      } else if (options.status === 'locked') {
        conditions.push(isNull(users.deletedAt));
        conditions.push(eq(users.isSuspended, true));
      } else if (options.status === 'deleted') {
        conditions.push(sql`${users.deletedAt} IS NOT NULL`);
      } else {
        // Default: only active users
        conditions.push(isNull(users.deletedAt));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const countResult = await this.db.select({ count: count() }).from(users).where(whereClause);

      const total = countResult[0]?.count ?? 0;

      // Get paginated results
      const sortColumn = options.sortBy === 'email' ? users.email : users.createdAt;
      const sortDirection = options.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      const result = await this.db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(sortDirection)
        .limit(options.limit)
        .offset(options.offset);

      const userEntities = result.map((row) => this.mapToEntity(row));

      return {
        users: userEntities,
        total: Number(total),
      };
    } catch (error) {
      throw new ServiceUnavailableError('Database', {
        originalError: (error as Error).message,
        operation: 'findPaginated',
      });
    }
  }

  /**
   * Maps database row to User entity
   * Maps database schema fields to entity fields
   */
  private mapToEntity(row: UserRow): User {
    // Map database fields to entity fields
    const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown User';
    const failedAttempts = parseInt(row.failedLoginAttempts || '0', 10);

    return new User({
      id: row.id,
      email: new Email(row.email),
      passwordHash: row.passwordHash,
      name: fullName,
      image: null, // Not in current schema
      emailVerified: row.isEmailVerified,
      emailVerifiedAt: null, // Not in current schema
      mfaEnabled: false, // Not in current schema
      mfaSecret: null, // Not in current schema
      mfaBackupCodes: null, // Not in current schema
      accountLocked: row.isSuspended,
      accountLockedUntil: row.lockoutUntil,
      failedLoginAttempts: failedAttempts,
      lastFailedLoginAt: null, // Not in current schema
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
