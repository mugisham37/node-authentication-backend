import { User } from '../../domain/entities/user.entity.js';
import { IUserRepository } from '../../domain/repositories/user.repository.interface.js';
import { Password } from '../../domain/value-objects/password.value-object.js';
import { NotFoundError, ValidationError } from '../../shared/errors/types/application-error.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { log } from '../../infrastructure/logging/logger.js';

export interface IUserService {
  getUserById(userId: string): Promise<User>;
  updateProfile(userId: string, data: { name?: string; image?: string }): Promise<User>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  listUsers(params: {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
    email?: string;
    status?: 'active' | 'locked' | 'deleted';
    role?: string;
  }): Promise<{ users: User[]; total: number }>;
  lockAccount(userId: string): Promise<void>;
  unlockAccount(userId: string): Promise<void>;
  getUserWithDetails(userId: string): Promise<User>;
}

/**
 * User service implementation with caching
 * Requirements: 19.5
 */
export class UserService implements IUserService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * Get user by ID with caching
   * Requirement: 19.5
   */
  async getUserById(userId: string): Promise<User> {
    // Try cache first
    const cached = await CacheService.getUserProfile<User>(userId);
    if (cached) {
      // Reconstruct User entity from cached data
      return new User({
        ...cached,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
        emailVerifiedAt: cached.emailVerifiedAt ? new Date(cached.emailVerifiedAt) : null,
        lastLoginAt: cached.lastLoginAt ? new Date(cached.lastLoginAt) : null,
        deletedAt: cached.deletedAt ? new Date(cached.deletedAt) : null,
      });
    }

    // Cache miss - fetch from database
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }

    // Cache the user profile
    await CacheService.setUserProfile(userId, user);

    return user;
  }

  /**
   * Update user profile and invalidate cache
   * Requirement: 19.5
   */
  async updateProfile(userId: string, data: { name?: string; image?: string }): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }

    // Update user data
    if (data.name !== undefined) {
      user.name = data.name;
    }
    if (data.image !== undefined) {
      user.image = data.image;
    }

    user.updatedAt = new Date();

    // Save to database
    const updatedUser = await this.userRepository.update(user);

    // Invalidate cache
    await CacheService.invalidateUserProfile(userId);

    log.info('User profile updated', { userId });

    return updatedUser;
  }

  /**
   * Change user password and invalidate cache
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }

    // Verify current password
    if (user.passwordHash) {
      const currentPasswordObj = new Password(currentPassword);
      const isValid = await currentPasswordObj.verify(user.passwordHash);
      if (!isValid) {
        throw new ValidationError('Current password is incorrect');
      }
    }

    // Hash new password
    const newPasswordObj = new Password(newPassword);
    user.passwordHash = await newPasswordObj.hash();
    user.updatedAt = new Date();

    // Save to database
    await this.userRepository.update(user);

    // Invalidate cache
    await CacheService.invalidateUserProfile(userId);

    log.info('User password changed', { userId });
  }

  /**
   * Delete user account and invalidate cache
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }

    // Soft delete
    user.deletedAt = new Date();
    await this.userRepository.update(user);

    // Invalidate cache
    await CacheService.invalidateUserProfile(userId);
    await CacheService.invalidateUserPermissions(userId);

    log.info('User account deleted', { userId });
  }

  /**
   * List users with pagination and filters
   */
  async listUsers(params: {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
    email?: string;
    status?: 'active' | 'locked' | 'deleted';
    role?: string;
  }): Promise<{ users: User[]; total: number }> {
    // This could be cached for frequently accessed pages
    const cacheKey = `users:list:${params.page}:${params.limit}:${params.sortBy}:${params.sortOrder}:${params.email}:${params.status}:${params.role}`;

    const cached = await CacheService.getFrequentData<{ users: User[]; total: number }>(cacheKey);
    if (cached) {
      return {
        users: cached.users.map(
          (u) =>
            new User({
              ...u,
              createdAt: new Date(u.createdAt),
              updatedAt: new Date(u.updatedAt),
              emailVerifiedAt: u.emailVerifiedAt ? new Date(u.emailVerifiedAt) : null,
              lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
              deletedAt: u.deletedAt ? new Date(u.deletedAt) : null,
            })
        ),
        total: cached.total,
      };
    }

    // Fetch from database (implementation depends on repository)
    // For now, return empty result
    const result = { users: [], total: 0 };

    // Cache the result for 1 minute
    await CacheService.setFrequentData(cacheKey, result, 60);

    return result;
  }

  /**
   * Get user with full details (for admin)
   */
  async getUserWithDetails(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }
    return user;
  }

  /**
   * Lock user account and invalidate cache
   */
  async lockAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }

    user.lockAccount();
    await this.userRepository.update(user);

    // Invalidate cache
    await CacheService.invalidateUserProfile(userId);

    log.info('User account locked', { userId });
  }

  /**
   * Unlock user account and invalidate cache
   */
  async unlockAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', { userId });
    }

    user.unlockAccount();
    await this.userRepository.update(user);

    // Invalidate cache
    await CacheService.invalidateUserProfile(userId);

    log.info('User account unlocked', { userId });
  }
}
