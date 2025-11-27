# Enterprise Authentication System - Design Document

## Overview

The Enterprise Authentication System is a production-grade, horizontally scalable authentication and authorization backend built on Node.js, TypeScript, Fastify, PostgreSQL, and Redis. The system implements clean architecture principles with clear separation between domain logic, application services, infrastructure concerns, and presentation layers.

The architecture supports millions of concurrent users with sub-200ms response times through intelligent caching, connection pooling, and optimized database queries. Security is paramount with defense-in-depth strategies including Argon2id password hashing, RS256 JWT tokens, comprehensive rate limiting, device fingerprinting, risk-based authentication, and real-time fraud detection.

The system provides multiple authentication methods (credentials, MFA, passwordless, OAuth, social), sophisticated authorization (RBAC, ABAC), complete audit trails, webhook notifications, real-time WebSocket updates, and comprehensive monitoring through Prometheus metrics and structured logging.

## Architecture

### Clean Architecture Layers

The system follows clean architecture with four distinct layers ensuring testability, maintainability, and independence from frameworks:

**Domain Layer** - Contains pure business logic with zero external dependencies. Includes entities (User, Role, Permission, Session, OAuthAccount, AuditLog, Device, Webhook), value objects (Email, Password, PhoneNumber, IPAddress, DeviceFingerprint), and domain events (UserRegistered, UserLoggedIn, PasswordChanged, RoleAssigned, MFAEnabled, SessionCreated). All business rules and invariants live here.

**Application Layer** - Orchestrates use cases and coordinates domain entities. Includes use cases (RegisterUser, LoginUser, VerifyEmail, EnableMFA, RefreshToken, AssignRole, CreateWebhook), application services (AuthenticationService, AuthorizationService, TokenService, UserManagementService, MFAService, RiskAssessmentService), and repository interfaces defining contracts without implementation details.

**Infrastructure Layer** - Implements technical concerns and external integrations. Includes repository implementations using Drizzle ORM and Prisma, Redis client for caching and sessions, email service with Nodemailer, SMS service with Twilio, OAuth integrations, webhook delivery with BullMQ, monitoring with Prometheus, and logging with Winston.

**Presentation Layer** - Handles HTTP communication through Fastify. Includes route handlers, request validation middleware using Zod, authentication middleware verifying JWT tokens, authorization middleware checking permissions, rate limiting middleware, error handling middleware, and WebSocket handlers for real-time updates.

### Technology Stack

**Runtime & Framework:**
- Node.js 20 LTS - Runtime with excellent async performance
- TypeScript 5+ - Static typing for reliability and developer experience
- Fastify 4+ - High-performance HTTP framework (2-3x faster than Express)

**Database & ORM:**
- PostgreSQL 16+ - Primary relational database with ACID guarantees
- Drizzle ORM - Type-safe, zero-overhead ORM for performance-critical operations
- Prisma - Alternative ORM for complex queries with excellent DX

**Caching & Sessions:**
- Redis 7+ - In-memory store for caching, sessions, and rate limiting
- ioredis - Redis client with cluster support and automatic reconnection

**Authentication & Security:**
- jsonwebtoken - JWT creation and verification with RS256
- @node-rs/argon2 - Fast Argon2id password hashing
- speakeasy - TOTP generation and validation for MFA
- helmet - Security headers middleware
- @fastify/cors - CORS configuration
- @fastify/rate-limit - Rate limiting with Redis backend

**OAuth & Social Auth:**
- passport - Pluggable authentication strategies
- passport-google-oauth20 - Google OAuth integration
- passport-github2 - GitHub OAuth integration
- passport-jwt - JWT strategy for token verification

**Background Jobs:**
- bullmq - Redis-backed job queue for async operations
- Email sending, webhook delivery, audit logging

**Testing:**
- vitest - Fast, modern testing framework
- supertest - HTTP endpoint testing
- testcontainers - Real PostgreSQL and Redis for integration tests

**Monitoring & Logging:**
- prom-client - Prometheus metrics
- winston - Structured logging with JSON format
- @opentelemetry/api - Distributed tracing

**Validation:**
- zod - Schema validation for requests and configuration

**WebSocket:**
- @fastify/websocket - WebSocket support for real-time updates


## Components and Interfaces

### Domain Entities

**User Entity**
```typescript
class User {
  id: string; // UUID
  email: Email; // Value object
  passwordHash: string | null; // Null for passwordless accounts
  name: string;
  image: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null; // Encrypted
  mfaBackupCodes: string[] | null; // Encrypted
  accountLocked: boolean;
  failedLoginAttempts: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null; // Soft delete
  
  // Business methods
  verifyPassword(password: Password): Promise<boolean>;
  lockAccount(): void;
  unlockAccount(): void;
  incrementFailedAttempts(): void;
  resetFailedAttempts(): void;
  enableMFA(secret: string, backupCodes: string[]): void;
  disableMFA(): void;
  verifyMFACode(code: string): boolean;
  updateLastLogin(): void;
}
```

**Session Entity**
```typescript
class Session {
  id: string; // UUID
  userId: string;
  tokenHash: string; // SHA-256 hash of refresh token
  deviceFingerprint: DeviceFingerprint;
  deviceName: string;
  ipAddress: IPAddress;
  userAgent: string;
  location: string | null;
  isTrusted: boolean;
  trustScore: number; // 0-100
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  
  // Business methods
  isExpired(): boolean;
  isRevoked(): boolean;
  updateActivity(): void;
  revoke(): void;
  calculateTrustScore(previousSessions: Session[]): number;
}
```

