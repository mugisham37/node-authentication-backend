# Architecture Refactoring Guide - Step-by-Step Execution Plan

## Overview

This guide provides **exact PowerShell commands** to fix all architectural violations and polish the project structure. Each step is designed to be executed sequentially with minimal risk.

**Estimated Time**: 2-3 hours
**Risk Level**: Low (mostly file moves and import updates)
**Backup Recommended**: Yes (commit current state before starting)

---

## Pre-Refactoring Checklist

### 1. Backup Current State
```powershell
# Commit all current changes
git add .
git commit -m "Pre-refactoring checkpoint - architecture cleanup"
git branch backup-before-refactoring
```

### 2. Verify Project Builds
```powershell
# Ensure project compiles before refactoring
npm run build
npm run typecheck
```

### 3. Create Refactoring Branch
```powershell
git checkout -b refactor/architecture-cleanup
```

---

## Phase 1: Critical Fixes - Domain Layer Violations

### Priority: CRITICAL | Estimated Time: 30 minutes

These fixes address the most serious architectural violations where domain layer depends on infrastructure.


### Step 1.1: Move Webhook Repository Implementation

**Problem**: Concrete repository implementation in domain layer
**Impact**: Domain depends on infrastructure (Drizzle ORM)

```powershell
# Move webhook repository implementation to infrastructure
Move-Item -Path "src\domain\repositories\webhook.repository.impl.ts" `
          -Destination "src\infrastructure\repositories\webhook.repository.ts"

# Update the domain repositories index to export only the interface
# Edit src/domain/repositories/index.ts manually or use this:
$indexPath = "src\domain\repositories\index.ts"
$content = Get-Content $indexPath
$content = $content -replace "export \{ WebhookRepository \} from './webhook.repository.impl.js';", `
                              "export type { IWebhookRepository, WebhookDelivery, WebhookPaginationOptions, PaginatedWebhooks } from './webhook.repository.interface.js';"
Set-Content -Path $indexPath -Value $content
```

**Files to Update After Move**:
- `src/infrastructure/repositories/webhook.repository.ts` - Update imports (change `../../infrastructure/` to `../`)
- Any file importing `WebhookRepository` from domain - update to import from infrastructure

---

### Step 1.2: Move Notification Providers to Infrastructure

**Problem**: Notification providers with external dependencies in domain layer
**Impact**: Domain imports from infrastructure (logger, Twilio SDK, SendGrid SDK)

```powershell
# Create infrastructure notifications directory
New-Item -ItemType Directory -Path "src\infrastructure\notifications" -Force
New-Item -ItemType Directory -Path "src\infrastructure\notifications\channels" -Force
New-Item -ItemType Directory -Path "src\infrastructure\notifications\providers" -Force

# Move notification channels
Move-Item -Path "src\domain\notifications\channels\*" `
          -Destination "src\infrastructure\notifications\channels\" -Force

# Move notification providers
Move-Item -Path "src\domain\notifications\providers\*" `
          -Destination "src\infrastructure\notifications\providers\" -Force

# Note: templates folder is empty, we'll handle it later
# Remove the old domain notifications directory
Remove-Item -Path "src\domain\notifications" -Recurse -Force
```

**Files to Update After Move**:
All files now need to import from `infrastructure/notifications` instead of `domain/notifications`

Since no files currently import from `domain/notifications` (verified by grep), this is safe.

---


## Phase 2: Shared Layer Cleanup

### Priority: HIGH | Estimated Time: 45 minutes

Clean up the shared layer to contain only cross-cutting concerns (errors, types, utilities).

### Step 2.1: Remove Duplicate Circuit Breaker from Shared

**Problem**: Duplicate file that's not being used

```powershell
# Check if file exists and remove it
if (Test-Path "src\shared\email\email.service.with-circuit-breaker.ts") {
    Remove-Item "src\shared\email\email.service.with-circuit-breaker.ts" -Force
}

# Remove empty email directory
if (Test-Path "src\shared\email") {
    Remove-Item "src\shared\email" -Recurse -Force
}
```

---

### Step 2.2: Move Webhook Services to Application Layer

**Problem**: Business logic in shared layer

```powershell
# Move webhook delivery files to application services
Move-Item -Path "src\shared\webhook\webhook-delivery.factory.ts" `
          -Destination "src\application\services\webhook-delivery.factory.ts" -Force

Move-Item -Path "src\shared\webhook\webhook-delivery.service.impl.ts" `
          -Destination "src\application\services\webhook-delivery.service.impl.ts" -Force

Move-Item -Path "src\shared\webhook\index.ts" `
          -Destination "src\application\services\webhook-delivery.index.ts" -Force

