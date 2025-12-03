import { Session } from '../../../domain/entities/session.entity.js';
import { BaseSerializer } from './base.serializer.js';

/**
 * Session DTO for responses
 */
export interface SessionDTO {
  id: string;
  deviceName: string;
  ipAddress: string;
  location: string | null;
  isTrusted: boolean;
  trustScore: number;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Session serializer for transforming Session entities to DTOs
 */
export class SessionSerializer extends BaseSerializer {
  /**
   * Serialize session to DTO
   */
  static toDTO(session: Session): SessionDTO {
    return {
      id: session.id,
      deviceName: session.deviceName,
      ipAddress: this.extractValue(session.ipAddress) as string,
      location: session.location,
      isTrusted: session.isTrusted,
      trustScore: session.trustScore,
      lastActivityAt: this.formatDate(session.lastActivityAt) as string,
      expiresAt: this.formatDate(session.expiresAt) as string,
      createdAt: this.formatDate(session.createdAt) as string,
    };
  }

  /**
   * Serialize multiple sessions to DTOs
   */
  static toDTOList(sessions: Session[]): SessionDTO[] {
    return sessions.map((session) => this.toDTO(session));
  }
}