**Role Entity**
```typescript
class Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean; // Prevents deletion
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  
  // Business methods
  addPermission(permission: Permission): void;
  removePermission(permissionId: string): void;
  hasPermission(resource: string, action: string): boolean;
}
```

**Permission Entity**
```typescript
class Permission {
  id: string;
  resource: string; // e.g., "users", "roles", "webhooks"
  action: string; // e.g., "read", "write", "delete"
  description: string;
  createdAt: Date;
  
  // Business methods
  matches(resource: string, action: string): boolean;
}
```

### Value Objects

**Email Value Object**
```typescript
class Email {
  private readonly value: string;
  
  constructor(email: string) {
    if (!this.isValid(email)) {
      throw new ValidationError('Invalid email format');
    }
    this.value = email.toLowerCase();
  }
  
  private isValid(email: string): boolean {
    // RFC 5322 compliant validation
  }
  
  toString(): string {
    return this.value;
  }
}
```

**Password Value Object**
```typescript
class Password {
  private readonly value: string;
  
  constructor(password: string) {
    if (!this.meetsComplexityRequirements(password)) {
      throw new ValidationError('Password does not meet complexity requirements');
    }
    this.value = password;
  }
  
  async hash(): Promise<string> {
    return argon2.hash(this.value, {
      type: argon2.argon2id,
      timeCost: 2,
      memoryCost: 65536,
      parallelism: 1,
    });
  }
  
  async verify(hash: string): Promise<boolean> {
    return argon2.verify(hash, this.value);
  }
  
  private meetsComplexityRequirements(password: string): boolean {
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^A-Za-z0-9]/.test(password);
  }
}
```

### Application Services

**AuthenticationService Interface**
```typescript
interface IAuthenticationService {
  register(input: RegisterInput): Promise<RegisterOutput>;
  login(input: LoginInput): Promise<LoginOutput>;
  loginWithMFA(input: MFALoginInput): Promise<LoginOutput>;
  loginWithMagicLink(token: string): Promise<LoginOutput>;
  loginWithOAuth(provider: string, code: string): Promise<LoginOutput>;
  logout(sessionId: string): Promise<void>;
  refreshTokens(refreshToken: string): Promise<RefreshOutput>;
  verifyEmail(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}
```

**TokenService Interface**
```typescript
interface ITokenService {
  generateAccessToken(user: User): string;
  generateRefreshToken(): string;
  verifyAccessToken(token: string): TokenPayload;
  hashRefreshToken(token: string): string;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  isRefreshTokenRevoked(tokenHash: string): Promise<boolean>;
}
```

**AuthorizationService Interface**
```typescript
interface IAuthorizationService {
  checkPermission(userId: string, resource: string, action: string): Promise<boolean>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  assignRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
}
```

### Repository Interfaces

**IUserRepository**
```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  findByOAuthProvider(provider: string, providerId: string): Promise<User | null>;
}
```

**ISessionRepository**
```typescript
interface ISessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  update(session: Session): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
```


## Data Models

### Database Schema

**users table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  image VARCHAR(500),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT, -- Encrypted
  mfa_backup_codes JSONB, -- Encrypted array
  account_locked BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email_verified ON users(email, email_verified) WHERE deleted_at IS NULL;
```

**roles table**
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_name ON roles(name);
```

**permissions table**
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
```

**user_roles table**
```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

**role_permissions table**
```sql
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
```

**sessions table**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  ip_address INET NOT NULL,
  user_agent TEXT,
  location VARCHAR(255),
  is_trusted BOOLEAN DEFAULT FALSE,
  trust_score INTEGER DEFAULT 0,
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE revoked_at IS NULL;
```

**oauth_accounts table**
```sql
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  token_expires_at TIMESTAMP,
  scope TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_account_id);
```

**audit_logs table**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id UUID,
  status VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  risk_score INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN(metadata);
```

**password_reset_tokens table**
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  ip_address INET,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash) WHERE used_at IS NULL;
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at) WHERE used_at IS NULL;
```

**email_verification_tokens table**
```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash) WHERE verified_at IS NULL;
```

**webhooks table**
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events JSONB NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user_id ON webhooks(user_id) WHERE is_active = TRUE;
```

**webhook_deliveries table**
```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL,
  http_status_code INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at) WHERE status = 'pending';
```

**devices table**
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  type VARCHAR(50),
  is_trusted BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_fingerprint ON devices(fingerprint);