# Remove empty webhook directory
Remove-Item -Path "src\shared\webhook" -Recurse -Force
```

**Files to Update**:
- Search for imports from `shared/webhook` and update to `application/services`
- Update `src/application/services/index.ts` to export webhook delivery services

---

### Step 2.3: Move Mail Infrastructure to Infrastructure Layer

**Problem**: Mail providers and templates are infrastructure concerns

```powershell
# Create infrastructure mail directory structure
New-Item -ItemType Directory -Path "src\infrastructure\mail" -Force
New-Item -ItemType Directory -Path "src\infrastructure\mail\providers" -Force
New-Item -ItemType Directory -Path "src\infrastructure\mail\templates" -Force
New-Item -ItemType Directory -Path "src\infrastructure\mail\templates\layouts" -Force
New-Item -ItemType Directory -Path "src\infrastructure\mail\templates\sms" -Force

# Move mail providers
Move-Item -Path "src\shared\mail\providers\*" `
          -Destination "src\infrastructure\mail\providers\" -Force

# Move mail templates
Move-Item -Path "src\shared\mail\templates\*" `
          -Destination "src\infrastructure\mail\templates\" -Recurse -Force

# Remove old shared mail directory
Remove-Item -Path "src\shared\mail" -Recurse -Force
```

**Files to Update**:
1. `src/application/email/email.service.impl.ts`
   - Change: `from '../../shared/mail/providers/nodemailer-provider.js'`
   - To: `from '../../infrastructure/mail/providers/nodemailer-provider.js'`

2. `src/application/email/email.factory.ts`
   - Change: `from '../../shared/mail/providers/nodemailer-provider.js'`
   - To: `from '../../infrastructure/mail/providers/nodemailer-provider.js'`

3. `src/application/services/template.service.ts`
   - Change: `join(__dirname, '../../shared/mail/templates')`
   - To: `join(__dirname, '../../infrastructure/mail/templates')`

---


## Phase 3: Infrastructure Layer Organization

### Priority: MEDIUM | Estimated Time: 30 minutes

Improve infrastructure layer organization for better maintainability.

### Step 3.1: Consolidate Database Schemas

**Problem**: Redundant `persistence/` folder overlapping with `database/schema/`

```powershell
# Check what's in persistence/schemas
Get-ChildItem "src\infrastructure\persistence\schemas" -Recurse

# Move any schemas to database/schema
if (Test-Path "src\infrastructure\persistence\schemas\*") {
    Move-Item -Path "src\infrastructure\persistence\schemas\*" `
              -Destination "src\infrastructure\database\schema\" -Force
}

# Move sessions.schema.ts if it's at persistence root
if (Test-Path "src\infrastructure\persistence\sessions.schema.ts") {
    Move-Item -Path "src\infrastructure\persistence\sessions.schema.ts" `
              -Destination "src\infrastructure\database\schema\sessions.schema.ts" -Force
}

# Remove persistence directory
Remove-Item -Path "src\infrastructure\persistence" -Recurse -Force
```

**Files to Update**:
- Search for imports from `infrastructure/persistence` and update to `infrastructure/database/schema`

---

### Step 3.2: Organize Circuit Breaker Decorators

**Problem**: Circuit breaker wrappers scattered across layers

```powershell
# Create decorators directory in resilience
New-Item -ItemType Directory -Path "src\infrastructure\resilience\decorators" -Force

# Move OAuth circuit breaker from infrastructure root
Move-Item -Path "src\infrastructure\oauth.service.with-circuit-breaker.ts" `
          -Destination "src\infrastructure\resilience\decorators\oauth.service.with-circuit-breaker.ts" -Force

# Move email circuit breaker from application
Move-Item -Path "src\application\email\email.service.with-circuit-breaker.ts" `
          -Destination "src\infrastructure\resilience\decorators\email.service.with-circuit-breaker.ts" -Force
```

**Files to Update**:
1. Update `src/infrastructure/index.ts`:
   - Change: `export { OAuthServiceWithCircuitBreaker } from './oauth.service.with-circuit-breaker.js';`
   - To: `export { OAuthServiceWithCircuitBreaker } from './resilience/decorators/oauth.service.with-circuit-breaker.js';`

2. Update `src/application/email/index.ts` if it exports the circuit breaker version

3. Search for any imports of these circuit breaker files and update paths

---

### Step 3.3: Standardize Repository Organization

**Problem**: Inconsistent organization (some in subfolders, some flat)

**Option A: Flatten All** (Recommended for simplicity)
```powershell
# Move compliance audit log repository to root
Move-Item -Path "src\infrastructure\repositories\compliance\audit-log.repository.ts" `
          -Destination "src\infrastructure\repositories\audit-log.repository.ts" -Force

# Remove compliance directory
Remove-Item -Path "src\infrastructure\repositories\compliance" -Recurse -Force
```

