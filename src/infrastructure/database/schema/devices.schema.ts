import { pgTable, uuid, varchar, timestamp, boolean, text, integer } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(),
  deviceName: varchar('device_name', { length: 255 }),
  deviceType: varchar('device_type', { length: 50 }),
  os: varchar('os', { length: 100 }),
  osVersion: varchar('os_version', { length: 50 }),
  browser: varchar('browser', { length: 100 }),
  browserVersion: varchar('browser_version', { length: 50 }),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  isTrusted: boolean('is_trusted').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const deviceFingerprints = pgTable('device_fingerprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.id, { onDelete: 'cascade' }),
  fingerprint: text('fingerprint').notNull(),
  fingerprintType: varchar('fingerprint_type', { length: 50 }).notNull(),
  confidence: integer('confidence').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DeviceFingerprint = typeof deviceFingerprints.$inferSelect;
export type NewDeviceFingerprint = typeof deviceFingerprints.$inferInsert;