```

### Redis Data Structures

**Session Storage**
- Key: `session:token:{tokenHash}`
- Value: JSON serialized session data
- TTL: 7 days (refresh token expiration)

**User Permissions Cache**
- Key: `user:permissions:{userId}`
- Value: JSON array of permissions
- TTL: 5 minutes

**Rate Limit Counters**
- Key: `rate_limit:{endpoint}:{identifier}`
- Value: Counter
- TTL: Based on rate limit window

**Revoked Token Families**
- Key: `revoked:family:{familyId}`
- Value: Timestamp of revocation
- TTL: 7 days

**MFA Challenges**
- Key: `mfa:challenge:{challengeId}`
- Value: JSON with userId and timestamp
- TTL: 5 minutes

**Magic Link Tokens**
- Key: `magic:token:{tokenHash}`
- Value: JSON with userId and email
- TTL: 15 minutes


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Registration & Email Verification Properties

**Property 1: Valid registration creates hashed account**
*For any* valid email and password meeting complexity requirements, registration should create a user account with Argon2id hashed password
**Validates: Requirements 1.1**

**Property 2: Duplicate email rejection**
*For any* email already registered in the system, attempting to register again should reject with conflict error
**Validates: Requirements 1.2**

**Property 3: Password length validation**
*For any* password shorter than 8 characters, registration should reject with validation error
**Validates: Requirements 1.3**

**Property 4: Password complexity validation**
*For any* password missing uppercase, lowercase, number, or special character, registration should reject with validation error
**Validates: Requirements 1.4**

**Property 5: Email verification token generation**
*For any* successful registration, an email verification token should be generated and verification email sent
**Validates: Requirements 1.6**

**Property 6: Valid token verifies email**
*For any* valid verification token, clicking the link should mark the user's email as verified with timestamp
**Validates: Requirements 2.1, 2.4**

**Property 7: Token regeneration invalidates previous**
*For any* user requesting new verification email, previous tokens should be invalidated and new token generated
**Validates: Requirements 2.5**

### Authentication Properties

**Property 8: Valid credentials create session**
*For any* valid email and password combination, login should create session and return access token and refresh token
**Validates: Requirements 3.1**

**Property 9: Invalid credentials rejection**
*For any* invalid email or password, login should reject with authentication error
**Validates: Requirements 3.2**

**Property 10: Locked account rejection**
*For any* account with locked status, login attempt should reject with account locked error
**Validates: Requirements 3.3**

**Property 11: MFA-enabled returns challenge**
*For any* user with MFA enabled, valid credential login should return MFA challenge identifier without creating session
**Validates: Requirements 3.4**

**Property 12: Failed login lockout**
*For any* user with 5 failed login attempts within 15 minutes, the account should be temporarily locked
**Validates: Requirements 3.6**

**Property 13: Session metadata recording**
*For any* session creation, device fingerprint, IP address, user agent, and location should be recorded
**Validates: Requirements 3.7**

### Multi-Factor Authentication Properties

**Property 14: TOTP MFA setup generates secret**
*For any* TOTP MFA enablement, a secret key and QR code should be generated
**Validates: Requirements 4.1**

**Property 15: SMS MFA sends verification**
*For any* valid phone number during SMS MFA setup, verification code should be sent
**Validates: Requirements 4.2**

**Property 16: MFA verification activates**
*For any* correct MFA verification code, MFA should be activated for the account
**Validates: Requirements 4.3**

**Property 17: Backup codes generation**
*For any* MFA verification, exactly 10 backup codes should be generated
**Validates: Requirements 4.4**

**Property 18: MFA disable requires recent auth**
*For any* MFA disable attempt, authentication within last 15 minutes should be required
**Validates: Requirements 4.5**

**Property 19: MFA disable requires code**
*For any* MFA disable attempt, valid MFA code or backup code should be required
**Validates: Requirements 4.6**

**Property 20: Valid MFA code creates session**
*For any* valid MFA code with challenge identifier, session should be created and tokens returned
**Validates: Requirements 5.1**

**Property 21: Invalid MFA code rejection**
*For any* invalid MFA code, request should be rejected with authentication error
**Validates: Requirements 5.2**

**Property 22: Backup code creates session and marks used**
*For any* valid backup code, session should be created and the backup code marked as used
**Validates: Requirements 5.4**

**Property 23: TOTP time window acceptance**
*For any* TOTP code within 30-second time window (accounting for clock skew), code should be accepted
**Validates: Requirements 5.5**

### Token Management Properties

**Property 24: Valid refresh generates access token**
*For any* valid refresh token, new access token should be generated and returned
**Validates: Requirements 6.1**

**Property 25: Invalid refresh token rejection**
*For any* invalid, expired, or revoked refresh token, request should be rejected with authentication error
**Validates: Requirements 6.2, 6.3**

**Property 26: Access token expiration**
*For any* generated access token, expiration should be set to 15 minutes from creation
**Validates: Requirements 6.4**

**Property 27: Refresh token expiration**
*For any* generated refresh token, expiration should be set to 7 days from creation
**Validates: Requirements 6.5**

**Property 28: Token rotation on refresh**
*For any* token refresh operation, old refresh token should be invalidated and new refresh token created
**Validates: Requirements 6.6**

**Property 29: Token reuse revokes family**
*For any* detected refresh token reuse, entire token family should be revoked and all sessions terminated
**Validates: Requirements 6.7**

### Session Management Properties

**Property 30: Session list returns active sessions**
*For any* session list request, all active sessions with device name, IP, location, and last activity should be returned
**Validates: Requirements 7.1**

**Property 31: Session revocation terminates**
*For any* session revocation, that session should be terminated and associated tokens invalidated
**Validates: Requirements 7.2**

**Property 32: Logout terminates session**
*For any* logout operation, current session should be terminated and refresh token revoked
**Validates: Requirements 7.3**

**Property 33: Session trust score calculation**
*For any* session creation, trust score should be calculated based on device recognition and login patterns
**Validates: Requirements 7.4**

**Property 34: Inactive session termination**
*For any* session inactive for 30 days, session should be automatically terminated
**Validates: Requirements 7.5**

**Property 35: New location reduces trust**
*For any* login from new location, trust score should be reduced and security notification sent
**Validates: Requirements 7.6**

### Passwordless Authentication Properties

**Property 36: Magic link generation**
*For any* valid email in magic link request, single-use token should be generated and email sent
**Validates: Requirements 8.1**

**Property 37: Valid magic link creates session**
*For any* valid magic link token, session should be created and tokens returned
**Validates: Requirements 8.2**

**Property 38: Magic link expiration**
*For any* generated magic link token, expiration should be set to 15 minutes from creation
**Validates: Requirements 8.4**

**Property 39: WebAuthn authentication creates session**
*For any* valid WebAuthn credential, signature should be verified and session created
**Validates: Requirements 8.5**

**Property 40: WebAuthn registration stores credential**
*For any* WebAuthn registration, public key and credential identifier should be stored
**Validates: Requirements 8.6**

### OAuth Properties

**Property 41: OAuth initiation includes PKCE**
*For any* OAuth flow initiation, redirect should include PKCE challenge
**Validates: Requirements 9.1**

**Property 42: OAuth code exchange**
*For any* OAuth callback with authorization code, code should be exchanged for access token
**Validates: Requirements 9.2**

**Property 43: OAuth profile fetch**
*For any* OAuth access token, user profile should be fetched from provider
**Validates: Requirements 9.3**

**Property 44: OAuth account linking**
*For any* OAuth profile with email matching existing user, OAuth account should be linked to existing user
**Validates: Requirements 9.4**

**Property 45: OAuth new user creation**
*For any* OAuth profile with new email, new user account should be created
**Validates: Requirements 9.5**

**Property 46: OAuth email verification**
*For any* OAuth session where provider confirms email verification, email should be marked verified
**Validates: Requirements 9.6**

**Property 47: Multiple OAuth login**
*For any* user with multiple linked OAuth accounts, login should work through any linked provider
**Validates: Requirements 9.7**

### Password Reset Properties

**Property 48: Password reset email sent**
*For any* password reset request, reset token should be generated and email sent regardless of email existence
**Validates: Requirements 10.1**

**Property 49: Valid reset token updates password**
*For any* valid reset token with new password, password should be updated
**Validates: Requirements 10.2**

**Property 50: Reset token expiration**
*For any* generated reset token, expiration should be set to 1 hour from creation
**Validates: Requirements 10.4**

**Property 51: Password reset terminates sessions**
*For any* password reset, all active sessions except current should be terminated
**Validates: Requirements 10.5**

**Property 52: Password reset audit logging**
*For any* password reset, password change should be recorded in audit log
**Validates: Requirements 10.6**

### Authorization Properties

**Property 53: Role assignment grants permissions**
*For any* role assigned to user, all permissions associated with that role should be granted
**Validates: Requirements 11.1**

**Property 54: Role removal revokes permissions**
*For any* role removed from user, all permissions associated with that role should be revoked
**Validates: Requirements 11.2**

**Property 55: Multiple roles union permissions**
*For any* user with multiple roles, granted permissions should be union of all role permissions
**Validates: Requirements 11.3**

**Property 56: Permission caching**
*For any* permission check, user permissions should be cached for 5 minutes
**Validates: Requirements 11.4**

**Property 57: Role modification invalidates cache**
*For any* role permission modification, permission cache for all users with that role should be invalidated
**Validates: Requirements 11.5**

**Property 58: System roles prevent deletion**
*For any* default role creation, system flag should be set preventing deletion
**Validates: Requirements 11.6**

**Property 59: Protected resource permission check**
*For any* protected resource request, user permission should be verified before processing
**Validates: Requirements 12.1**

**Property 60: Missing permission rejection**
*For any* request without required permission, request should be rejected with authorization error
**Validates: Requirements 12.2**

**Property 61: Resource and action evaluation**
*For any* permission check, both resource type and action should be evaluated
**Validates: Requirements 12.3**

**Property 62: Wildcard permission grants all**
*For any* permission with wildcard resource, access should be granted to all resources of that type
**Validates: Requirements 12.4**

**Property 63: Permission check performance**
*For any* permission check, operation should complete within 5 milliseconds at 95th percentile
**Validates: Requirements 12.5**

### Audit & Security Properties

**Property 64: Security action creates audit log**
*For any* security-relevant action, audit log entry should be created asynchronously
**Validates: Requirements 13.1**

**Property 65: Audit log completeness**
*For any* audit log creation, user ID, action, resource, timestamp, IP address, and user agent should be recorded
**Validates: Requirements 13.2**

**Property 66: Audit log risk scoring**
*For any* audit log creation, risk score should be calculated based on action type and context
**Validates: Requirements 13.3**

**Property 67: High risk generates alert**
*For any* audit log with high risk score, security alert should be generated
**Validates: Requirements 13.4**

**Property 68: Audit log filtering**
*For any* audit log query, filtering by user, action, date range, and risk score should be supported
**Validates: Requirements 13.5**

**Property 69: Audit log immutability**
*For any* audit log storage, immutability should be ensured preventing modification or deletion
**Validates: Requirements 13.6**

### Rate Limiting Properties

**Property 70: Rate limit rejection**
*For any* request exceeding rate limit, request should be rejected with rate limit error and retry-after header
**Validates: Requirements 14.1**

**Property 71: Authentication endpoint rate limit**
*For any* IP address, authentication endpoints should allow 10 requests per minute
**Validates: Requirements 14.2**

**Property 72: Password reset rate limit**
*For any* IP address, password reset should allow 5 requests per minute
**Validates: Requirements 14.3**

**Property 73: Registration rate limit**
*For any* IP address, registration should allow 3 requests per 5 minutes
**Validates: Requirements 14.4**

**Property 74: MFA verification rate limit**
*For any* user, MFA verification should allow 1 request per 10 seconds
**Validates: Requirements 14.5**

**Property 75: High trust relaxed limits**
*For any* user with elevated trust score, relaxed rate limits should be applied
**Validates: Requirements 14.7**

### Device Management Properties

**Property 76: New device registration**
*For any* login from new device, device should be registered with fingerprint and metadata
**Validates: Requirements 15.1**

**Property 77: Device list completeness**
*For any* device list request, all registered devices with name, type, last access, and trust status should be returned
**Validates: Requirements 15.2**

**Property 78: Device trust increases score**
*For any* device marked as trusted, trust score should increase
**Validates: Requirements 15.3**

**Property 79: Device removal terminates sessions**
*For any* device removal, all sessions from that device should be terminated
**Validates: Requirements 15.4**

**Property 80: Device fingerprint composition**
*For any* fingerprint calculation, user agent, screen resolution, timezone, and canvas fingerprint should be combined
**Validates: Requirements 15.5**

**Property 81: Unused device removal**
*For any* device unused for 90 days, device should be automatically removed
**Validates: Requirements 15.6**

### Webhook Properties

**Property 82: Webhook creation generates secret**
*For any* webhook creation with URL and event types, secret should be generated for signature verification
**Validates: Requirements 16.1**

**Property 83: Event triggers webhook**
*For any* subscribed event occurrence, HTTP POST should be sent to webhook URL with event payload
**Validates: Requirements 16.2**

**Property 84: Webhook retry on failure**
*For any* failed webhook delivery, retry with exponential backoff up to 5 attempts should occur
**Validates: Requirements 16.3**

**Property 85: Webhook signature inclusion**
*For any* webhook delivery, HMAC signature should be included in header
**Validates: Requirements 16.4**

**Property 86: Webhook list ownership**
*For any* webhook list request, only webhooks owned by that user should be returned
**Validates: Requirements 16.5**

**Property 87: Webhook deletion stops events**
*For any* webhook deletion, events should stop being sent to that webhook URL
**Validates: Requirements 16.6**

### Real-Time Notification Properties

**Property 88: New device notification**
*For any* login from new device, real-time notification should be sent to all other active sessions
**Validates: Requirements 17.1**

**Property 89: Password change notification**
*For any* password change, real-time notification should be sent to all active sessions
**Validates: Requirements 17.2**

**Property 90: MFA change notification**
*For any* MFA enable or disable, real-time notification should be sent to all active sessions
**Validates: Requirements 17.3**

**Property 91: WebSocket preference**
*For any* real-time notification, WebSocket connection should be used if available
**Validates: Requirements 17.4**

### Security Monitoring Properties

**Property 92: Failed login alert**
*For any* pattern of multiple failed login attempts, security alert should be generated
**Validates: Requirements 18.1**

**Property 93: Unusual location alert**
*For any* login from unusual location, security alert should be generated
**Validates: Requirements 18.2**

**Property 94: Impossible travel alert**
*For any* impossible travel detection, security alert should be generated and additional verification required
**Validates: Requirements 18.3**

**Property 95: Alert recording**
*For any* security alert generation, alert should be recorded in monitoring system
**Validates: Requirements 18.4**

**Property 96: High risk step-up auth**
*For any* risk score above threshold, step-up authentication should be required
**Validates: Requirements 18.5**

### Performance Properties

**Property 97: Authentication response time**
*For any* authentication request, response should be within 200 milliseconds at 95th percentile
**Validates: Requirements 19.1**

**Property 98: Authorization check performance**
*For any* authorization check, completion should be within 5 milliseconds at 95th percentile
**Validates: Requirements 19.2**

**Property 99: Frequent data caching**
*For any* frequently accessed data, caching should occur with appropriate TTL
**Validates: Requirements 19.5**

### High Availability Properties

**Property 100: Database retry on failure**
*For any* database connection failure, retry with exponential backoff up to 3 attempts should occur
**Validates: Requirements 20.2**

**Property 101: Circuit breaker activation**
*For any* external service unavailability, circuit breaker should activate to prevent cascading failures
**Validates: Requirements 20.4**

**Property 102: Session consistency across instances**
*For any* session access across multiple instances, consistency should be maintained
**Validates: Requirements 20.6**

### Monitoring Properties

**Property 103: Request metrics recording**
*For any* request processed, metrics including count, duration, and status code should be recorded
**Validates: Requirements 22.1**

**Property 104: Error logging completeness**
*For any* error encountered, log should include full context with stack trace and request details
**Validates: Requirements 22.2**

**Property 105: Distributed tracing**
*For any* operation performed, distributed trace span should be created
**Validates: Requirements 22.3**

**Property 106: Structured logging format**
*For any* log event, structured JSON format with correlation identifiers should be used
**Validates: Requirements 22.5**

**Property 107: Health check verification**
*For any* health check execution, database and cache connectivity should be verified
**Validates: Requirements 22.6**

### API Documentation Properties

**Property 108: Endpoint documentation completeness**
*For any* endpoint documentation, request schema, response schema, and error codes should be shown
**Validates: Requirements 23.2**

**Property 109: API update reflects in docs**
*For any* API update, documentation should automatically update
**Validates: Requirements 23.4**

**Property 110: Version documentation maintenance**
*For any* API version, documentation should be maintained
**Validates: Requirements 23.5**


## Error Handling

### Error Hierarchy

```typescript
class ApplicationError extends Error {
  constructor(
    public readonly name: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication failed', details?: Record<string, any>) {
    super('AuthenticationError', message, 401, true, details);
  }
}