**Option B: Group All by Domain**
```powershell
# Create domain-based folders
New-Item -ItemType Directory -Path "src\infrastructure\repositories\auth" -Force
New-Item -ItemType Directory -Path "src\infrastructure\repositories\compliance" -Force
New-Item -ItemType Directory -Path "src\infrastructure\repositories\webhooks" -Force

# Move repositories to appropriate folders
# (This is more work - only do if you want strict domain grouping)
```

**Recommendation**: Use Option A (flatten) for simplicity.

**Files to Update**:
- Update imports from `infrastructure/repositories/compliance/audit-log.repository.js`
- To: `infrastructure/repositories/audit-log.repository.js`

---


## Phase 4: Integration Layer Decision

### Priority: MEDIUM | Estimated Time: 15 minutes

Decide whether to keep or remove the empty integration layer.

### Option A: Remove Integration Layer (Recommended)

**Rationale**: All folders are empty, and providers are already in infrastructure

```powershell
# Remove the entire integration layer
Remove-Item -Path "src\integration" -Recurse -Force
```

**No files to update** - nothing imports from this layer.

---

### Option B: Consolidate Providers into Integration Layer

**Rationale**: Create a single source for all external integrations

```powershell
# Move OAuth providers from infrastructure to integration
Move-Item -Path "src\infrastructure\providers\github" `
          -Destination "src\integration\oauth-providers\github" -Force
Move-Item -Path "src\infrastructure\providers\google" `
          -Destination "src\integration\oauth-providers\google" -Force
Move-Item -Path "src\infrastructure\providers\microsoft" `
          -Destination "src\integration\oauth-providers\microsoft" -Force

# Move SMS providers
Move-Item -Path "src\infrastructure\providers\sms" `
          -Destination "src\integration\sms-providers" -Force

# Move email providers from infrastructure/mail/providers
Move-Item -Path "src\infrastructure\mail\providers" `
          -Destination "src\integration\email-providers\nodemailer" -Force

# Move notification providers
Move-Item -Path "src\infrastructure\notifications\providers" `
          -Destination "src\integration\notification-providers" -Force

# Update all imports accordingly
```

**Recommendation**: **Option A** - Remove the integration layer. It adds complexity without clear benefit. Infrastructure layer is the right place for external integrations.

---


## Phase 5: API Layer Polish

### Priority: LOW | Estimated Time: 15 minutes

Optional improvements to API layer structure.

### Step 5.1: Simplify REST Presentation Nesting (Optional)

**Problem**: `api/rest/presentation` is redundant nesting

```powershell
# Option: Flatten presentation into rest
# Move all presentation contents up one level
Move-Item -Path "src\api\rest\presentation\controllers" `
          -Destination "src\api\rest\controllers" -Force
Move-Item -Path "src\api\rest\presentation\routes" `
          -Destination "src\api\rest\routes" -Force
Move-Item -Path "src\api\rest\presentation\schemas" `
          -Destination "src\api\rest\schemas" -Force
Move-Item -Path "src\api\rest\presentation\validators" `
          -Destination "src\api\rest\validators" -Force

# Remove empty presentation directory
Remove-Item -Path "src\api\rest\presentation" -Force
```

**Files to Update**:
- All route imports in `src/app.ts`
- Change: `from './api/rest/presentation/routes/auth.routes.js'`
- To: `from './api/rest/routes/auth.routes.js'`

**Note**: This is optional. Current structure is acceptable if you prefer explicit "presentation" naming.

---

### Step 5.2: Handle Empty Versioning Folder

**Problem**: Empty versioning folder

**Option A: Remove it**
```powershell
Remove-Item -Path "src\api\common\versioning" -Force
```

**Option B: Implement basic versioning structure**
```powershell
# Create v1 structure
New-Item -ItemType Directory -Path "src\api\common\versioning\v1" -Force

# Create version middleware
New-Item -ItemType File -Path "src\api\common\versioning\version.middleware.ts" -Force
```

**Recommendation**: Remove it for now (Option A). Add versioning when actually needed.

---


## Phase 6: Enhance Shared Layer

### Priority: LOW | Estimated Time: 20 minutes

Add proper structure to shared layer for cross-cutting concerns.

### Step 6.1: Create Shared Utilities Structure

```powershell
# Create proper shared layer structure
New-Item -ItemType Directory -Path "src\shared\types" -Force
New-Item -ItemType Directory -Path "src\shared\constants" -Force
New-Item -ItemType Directory -Path "src\shared\utils" -Force

# Create index files for each
New-Item -ItemType File -Path "src\shared\types\index.ts" -Force
New-Item -ItemType File -Path "src\shared\constants\index.ts" -Force
New-Item -ItemType File -Path "src\shared\utils\index.ts" -Force
```

