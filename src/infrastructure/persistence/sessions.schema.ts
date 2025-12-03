import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  text,
  inet,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }).notNull(),
  deviceName: varchar('device_name', { length: 255 }),
  ipAddress: inet('ip_address').notNull(),
  userAgent: text('user_agent'),
  location: varchar('location', { length: 255 }),
  isTrusted: boolean('is_trusted').default(false).notNull(),
  trustScore: integer('trust_score').default(0).notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