class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, any>) {
    super('AuthorizationError', message, 403, true, details);
  }
}

class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ValidationError', message, 400, true, details);
  }
}

class NotFoundError extends ApplicationError {
  constructor(resource: string, details?: Record<string, any>) {
    super('NotFoundError', `${resource} not found`, 404, true, details);
  }
}

class ConflictError extends ApplicationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ConflictError', message, 409, true, details);
  }
}

class RateLimitError extends ApplicationError {
  constructor(retryAfter: number, details?: Record<string, any>) {
    super('RateLimitError', 'Rate limit exceeded', 429, true, { ...details, retryAfter });
  }
}

class ServiceUnavailableError extends ApplicationError {
  constructor(service: string, details?: Record<string, any>) {
    super('ServiceUnavailableError', `${service} is unavailable`, 503, true, details);
  }
}
```

### Global Error Handler

```typescript
async function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.id;
  const userId = request.user?.id;
  
  // Log error with full context
  logger.error('Request error', {
    requestId,
    userId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    },
  });
  
  // Send to monitoring system
  if (error instanceof ApplicationError && !error.isOperational) {
    await alertingService.sendAlert({
      severity: 'critical',
      message: 'Non-operational error occurred',
      error,
      requestId,
    });
  }
  
  // Convert to HTTP response
  if (error instanceof ApplicationError) {
    return reply.status(error.statusCode).send({
      error: {
        type: error.name,
        message: error.message,
        details: error.details,
        requestId,
      },
    });
  }
  
  // Unknown error - hide details from client
  return reply.status(500).send({
    error: {
      type: 'InternalServerError',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
```

### Repository Error Handling

```typescript
class UserRepository implements IUserRepository {
  async save(user: User): Promise<User> {
    try {
      const result = await this.db.insert(users).values(user).returning();
      return result[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new ConflictError('Email already exists');
      }
      if (error.code === '23503') { // Foreign key violation
        throw new ValidationError('Invalid reference');
      }
      throw new ServiceUnavailableError('Database', { originalError: error.message });
    }
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly resetTimeout: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}
```


## Testing Strategy

### Dual Testing Approach

The system employs both unit testing and property-based testing as complementary strategies:

- **Unit tests** verify specific examples, edge cases, and error conditions with concrete inputs
- **Property tests** verify universal properties that should hold across all valid inputs
- Together they provide comprehensive coverage: unit tests catch concrete bugs, property tests verify general correctness

### Property-Based Testing

**Framework:** fast-check (JavaScript/TypeScript property-based testing library)

**Configuration:** Each property-based test runs minimum 100 iterations to ensure thorough random input coverage

**Tagging Convention:** Each property-based test must include a comment explicitly referencing the correctness property:
```typescript
// Feature: enterprise-auth-system, Property 1: Valid registration creates hashed account
```

**Implementation:** Each correctness property from the design document must be implemented by a SINGLE property-based test

**Example Property Test:**
```typescript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Registration Properties', () => {
  // Feature: enterprise-auth-system, Property 1: Valid registration creates hashed account
  it('should create hashed account for any valid email and password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 8 }).filter(pwd => 
          /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && 
          /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
        ),
        async (email, password) => {
          const result = await authService.register({ email, password, name: 'Test User' });
          
          expect(result.user).toBeDefined();
          expect(result.user.email).toBe(email.toLowerCase());
          expect(result.user.passwordHash).toBeDefined();
          expect(result.user.passwordHash).not.toBe(password);
          
          // Verify Argon2id was used
          expect(result.user.passwordHash).toMatch(/^\$argon2id\$/);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: enterprise-auth-system, Property 2: Duplicate email rejection
  it('should reject registration for any already registered email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 8 }).filter(pwd => 
          /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && 
          /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
        ),
        async (email, password) => {
          // First registration should succeed
          await authService.register({ email, password, name: 'User 1' });
          
          // Second registration with same email should fail
          await expect(
            authService.register({ email, password, name: 'User 2' })
          ).rejects.toThrow(ConflictError);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing

**Framework:** Vitest with TypeScript support

**Coverage Targets:**
- 80% line coverage minimum
- 75% branch coverage minimum
- 100% coverage of critical security code (authentication, authorization, password hashing, token generation)

**Test Organization:**
- Co-locate tests with source files using `.test.ts` suffix
- Group related tests using `describe` blocks
- Use descriptive test names explaining what is being tested

**Example Unit Tests:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { User } from './user.entity';
import { Email } from './email.value-object';
import { Password } from './password.value-object';

describe('User Entity', () => {
  let user: User;
  
  beforeEach(() => {
    user = new User({
      id: '123',
      email: new Email('test@example.com'),
      passwordHash: '$argon2id$...',
      name: 'Test User',
      emailVerified: false,
      mfaEnabled: false,
      accountLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  
  describe('lockAccount', () => {
    it('should set accountLocked to true', () => {
      user.lockAccount();
      expect(user.accountLocked).toBe(true);
    });
    
    it('should emit AccountLocked event', () => {
      const events: any[] = [];
      user.on('AccountLocked', (event) => events.push(event));
      
      user.lockAccount();
      
      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe('123');
    });
  });
  
  describe('incrementFailedAttempts', () => {
    it('should increment counter', () => {
      user.incrementFailedAttempts();
      expect(user.failedLoginAttempts).toBe(1);
    });
    
    it('should lock account after 5 attempts', () => {
      for (let i = 0; i < 5; i++) {
        user.incrementFailedAttempts();
      }
      expect(user.accountLocked).toBe(true);
    });
  });
  
  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = new Password('Test123!@#');
      user.passwordHash = await password.hash();
      
      const result = await user.verifyPassword(password);
      expect(result).toBe(true);
    });
    
    it('should return false for incorrect password', async () => {
      const correctPassword = new Password('Test123!@#');
      const wrongPassword = new Password('Wrong123!@#');
      user.passwordHash = await correctPassword.hash();
      
      const result = await user.verifyPassword(wrongPassword);
      expect(result).toBe(false);
    });
  });
});
```

### Integration Testing

**Framework:** Vitest with Testcontainers for real PostgreSQL and Redis instances

**Purpose:** Verify actual database behavior, transactions, constraints, and caching

**Example Integration Test:**
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { UserRepository } from './user.repository';
import { drizzle } from 'drizzle-orm/node-postgres';

describe('UserRepository Integration', () => {
  let postgresContainer: PostgreSqlContainer;
  let redisContainer: RedisContainer;
  let repository: UserRepository;
  
  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer().start();
    redisContainer = await new RedisContainer().start();
    
    const db = drizzle(postgresContainer.getConnectionString());
    await runMigrations(db);
    
    repository = new UserRepository(db);
  });
  
  afterAll(async () => {
    await postgresContainer.stop();
    await redisContainer.stop();
  });
  
  beforeEach(async () => {
    await repository.deleteAll(); // Clean slate for each test
  });
  
  it('should enforce unique email constraint', async () => {
    const user1 = createTestUser({ email: 'test@example.com' });
    await repository.save(user1);
    
    const user2 = createTestUser({ email: 'test@example.com' });
    await expect(repository.save(user2)).rejects.toThrow(ConflictError);
  });
  
  it('should cascade delete sessions when user deleted', async () => {
    const user = await repository.save(createTestUser());
    const session = await sessionRepository.create(createTestSession(user.id));
    
    await repository.delete(user.id);
    
    const foundSession = await sessionRepository.findById(session.id);
    expect(foundSession).toBeNull();
  });
});
```

### API Testing

**Framework:** Supertest with Fastify server

**Purpose:** Test complete request-response cycle including authentication, authorization, validation, and error handling

**Example API Test:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from './app';

describe('Authentication API', () => {
  let app: FastifyInstance;
  let request: supertest.SuperTest<supertest.Test>;
  
  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
    request = supertest(app.server);
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('POST /api/v1/auth/register', () => {
    it('should register user with valid data', async () => {
      const response = await request
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'Test User',
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      });
    });
    
    it('should return 400 for invalid email', async () => {
      const response = await request
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test123!@#',
          name: 'Test User',
        })
        .expect(400);
      
      expect(response.body.error.type).toBe('ValidationError');
    });
    
    it('should return 409 for duplicate email', async () => {
      await request
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'User 1',
        })
        .expect(201);
      
      const response = await request
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'User 2',
        })
        .expect(409);
      
      expect(response.body.error.type).toBe('ConflictError');
    });
  });
  
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'Test User',
        });
    });
    
    it('should login with valid credentials', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });
    
    it('should return 401 for invalid credentials', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
      
      expect(response.body.error.type).toBe('AuthenticationError');
    });
  });
});
```

### End-to-End Testing

**Purpose:** Test critical user journeys from start to finish

**Critical Flows:**
1. Complete registration flow: register → verify email → login
2. MFA flow: enable MFA → verify setup → login with MFA
3. OAuth flow: initiate → callback → session creation
4. Password reset flow: request reset → receive email → reset password
5. Session management: create multiple sessions → list → revoke

### Test Data Factories

**Purpose:** Create consistent test fixtures with randomized but valid data

```typescript
import { faker } from '@faker-js/faker';

