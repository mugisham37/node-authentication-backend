import { User } from '../entities/user.entity.js';

/**
 * Repository interface for User entity operations
 * Requirements: 1.1, 1.2, 3.1, 9.4, 9.5
 */
export interface IUserRepository {
  /**
   * Find a user by their unique ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find a user by their email address
   * Uses index optimization for performance
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find a user by OAuth provider and provider account ID
   */
  findByOAuthProvider(provider: string, providerId: string): Promise<User | null>;

  /**
   * Save a new user to the database
   * Throws ConflictError if email already exists
   */
  save(user: User): Promise<User>;

  /**
   * Update an existing user
   */
  update(user: User): Promise<User>;

  /**
   * Delete a user by ID (soft delete)
   */
  delete(id: string): Promise<void>;
}
