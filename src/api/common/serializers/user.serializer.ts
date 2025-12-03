import { User } from '../../../domain/entities/user.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * User DTO for public responses
 */
export interface UserPublicDTO {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

/**
 * User DTO for admin responses (includes additional fields)
 */
export interface UserAdminDTO extends UserPublicDTO {
  accountLocked: boolean;
  failedLoginAttempts: number;
  lastLoginAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * User DTO for profile responses
 */
export interface UserProfileDTO {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * User serializer for transforming User entities to DTOs
 */
export class UserSerializer extends BaseSerializer {
  /**
   * Serialize user for public responses (excludes sensitive fields)
   */
  static toPublic(user: User): UserPublicDTO {
    return {
      id: user.id,
      email: this.extractValue(user.email) as string,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      createdAt: this.formatDate(user.createdAt) as string,
    };
  }

  /**
   * Serialize user for admin responses (includes additional fields)
   */
  static toAdmin(user: User): UserAdminDTO {
    return {
      ...this.toPublic(user),
      accountLocked: user.accountLocked,
      failedLoginAttempts: user.failedLoginAttempts,
      lastLoginAt: this.formatDate(user.lastLoginAt),
      updatedAt: this.formatDate(user.updatedAt) as string,
      deletedAt: this.formatDate(user.deletedAt),
    };
  }

  /**
   * Serialize user for profile responses
   */
  static toProfile(user: User): UserProfileDTO {
    return {
      id: user.id,
      email: this.extractValue(user.email) as string,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      emailVerifiedAt: this.formatDate(user.emailVerifiedAt),
      mfaEnabled: user.mfaEnabled,
      createdAt: this.formatDate(user.createdAt) as string,
      updatedAt: this.formatDate(user.updatedAt) as string,
    };
  }

  /**
   * Serialize multiple users for public responses
   */
  static toPublicList(users: User[]): UserPublicDTO[] {
    return users.map((user) => this.toPublic(user));
  }

  /**
   * Serialize multiple users for admin responses
   */
  static toAdminList(users: User[]): UserAdminDTO[] {
    return users.map((user) => this.toAdmin(user));
  }
}