export class UserFactory {
  static create(overrides?: Partial<User>): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      passwordHash: '$argon2id$v=19$m=65536,t=2,p=1$...',
      name: faker.person.fullName(),
      image: faker.image.avatar(),
      emailVerified: false,
      emailVerifiedAt: null,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
      accountLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }
  
  static createVerified(overrides?: Partial<User>): User {
    return this.create({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      ...overrides,
    });
  }
  
  static createWithMFA(overrides?: Partial<User>): User {
    return this.create({
      mfaEnabled: true,
      mfaSecret: faker.string.alphanumeric(32),
      mfaBackupCodes: Array.from({ length: 10 }, () => faker.string.alphanumeric(8)),
      ...overrides,
    });
  }
  
  static createLocked(overrides?: Partial<User>): User {
    return this.create({
      accountLocked: true,
      failedLoginAttempts: 5,
      ...overrides,
    });
  }
}
```

### Performance Testing

**Framework:** Artillery or k6 for load testing

**Targets:**
- Authentication endpoints: 200ms at p95
- Authorization checks: 5ms at p95
- System throughput: 10,000 RPS per instance

**Example Load Test:**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 100
      name: "Warm up"
    - duration: 300
      arrivalRate: 1000
      name: "Sustained load"
    - duration: 60
      arrivalRate: 2000
      name: "Peak load"
  
scenarios:
  - name: "Login flow"
    weight: 70
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "{{ $randomEmail }}"
            password: "Test123!@#"
      - think: 2
      
  - name: "Registration flow"
    weight: 20
    flow:
      - post:
          url: "/api/v1/auth/register"
          json:
            email: "{{ $randomEmail }}"
            password: "Test123!@#"
            name: "{{ $randomFullName }}"
      - think: 5
      
  - name: "Token refresh"
    weight: 10
    flow:
      - post:
          url: "/api/v1/auth/refresh"
          json:
            refreshToken: "{{ refreshToken }}"
```



