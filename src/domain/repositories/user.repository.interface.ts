import { User } from '../entities/user.entity.js';

/**
 * Pagination options for user queries
 */
export interface UserPaginationOptions {
  offset: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  email?: string;
  status?: 'active' | 'locked' | 'deleted';
  role?: string;
}

/**
 * Paginated user result
 */
export interface PaginatedUsers {
  users: User[];
  total: number;
}

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
   * Find users with pagination and filtering
   * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6
   */
  findPaginated(options: UserPaginationOptions): Promise<PaginatedUsers>;

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

  /**
   * Find all users (for admin operations)
   */
  findAll(): Promise<User[]>;
}
