import { Session } from '../entities/session.entity.js';

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
}