### Step 6.2: Create Common Types File

```powershell
# Create common types file
@"
/**
 * Common types used across the application
 */

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TimestampedEntity {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletableEntity extends TimestampedEntity {
  deletedAt: Date | null;
}
"@ | Out-File -FilePath "src\shared\types\common.types.ts" -Encoding utf8
```

### Step 6.3: Create Constants File

```powershell
# Create constants file
@"
/**
 * Application-wide constants
 */

export const APP_NAME = 'Enterprise Authentication System';
export const APP_VERSION = '1.0.0';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
  VERIFICATION_TOKEN: '24h',
  PASSWORD_RESET_TOKEN: '1h',
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

export const RATE_LIMITS = {
  AUTH: 5, // 5 attempts per window
  API: 100, // 100 requests per window
  WEBHOOK: 1000, // 1000 webhook deliveries per window
} as const;
"@ | Out-File -FilePath "src\shared\constants\app.constants.ts" -Encoding utf8
```

### Step 6.4: Update Shared Index

```powershell
# Update main shared index
@"
// Errors
export * from './errors/index.js';

// Types
export * from './types/index.js';

// Constants
export * from './constants/index.js';

// Utils (when added)
export * from './utils/index.js';
"@ | Out-File -FilePath "src\shared\index.ts" -Encoding utf8
```

---


## Phase 7: Update Import Paths

### Priority: CRITICAL | Estimated Time: 30 minutes

After moving files, update all import statements.

### Step 7.1: Automated Import Path Updates

```powershell
# Function to update imports in all TypeScript files
function Update-Imports {
    param(
        [string]$OldPath,
        [string]$NewPath
    )
    
    Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $updated = $content -replace [regex]::Escape($OldPath), $NewPath
        if ($content -ne $updated) {
            Set-Content -Path $_.FullName -Value $updated -NoNewline
            Write-Host "Updated: $($_.FullName)"
        }
    }
}

# Update webhook repository imports
Update-Imports -OldPath "from '../../domain/repositories/webhook.repository.impl.js'" `
               -NewPath "from '../../infrastructure/repositories/webhook.repository.js'"

Update-Imports -OldPath "from '../../../domain/repositories/webhook.repository.impl.js'" `
               -NewPath "from '../../../infrastructure/repositories/webhook.repository.js'"

# Update mail provider imports
Update-Imports -OldPath "from '../../shared/mail/providers/nodemailer-provider.js'" `
               -NewPath "from '../../infrastructure/mail/providers/nodemailer-provider.js'"

Update-Imports -OldPath "from '../../../shared/mail/providers/nodemailer-provider.js'" `
               -NewPath "from '../../../infrastructure/mail/providers/nodemailer-provider.js'"

# Update circuit breaker imports
Update-Imports -OldPath "from './oauth.service.with-circuit-breaker.js'" `
               -NewPath "from './resilience/decorators/oauth.service.with-circuit-breaker.js'"

Update-Imports -OldPath "from './email.service.with-circuit-breaker.js'" `
               -NewPath "from '../../infrastructure/resilience/decorators/email.service.with-circuit-breaker.js'"

# Update compliance repository imports
Update-Imports -OldPath "from '../../../domain/repositories/audit-log.repository.js'" `
               -NewPath "from '../../domain/repositories/audit-log.repository.js'"

Update-Imports -OldPath "from '../../../../domain/repositories/audit-log.repository.js'" `
               -NewPath "from '../../../domain/repositories/audit-log.repository.js'"

Update-Imports -OldPath "from '../compliance/audit-log.repository.js'" `
               -NewPath "from '../audit-log.repository.js'"
```

### Step 7.2: Update Template Service Path

```powershell
# Update template service to use new mail templates path
$templateServicePath = "src\application\services\template.service.ts"
$content = Get-Content $templateServicePath -Raw
$content = $content -replace "join\(__dirname, '../../shared/mail/templates'\)", `
                              "join(__dirname, '../../infrastructure/mail/templates')"
Set-Content -Path $templateServicePath -Value $content -NoNewline
```

### Step 7.3: Update Domain Repositories Index

