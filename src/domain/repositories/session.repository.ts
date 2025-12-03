import { Session } from '../entities/session.entity.js';

/**
 * Pagination options for session queries
 */
export interface SessionPaginationOptions {
  offset: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  userId?: string;
  isActive?: boolean;
}

/**
 * Paginated session result
 */
export interface PaginatedSessions {
  sessions: Session[];
  total: number;
}

/**
 * Repository interface for Session entity operations
 * Requirements: 3.1, 7.1, 7.2, 7.5
 */
export interface ISessionRepository {
  /**
   * Create a new session
   */
  create(session: Session): Promise<Session>;

  /**
   * Find a session by its unique ID
   */
  findById(id: string): Promise<Session | null>;

  /**
   * Find a session by token hash
   */
  findByTokenHash(tokenHash: string): Promise<Session | null>;

  /**
   * Find all sessions for a user
   */
  findByUserId(userId: string): Promise<Session[]>;

  /**
   * Find sessions with pagination and filtering
   * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6
   */
  findPaginated(options: SessionPaginationOptions): Promise<PaginatedSessions>;

  /**
   * Update an existing session
   */
  update(session: Session): Promise<Session>;

  /**
   * Delete a session by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all sessions for a user
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Find all sessions (for cleanup operations)
   * Requirements: 7.5
   */
  findAll(): Promise<Session[]>;
}
