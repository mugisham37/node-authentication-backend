import { OAuthAccount } from '../../../domain/entities/oauth-account.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * OAuth account DTO for responses
 */
export interface OAuthAccountDTO {
  id: string;
  provider: string;
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * OAuth account serializer for transforming OAuthAccount entities to DTOs
 */
export class OAuthAccountSerializer extends BaseSerializer {
  /**
   * Serialize OAuth account to DTO (excludes sensitive tokens)
   */
  static toDTO(oauthAccount: OAuthAccount): OAuthAccountDTO {
    return {
      id: oauthAccount.id,
      provider: oauthAccount.provider,
      providerAccountId: oauthAccount.providerAccountId,
      createdAt: this.formatDate(oauthAccount.createdAt) as string,
      updatedAt: this.formatDate(oauthAccount.updatedAt) as string,
    };
  }

  /**
   * Serialize multiple OAuth accounts to DTOs
   */
  static toDTOList(oauthAccounts: OAuthAccount[]): OAuthAccountDTO[] {
    return oauthAccounts.map((account) => this.toDTO(account));
  }
}