```powershell
# Update domain/repositories/index.ts to export only interfaces
$repoIndexPath = "src\domain\repositories\index.ts"
@"
// Export repository interfaces only (no implementations)
export type { IUserRepository, UserPaginationOptions, PaginatedUsers } from './user.repository.interface.js';
export type { ISessionRepository, SessionPaginationOptions, PaginatedSessions } from './session.repository.js';
export type { IDeviceRepository, DevicePaginationOptions, PaginatedDevices } from './device.repository.js';
export type { IRoleRepository } from './role.repository.js';
export type { IPermissionRepository } from './permission.repository.js';
export type { IOAuthAccountRepository } from './oauth-account.repository.js';
export type { IAuditLogRepository, AuditLogFilters, AuditLogPaginationOptions, PaginatedAuditLogs } from './audit-log.repository.js';
export type { IWebhookRepository, WebhookDelivery, WebhookPaginationOptions, PaginatedWebhooks } from './webhook.repository.interface.js';
"@ | Out-File -FilePath $repoIndexPath -Encoding utf8
```

---


## Phase 8: Verification and Testing

### Priority: CRITICAL | Estimated Time: 30 minutes

Verify that all changes are correct and the project still works.

### Step 8.1: Type Check

```powershell
# Run TypeScript compiler to check for errors
npm run typecheck

# If errors appear, they will show which imports need fixing
# Fix any remaining import path issues
```

### Step 8.2: Build Project

```powershell
# Build the project
npm run build

# If build fails, check the error messages for missing imports
```

### Step 8.3: Run Linter

```powershell
# Run ESLint to check for issues
npm run lint

# Fix any linting issues
npm run lint:fix
```

### Step 8.4: Run Tests

```powershell
# Run all tests
npm test

# If tests fail, update test imports as needed
```

### Step 8.5: Manual Verification Checklist

Check these files manually to ensure imports are correct:

1. **src/app.ts** - Verify route imports
2. **src/infrastructure/index.ts** - Verify exports
3. **src/application/services/index.ts** - Verify service exports
4. **src/domain/repositories/index.ts** - Verify only interfaces exported
5. **src/infrastructure/container/container.ts** - Verify DI registrations

---


## Phase 9: Final Cleanup and Documentation

### Priority: LOW | Estimated Time: 15 minutes

### Step 9.1: Remove Empty Directories

```powershell
# Function to remove empty directories
function Remove-EmptyDirectories {
    param([string]$Path)
    
    Get-ChildItem -Path $Path -Directory -Recurse | 
        Where-Object { (Get-ChildItem $_.FullName -Force).Count -eq 0 } |
        ForEach-Object {
            Write-Host "Removing empty directory: $($_.FullName)"
            Remove-Item $_.FullName -Force
        }
}

# Remove any empty directories created during refactoring
Remove-EmptyDirectories -Path "src"
```

### Step 9.2: Update README Architecture Section

```powershell
# Update README.md with new structure
# (Do this manually or use the updated structure below)
```

Add this to README.md under "Project Structure":

```markdown
### Updated Project Structure

```
src/
├── api/                    # Presentation Layer (HTTP/WebSocket)
│   ├── common/
│   │   ├── pagination/     # Pagination helpers
│   │   └── serializers/    # Entity to DTO serializers
│   └── rest/
│       ├── controllers/    # Request handlers
│       ├── routes/         # Route definitions
│       ├── schemas/        # OpenAPI schemas
│       ├── validators/     # Request validators
│       └── websocket/      # WebSocket handlers
│
├── application/            # Application Layer (Use Cases)
│   ├── email/              # Email service implementation
│   └── services/           # Application services
│       ├── compliance/     # Compliance services
│       └── *.service.ts    # Domain services
│
├── domain/                 # Domain Layer (Business Logic)
│   ├── entities/           # Domain entities
│   ├── value-objects/      # Value objects
│   ├── events/             # Domain events
│   └── repositories/       # Repository interfaces ONLY
│
├── infrastructure/         # Infrastructure Layer (Technical Details)
│   ├── cache/              # Redis caching
│   ├── config/             # Configuration
│   ├── container/          # Dependency injection
│   ├── database/           # Database connection & schemas
│   ├── logging/            # Winston logging
│   ├── mail/               # Mail templates & providers
│   │   ├── providers/      # Nodemailer, etc.
│   │   └── templates/      # Email & SMS templates
│   ├── middleware/         # Fastify middleware
│   ├── monitoring/         # Metrics, tracing, health
│   ├── notifications/      # Notification channels & providers
│   │   ├── channels/       # Email, SMS channels
│   │   └── providers/      # SendGrid, Twilio, SES
│   ├── providers/          # OAuth providers (Google, GitHub)
│   ├── queue/              # BullMQ job queues
│   ├── rate-limit/         # Rate limiting
│   ├── repositories/       # Repository implementations
│   ├── resilience/         # Circuit breakers, retry logic
│   │   └── decorators/     # Service decorators
│   └── security/           # Encryption, hashing, tokens
│
└── shared/                 # Shared Layer (Cross-cutting)
    ├── constants/          # Application constants
    ├── errors/             # Error types & handlers
    ├── types/              # Common TypeScript types
    └── utils/              # Pure utility functions
