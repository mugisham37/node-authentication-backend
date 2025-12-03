-- Performance optimization indexes
-- Requirements: 19.1, 19.2

-- Users table indexes
-- Optimize email lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE deleted_at IS NULL;

-- Optimize email verification status queries
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified, email) WHERE deleted_at IS NULL;

-- Optimize account locked queries
CREATE INDEX IF NOT EXISTS idx_users_account_locked ON users(account_locked) WHERE deleted_at IS NULL AND account_locked = true;

-- Optimize MFA enabled queries
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled) WHERE deleted_at IS NULL;

-- Optimize last login queries for analytics
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC) WHERE deleted_at IS NULL;

-- Optimize created_at for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC) WHERE deleted_at IS NULL;

-- Sessions table indexes
-- Optimize session lookup by user (most common query)
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, last_activity_at DESC) WHERE revoked_at IS NULL;

-- Optimize token hash lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash_active ON sessions(token_hash) WHERE revoked_at IS NULL;

-- Optimize expired session cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) WHERE revoked_at IS NULL;

-- Optimize device fingerprint queries
CREATE INDEX IF NOT EXISTS idx_sessions_device_fingerprint ON sessions(device_fingerprint, user_id) WHERE revoked_at IS NULL;

-- Optimize trust score queries
CREATE INDEX IF NOT EXISTS idx_sessions_trust_score ON sessions(trust_score) WHERE revoked_at IS NULL;

-- Roles and Permissions indexes
-- Optimize role name lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Optimize system role queries
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON roles(is_system) WHERE is_system = true;

-- Optimize permission resource/action lookups
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);

-- Optimize user role lookups (authorization)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Composite index for efficient permission checks
CREATE INDEX IF NOT EXISTS idx_user_roles_composite ON user_roles(user_id, role_id);

-- Optimize role permission lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Composite index for efficient permission resolution
CREATE INDEX IF NOT EXISTS idx_role_permissions_composite ON role_permissions(role_id, permission_id);

-- Audit logs indexes
-- Optimize user audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);

-- Optimize action queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- Optimize risk score queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_score ON audit_logs(risk_score DESC) WHERE risk_score > 70;

-- Optimize date range queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Optimize resource queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id, created_at DESC);

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON audit_logs USING GIN(metadata);

-- OAuth accounts indexes
-- Optimize user OAuth account lookups
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

-- Optimize provider lookups
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider, provider_account_id);

-- Devices table indexes
-- Optimize user device lookups
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id, last_seen_at DESC);

-- Optimize fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(fingerprint);

-- Optimize trusted device queries
CREATE INDEX IF NOT EXISTS idx_devices_trusted ON devices(is_trusted, user_id) WHERE is_trusted = true;

-- Optimize unused device cleanup
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at) WHERE last_seen_at < NOW() - INTERVAL '90 days';

-- Webhooks indexes
-- Optimize user webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_user_active ON webhooks(user_id) WHERE is_active = true;

-- Optimize webhook delivery lookups
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id, created_at DESC);

-- Optimize pending delivery queries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(status, next_retry_at) WHERE status = 'pending';

-- Optimize failed delivery queries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed ON webhook_deliveries(status, attempt_count) WHERE status = 'failed';

-- Token tables indexes
-- Password reset tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);

-- Email verification tokens
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash) WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at) WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id, created_at DESC);

-- Add comments for documentation
COMMENT ON INDEX idx_users_email_active IS 'Optimize email lookups for active users';
COMMENT ON INDEX idx_sessions_user_active IS 'Optimize session lookups by user with activity sorting';
COMMENT ON INDEX idx_user_roles_composite IS 'Optimize permission checks with composite index';
COMMENT ON INDEX idx_audit_logs_metadata_gin IS 'Enable efficient JSONB queries on audit log metadata';