## Development Quality Standards

### Code Quality Rules

These standards apply to all task implementations and must be followed during development to ensure high-quality, maintainable code.

#### Code Structure & Clarity

**Leverage Built-in Functions**
- Use native language features and standard library functions instead of reinventing solutions
- Prefer array methods (map, filter, reduce) over manual loops when appropriate
- Utilize framework-provided utilities before creating custom implementations

**Clear Naming Conventions**
- Use descriptive, self-documenting variable and function names
- Avoid abbreviations unless universally understood (e.g., id, url)
- Name booleans with is/has/should prefixes (isValid, hasPermission, shouldRetry)
- Name functions with verb-noun patterns (getUserById, validateEmail, createSession)

**DRY Principle**
- Extract repeated code into reusable functions
- Create shared utilities for common operations
- Avoid copy-paste programming - refactor duplicates into abstractions

**Avoid Deep Nesting**
- Keep conditional nesting to maximum 3 levels
- Use early returns to reduce nesting
- Extract complex conditions into well-named functions
- Consider guard clauses to handle edge cases first

**Consistent Formatting**
- Follow project's ESLint and Prettier configurations
- Maintain consistent indentation (2 spaces for this project)
- Use consistent quote style (single quotes for strings)
- Keep line length under 100 characters

#### Planning & Problem Solving