```
```

### Step 9.3: Create Architecture Decision Record

```powershell
# Create ADR directory
New-Item -ItemType Directory -Path "docs\adr" -Force

# Create ADR for this refactoring
@"
# ADR 001: Architecture Layer Cleanup

## Status
Accepted

## Context
The initial architecture had several violations of clean architecture principles:
- Domain layer had infrastructure dependencies
- Repository implementations in domain layer
- Business logic in shared layer
- Inconsistent organization

## Decision
We refactored the codebase to strictly follow clean architecture:
1. Moved all infrastructure concerns out of domain layer
2. Moved repository implementations to infrastructure
3. Cleaned up shared layer to contain only cross-cutting concerns
4. Organized infrastructure layer consistently

## Consequences
### Positive
- True clean architecture with proper dependency flow
- Domain layer is now pure business logic
- Better maintainability and testability
- Clearer separation of concerns

### Negative
- Required updating many import paths
- Some files moved multiple times
- Temporary build errors during refactoring

## Date
$(Get-Date -Format "yyyy-MM-dd")
"@ | Out-File -FilePath "docs\adr\001-architecture-layer-cleanup.md" -Encoding utf8
```

---


## Phase 10: Commit and Review

### Priority: CRITICAL | Estimated Time: 10 minutes

### Step 10.1: Review Changes

```powershell
# See all changed files
git status

# Review the diff
git diff

# Check for any untracked files that should be added
git add .
```

### Step 10.2: Commit Changes

```powershell
# Commit with detailed message
git commit -m "refactor: clean architecture layer violations

BREAKING CHANGES:
- Moved webhook repository implementation to infrastructure layer
- Moved notification providers to infrastructure layer
- Moved mail templates and providers to infrastructure layer
- Moved webhook delivery services to application layer
- Removed duplicate circuit breaker files
- Consolidated database schemas
- Organized circuit breaker decorators
- Flattened repository structure
- Removed empty integration layer
- Enhanced shared layer with types and constants

Fixes:
- Domain layer no longer depends on infrastructure
- Repository implementations properly in infrastructure
- Business logic removed from shared layer
- Consistent infrastructure organization

All imports updated and tests passing."
```

### Step 10.3: Create Pull Request

```powershell
# Push to remote
git push origin refactor/architecture-cleanup

# Create PR (if using GitHub CLI)
gh pr create --title "Architecture Cleanup: Fix Layer Violations" `
             --body "See REFACTORING_GUIDE.md for detailed changes"
```

---


## Complete Execution Script

### All-in-One PowerShell Script

For convenience, here's a complete script that executes all critical phases:

```powershell
# ============================================================================
# ARCHITECTURE REFACTORING - COMPLETE EXECUTION SCRIPT
# ============================================================================
# Run this script from the project root directory
# Estimated time: 2-3 hours (including verification)
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Architecture Refactoring Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Backup current state
Write-Host "[1/10] Creating backup..." -ForegroundColor Yellow
git add .
git commit -m "Pre-refactoring checkpoint"
git branch backup-before-refactoring
git checkout -b refactor/architecture-cleanup

# Phase 1: Domain Layer Fixes
Write-Host "[2/10] Fixing domain layer violations..." -ForegroundColor Yellow

# Move webhook repository
Move-Item -Path "src\domain\repositories\webhook.repository.impl.ts" `
          -Destination "src\infrastructure\repositories\webhook.repository.ts" -Force

# Move notification providers
New-Item -ItemType Directory -Path "src\infrastructure\notifications" -Force
New-Item -ItemType Directory -Path "src\infrastructure\notifications\channels" -Force
New-Item -ItemType Directory -Path "src\infrastructure\notifications\providers" -Force

Move-Item -Path "src\domain\notifications\channels\*" `
          -Destination "src\infrastructure\notifications\channels\" -Force
Move-Item -Path "src\domain\notifications\providers\*" `
          -Destination "src\infrastructure\notifications\providers\" -Force

Remove-Item -Path "src\domain\notifications" -Recurse -Force

# Phase 2: Shared Layer Cleanup
Write-Host "[3/10] Cleaning up shared layer..." -ForegroundColor Yellow

# Remove duplicate circuit breaker
if (Test-Path "src\shared\email") {
    Remove-Item "src\shared\email" -Recurse -Force
}

# Move webhook services
Move-Item -Path "src\shared\webhook\webhook-delivery.factory.ts" `
          -Destination "src\application\services\webhook-delivery.factory.ts" -Force
Move-Item -Path "src\shared\webhook\webhook-delivery.service.impl.ts" `
          -Destination "src\application\services\webhook-delivery.service.impl.ts" -Force
Move-Item -Path "src\shared\webhook\index.ts" `
          -Destination "src\application\services\webhook-delivery.index.ts" -Force
