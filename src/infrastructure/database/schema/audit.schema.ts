import { pgTable, uuid, varchar, timestamp, text, jsonb, integer } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  status: varchar('status', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  riskScore: integer('risk_score').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const complianceLogs = pgTable('compliance_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  description: text('description').notNull(),
  complianceStandard: varchar('compliance_standard', { length: 50 }),
  severity: varchar('severity', { length: 20 }).notNull(),
  data: jsonb('data'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ComplianceLog = typeof complianceLogs.$inferSelect;
export type NewComplianceLog = typeof complianceLogs.$inferInsert;