**Plan Before Coding**
- Understand the full requirement before writing code
- Break down complex problems into smaller, manageable pieces
- Consider edge cases and error scenarios upfront
- Review existing code patterns and architecture before implementing

**Avoid Monolithic Functions**
- Keep functions focused on single responsibility
- Extract complex logic into separate, testable functions
- Aim for functions under 50 lines of code
- If a function does multiple things, split it

**Right-Size Solutions**
- Don't overengineer simple problems with complex patterns
- Don't underestimate complexity - use appropriate architecture
- Match solution complexity to problem complexity
- Consider maintainability and future extensibility

**Context Awareness**
- Understand how new code fits into existing architecture
- Follow established patterns and conventions in the codebase
- Consider the broader system implications of changes
- Maintain consistency with existing code style and structure

#### Testing & Quality Assurance

**Comprehensive Testing**
- Write tests for happy paths AND edge cases
- Test error conditions and boundary values
- Include integration tests for critical flows
- Achieve minimum 80% code coverage

**Proper Error Handling**
- Handle all error scenarios explicitly
- Use appropriate error types from the error hierarchy
- Provide meaningful error messages
- Log errors with sufficient context for debugging

**Avoid Console Debugging**
- Use proper logging framework (Winston) instead of console.log
- Remove debug statements before committing
- Use structured logging with appropriate log levels
- Include correlation IDs for request tracing