Remove-Item -Path "src\shared\webhook" -Recurse -Force

# Move mail infrastructure
New-Item -ItemType Directory -Path "src\infrastructure\mail" -Force
New-Item -ItemType Directory -Path "src\infrastructure\mail\providers" -Force
New-Item -ItemType Directory -Path "src\infrastructure\mail\templates" -Force

Move-Item -Path "src\shared\mail\providers\*" `
          -Destination "src\infrastructure\mail\providers\" -Force
Move-Item -Path "src\shared\mail\templates\*" `
          -Destination "src\infrastructure\mail\templates\" -Recurse -Force
Remove-Item -Path "src\shared\mail" -Recurse -Force

# Phase 3: Infrastructure Organization
Write-Host "[4/10] Organizing infrastructure layer..." -ForegroundColor Yellow

# Consolidate schemas
if (Test-Path "src\infrastructure\persistence\schemas\*") {
    Move-Item -Path "src\infrastructure\persistence\schemas\*" `
              -Destination "src\infrastructure\database\schema\" -Force
}
if (Test-Path "src\infrastructure\persistence\sessions.schema.ts") {
    Move-Item -Path "src\infrastructure\persistence\sessions.schema.ts" `
              -Destination "src\infrastructure\database\schema\sessions.schema.ts" -Force
}
if (Test-Path "src\infrastructure\persistence") {
    Remove-Item -Path "src\infrastructure\persistence" -Recurse -Force
}

# Organize circuit breakers
New-Item -ItemType Directory -Path "src\infrastructure\resilience\decorators" -Force
Move-Item -Path "src\infrastructure\oauth.service.with-circuit-breaker.ts" `
          -Destination "src\infrastructure\resilience\decorators\oauth.service.with-circuit-breaker.ts" -Force
Move-Item -Path "src\application\email\email.service.with-circuit-breaker.ts" `
          -Destination "src\infrastructure\resilience\decorators\email.service.with-circuit-breaker.ts" -Force

# Flatten repositories
Move-Item -Path "src\infrastructure\repositories\compliance\audit-log.repository.ts" `
          -Destination "src\infrastructure\repositories\audit-log.repository.ts" -Force
Remove-Item -Path "src\infrastructure\repositories\compliance" -Recurse -Force

# Phase 4: Remove Integration Layer
Write-Host "[5/10] Removing empty integration layer..." -ForegroundColor Yellow
Remove-Item -Path "src\integration" -Recurse -Force

# Phase 5: Enhance Shared Layer
Write-Host "[6/10] Enhancing shared layer..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "src\shared\types" -Force
New-Item -ItemType Directory -Path "src\shared\constants" -Force
New-Item -ItemType Directory -Path "src\shared\utils" -Force

# Phase 6: Update Imports
Write-Host "[7/10] Updating import paths..." -ForegroundColor Yellow

function Update-Imports {
    param([string]$OldPath, [string]$NewPath)
    Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $updated = $content -replace [regex]::Escape($OldPath), $NewPath
        if ($content -ne $updated) {
            Set-Content -Path $_.FullName -Value $updated -NoNewline
        }
    }
}

Update-Imports -OldPath "from '../../shared/mail/providers/nodemailer-provider.js'" `
               -NewPath "from '../../infrastructure/mail/providers/nodemailer-provider.js'"
Update-Imports -OldPath "join(__dirname, '../../shared/mail/templates')" `
               -NewPath "join(__dirname, '../../infrastructure/mail/templates')"

# Phase 7: Verification
Write-Host "[8/10] Running type check..." -ForegroundColor Yellow
npm run typecheck

Write-Host "[9/10] Building project..." -ForegroundColor Yellow
npm run build

Write-Host "[10/10] Running tests..." -ForegroundColor Yellow
npm test

# Final
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Refactoring Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review changes: git status" -ForegroundColor White
Write-Host "2. Fix any remaining import errors" -ForegroundColor White
Write-Host "3. Commit: git commit -m 'refactor: clean architecture'" -ForegroundColor White
Write-Host "4. Push: git push origin refactor/architecture-cleanup" -ForegroundColor White
```

---


## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Import Path Errors After Moving Files

**Symptom**: TypeScript errors like "Cannot find module"

**Solution**:
```powershell
# Find all files importing the old path
Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | 
    Select-String -Pattern "old/path/here" | 
    Select-Object -ExpandProperty Path -Unique

# Update each file manually or use the Update-Imports function
```

#### Issue 2: Circular Dependency Errors

**Symptom**: "Circular dependency detected" warnings

**Solution**:
- Check if moved files create circular imports
- Use `type` imports for type-only dependencies:
  ```typescript
  import type { SomeType } from './module';
  ```

#### Issue 3: Build Fails After Moving Templates

**Symptom**: Template files not found at runtime

**Solution**:
```powershell
# Ensure templates are copied to dist folder
# Update tsconfig.json or package.json build script
# Add to package.json:
"build": "tsc && cp -r src/infrastructure/mail/templates dist/infrastructure/mail/"
```

For Windows PowerShell:
```powershell
# Add to package.json:
"build": "tsc && xcopy /E /I src\\infrastructure\\mail\\templates dist\\infrastructure\\mail\\templates"
```

#### Issue 4: Tests Fail After Refactoring

**Symptom**: Test imports broken

**Solution**:
```powershell
# Update test files
Get-ChildItem -Path "src" -Filter "*.test.ts" -Recurse | ForEach-Object {
    # Update imports in test files
    $content = Get-Content $_.FullName -Raw
    # Apply same import updates as source files
}
```

#### Issue 5: DI Container Registration Errors

**Symptom**: "Cannot resolve dependency" errors

**Solution**:
- Check `src/infrastructure/container/container.ts`
- Update registration paths for moved services
- Ensure all implementations are registered

---

## Post-Refactoring Checklist

### Immediate (Day 1)
- [ ] All TypeScript errors resolved
- [ ] Project builds successfully
- [ ] All tests pass
- [ ] Linter passes
- [ ] Application starts without errors
- [ ] Manual smoke testing completed

### Short-term (Week 1)
- [ ] Update documentation
- [ ] Update architecture diagrams
- [ ] Team review completed
- [ ] Merge to main branch
- [ ] Deploy to staging environment
- [ ] Monitor for runtime errors

### Long-term (Month 1)
- [ ] No regression issues reported
- [ ] Team comfortable with new structure
- [ ] Update onboarding documentation
- [ ] Consider additional improvements

---

## Benefits After Refactoring

### Architectural Benefits
1. ✅ **True Clean Architecture** - Proper dependency flow
2. ✅ **Domain Purity** - No infrastructure dependencies
3. ✅ **Better Testability** - Easier to mock dependencies
4. ✅ **Improved Maintainability** - Clear separation of concerns
5. ✅ **Scalability** - Easier to add new features

### Developer Experience Benefits
1. ✅ **Clearer Structure** - Easy to find files
2. ✅ **Consistent Organization** - Predictable patterns
3. ✅ **Better IDE Support** - Proper import suggestions
4. ✅ **Reduced Confusion** - No duplicate files
5. ✅ **Easier Onboarding** - Clear architecture

### Technical Benefits
1. ✅ **Faster Builds** - No circular dependencies
2. ✅ **Better Tree Shaking** - Cleaner imports
3. ✅ **Improved Type Safety** - Proper type boundaries
4. ✅ **Easier Refactoring** - Clear dependencies
5. ✅ **Better Testing** - Isolated layers

---

## Metrics to Track

### Before Refactoring
- Domain layer files with infrastructure imports: **~15 files**
- Repository implementations in domain: **1 file**
- Business logic in shared: **3 files**
- Duplicate files: **2 files**
- Empty folders: **~10 folders**

### After Refactoring
- Domain layer files with infrastructure imports: **0 files** ✅
- Repository implementations in domain: **0 files** ✅
- Business logic in shared: **0 files** ✅
- Duplicate files: **0 files** ✅
- Empty folders: **0 folders** ✅

### Code Quality Metrics
- Architecture violations: **0** ✅
- Layer dependency violations: **0** ✅
- Circular dependencies: **0** ✅
- Consistent organization: **100%** ✅

---

## Additional Resources

### Clean Architecture References
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)

### TypeScript Best Practices
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### Node.js Architecture
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Bulletproof Node.js Architecture](https://softwareontheroad.com/ideal-nodejs-project-structure/)

---

## Conclusion

This refactoring guide provides a comprehensive, step-by-step approach to fixing all architectural violations in your enterprise authentication system. By following these steps, you will:

1. **Eliminate all domain layer violations**
2. **Clean up the shared layer**
3. **Organize infrastructure consistently**
4. **Remove duplicate and empty code**
5. **Achieve true clean architecture**

The refactoring is **low-risk** because it primarily involves moving files and updating imports. The project will be **more maintainable**, **easier to test**, and **follow industry best practices** after completion.

**Estimated Total Time**: 2-3 hours
**Risk Level**: Low
**Benefit**: High
**Recommended**: Yes - Do it now!

---

**Document Version**: 1.0
**Last Updated**: December 4, 2025
**Author**: Architecture Analysis Team
**Status**: Ready for Execution