**Security First**
- Validate all user input
- Sanitize data before database operations
- Use parameterized queries to prevent SQL injection
- Never log sensitive data (passwords, tokens, secrets)

#### Version Control & Collaboration

**Meaningful Commits**
- Write clear, descriptive commit messages
- Keep commits focused on single logical changes
- Use conventional commit format: type(scope): description
- Avoid massive commits mixing multiple concerns

**Effective Branching**
- Create feature branches for new work
- Keep branches short-lived and focused
- Rebase or merge regularly to stay current with main
- Delete branches after merging

**Code Review Mindset**
- Write code that others can understand
- Add comments for complex logic or non-obvious decisions
- Document public APIs and interfaces
- Consider the reviewer's perspective

#### Performance & Optimization

**Efficient Database Operations**
- Use appropriate indexes for query patterns
- Avoid N+1 queries - use joins or batch loading
- Implement pagination for large result sets
- Cache frequently accessed data with appropriate TTL

**Resource Management**
- Close database connections and file handles
- Implement connection pooling
- Consider memory implications of data structures
- Clean up resources in finally blocks or using try-with-resources

**Dependency Management**
- Only include necessary dependencies
- Keep dependencies up to date for security patches
- Review bundle size impact of new dependencies
- Prefer smaller, focused libraries over large frameworks

#### Documentation & Communication

**Code Documentation**
- Document WHY, not just WHAT
- Explain non-obvious decisions and trade-offs
- Keep documentation close to code (JSDoc comments)
- Update documentation when code changes

**Clear Communication**
- Communicate blockers and challenges early
- Ask clarifying questions when requirements are ambiguous
- Provide context in pull request descriptions
- Share knowledge with team members

**Incremental Delivery**
- Focus on delivering working increments
- Don't wait for perfection - iterate and improve
- Get feedback early and often
- Prioritize functionality over polish in early iterations

#### AI-Assisted Development Considerations

**Verify Generated Code**
- Don't blindly trust AI-generated code
- Check for hallucinated APIs or methods
- Verify framework versions and compatibility
- Test generated code thoroughly

**Maintain Consistency**
- Ensure AI suggestions match existing code patterns
- Follow project structure and conventions
- Adapt generated code to fit architecture
- Review for consistency with team standards

**Security & Best Practices**
- Review generated code for security vulnerabilities
- Ensure proper error handling is included
- Verify input validation is present
- Check for proper resource cleanup

**Integration Awareness**
- Consider how generated code integrates with existing system
- Verify compatibility with current tech stack
- Test integration points thoroughly
- Ensure generated code follows clean architecture layers

### Implementation Checklist

Before marking any task as complete, verify:

- [ ] Code follows naming conventions and is self-documenting
- [ ] No code duplication - common logic extracted to reusable functions
- [ ] Functions are focused and under 50 lines
- [ ] Conditional nesting is minimal (max 3 levels)
- [ ] All edge cases and error scenarios are handled
- [ ] Security considerations addressed (validation, sanitization)
- [ ] Performance implications considered (queries, caching, memory)
- [ ] Code follows existing patterns and architecture
- [ ] No console.log or debug statements remaining
- [ ] Commit messages are clear and descriptive
- [ ] Code passes linting and formatting checks
- [ ] No sensitive data in logs or error messages
- [ ] Resources properly managed and cleaned up
