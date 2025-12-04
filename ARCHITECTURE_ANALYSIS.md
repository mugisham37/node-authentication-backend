# Enterprise Authentication System - Architecture Analysis

## Executive Summary

This is a **well-structured enterprise authentication system** following **Clean Architecture** principles with clear separation of concerns. The project demonstrates professional-grade organization with 4 distinct layers. However, there are **several architectural violations and misplacements** that need correction to achieve true clean architecture.

**Overall Grade: B+ (85/100)**
- Strong foundation and clear intent
- Some layer boundary violations
- Minor organizational improvements needed

---

## Architecture Overview

### Current Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Presentation)              │
│  Controllers, Routes, Validators, Serializers, WebSocket│
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Application Layer                       │
│     Services, Use Cases, Email Factory, Event Listeners │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    Domain Layer                          │
│  Entities, Value Objects, Events, Repository Interfaces │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Infrastructure Layer                      │
│  Database, Cache, Queue, Security, Monitoring, Providers│
└─────────────────────────────────────────────────────────┘
```

### Additional Layers
- **Integration Layer**: External service integrations (email, storage, biometric providers)
- **Shared Layer**: Cross-cutting concerns (errors, utilities)

---

## Detailed Layer Analysis

### 1. API Layer (`src/api/`)

**Purpose**: HTTP/WebSocket presentation concerns

#### Structure
```
api/
├── common/
│   ├── pagination/          ✅ Correct
│   ├── serializers/         ✅ Correct
│   └── versioning/          ✅ Correct (empty but prepared)
└── rest/
    ├── presentation/
    │   ├── controllers/     ✅ Correct
    │   ├── routes/          ✅ Correct
    │   ├── schemas/         ✅ Correct
    │   └── validators/      ✅ Correct
    └── websocket/           ✅ Correct
```

#### Assessment: ✅ **EXCELLENT**
- Clean separation of REST and WebSocket concerns
- Proper organization of controllers, routes, validators
- Serializers correctly transform domain entities to API responses
- Pagination helpers are presentation concerns (correct placement)

#### Recommendations
- Consider renaming `api/rest/presentation` to just `api/rest` (redundant nesting)
- The `versioning` folder is empty - implement or remove

---

### 2. Application Layer (`src/application/`)

**Purpose**: Business use cases and orchestration

#### Structure
```
application/
├── email/
│   ├── email.service.impl.ts           ✅ Correct
│   ├── email.factory.ts                ✅ Correct
│   ├── email.service.with-circuit-breaker.ts  ⚠️ Questionable
│   └── email.config.example.ts         ✅ Correct
└── services/
    ├── compliance/
    │   ├── audit-log.service.ts        ✅ Correct
    │   └── risk-assessment.service.ts  ✅ Correct
    ├── authentication.service.ts       ✅ Correct
    ├── authorization.service.ts        ✅ Correct
    ├── device.service.ts               ✅ Correct
    ├── mfa.service.ts                  ✅ Correct
    ├── notification.service.ts         ✅ Correct
    ├── oauth.service.ts                ✅ Correct
    ├── session.service.ts              ✅ Correct
    ├── token.service.ts                ✅ Correct
    ├── user.service.ts                 ✅ Correct
    ├── webhook.service.ts              ✅ Correct
    └── ... (other services)            ✅ Correct
```

#### Assessment: ✅ **VERY GOOD**
- Services properly orchestrate domain logic
- Good separation of concerns (auth, authz, MFA, etc.)
- Compliance services properly grouped

#### Issues Found
⚠️ **Circuit breaker decorators in application layer**
- `email.service.with-circuit-breaker.ts` in `application/email/`
- These are infrastructure concerns, not application logic

#### Recommendations
1. Move circuit breaker wrappers to infrastructure layer
2. Consider using dependency injection to swap implementations
3. The `email/` subfolder is good - consider similar grouping for other complex services

---

### 3. Domain Layer (`src/domain/`)

**Purpose**: Pure business logic, no external dependencies

#### Structure
```
domain/
├── entities/                    ✅ Correct
│   ├── user.entity.ts
│   ├── session.entity.ts
│   ├── role.entity.ts
│   └── ... (8 entities)
├── value-objects/               ✅ Correct
│   ├── email.value-object.ts
│   ├── password.value-object.ts
│   └── ... (5 value objects)
├── events/                      ✅ Correct
│   ├── domain-event.ts
│   ├── event-emitter.ts
│   └── ... (event types)
├── repositories/                ⚠️ MIXED
│   ├── *.repository.interface.ts    ✅ Correct
│   └── webhook.repository.impl.ts   ❌ WRONG LAYER
└── notifications/               ❌ WRONG LAYER
    ├── channels/                ❌ Infrastructure concern
    ├── providers/               ❌ Infrastructure concern
    │   ├── sendgrid.provider.ts
    │   ├── twilio.provider.ts
    │   └── ses.provider.ts
    └── templates/               ⚠️ Could be shared
```

#### Assessment: ⚠️ **NEEDS IMPROVEMENT**

#### Critical Issues

**❌ VIOLATION #1: Repository Implementation in Domain**
- File: `src/domain/repositories/webhook.repository.impl.ts`
- **Problem**: Concrete implementation with Drizzle ORM imports
- **Impact**: Domain layer depends on infrastructure (database)
- **Solution**: Move to `src/infrastructure/repositories/`

**❌ VIOLATION #2: Notification Providers in Domain**
- Files: `src/domain/notifications/providers/*.provider.ts`
- **Problem**: Concrete implementations of SendGrid, Twilio, SES, SMTP
- **Impact**: Domain layer imports from infrastructure (logger, external SDKs)
- **Evidence**: 
  ```typescript
  import { logger } from '../../../infrastructure/logging/logger.js';
  import { Twilio } from 'twilio';
  import sgMail from '@sendgrid/mail';
  ```
- **Solution**: Move entire `notifications/` folder to infrastructure

**❌ VIOLATION #3: Infrastructure Dependencies**
- Domain layer should NEVER import from infrastructure
- Found: Multiple providers importing `infrastructure/logging/logger.js`

#### Recommendations

**CRITICAL - Must Fix:**
1. **Move** `domain/repositories/webhook.repository.impl.ts` → `infrastructure/repositories/`
2. **Move** `domain/notifications/` → `infrastructure/notifications/`
3. Keep only interfaces in domain layer

**After Refactoring:**
```
domain/
├── entities/
├── value-objects/
├── events/
└── repositories/
    └── *.repository.interface.ts  (interfaces only)
```

---

### 4. Infrastructure Layer (`src/infrastructure/`)

**Purpose**: External integrations and technical implementations

#### Structure
```
infrastructure/
├── cache/                       ✅ Correct
├── config/                      ✅ Correct
├── container/                   ✅ Correct (DI)
├── database/                    ✅ Correct
│   ├── connections/
│   ├── migrations/
│   ├── schema/
│   └── query-optimizer.ts
├── logging/                     ✅ Correct
├── middleware/                  ✅ Correct
│   ├── authentication.middleware.ts
│   ├── authorization.middleware.ts
│   ├── audit-logging.middleware.ts
│   └── ... (8 middleware)
├── monitoring/                  ✅ Correct
│   ├── health.ts
│   ├── metrics.ts
│   ├── tracing.ts
│   └── alerting.service.ts
├── persistence/                 ⚠️ Redundant?
│   └── schemas/
├── providers/                   ✅ Correct
│   ├── github/
│   ├── google/
│   ├── microsoft/
│   └── sms/
├── queue/                       ✅ Correct
│   ├── compliance/
│   ├── jobs/
│   ├── processors/
│   └── *-queue.ts
├── rate-limit/                  ✅ Correct
├── repositories/                ✅ Correct
│   ├── compliance/
│   │   └── audit-log.repository.ts
│   ├── device.repository.ts
│   ├── permission.repository.ts
│   └── ... (5 repositories)
├── resilience/                  ✅ Correct
│   ├── circuit-breaker.ts
│   └── retry.ts
├── security/                    ✅ Correct
│   ├── certificates/
│   ├── encryption/
│   ├── hashing/
│   ├── scanning/
│   └── tokens/
└── oauth.service.with-circuit-breaker.ts  ⚠️ Misplaced
```

#### Assessment: ✅ **EXCELLENT** (with minor issues)

#### Issues Found

**⚠️ Issue #1: Redundant `persistence/` folder**
- Contains `schemas/` subfolder
- Database schemas already in `database/schema/`
- **Recommendation**: Consolidate into `database/schema/` or clarify distinction

**⚠️ Issue #2: File at root level**
- `oauth.service.with-circuit-breaker.ts` at infrastructure root
- **Recommendation**: Move to `infrastructure/resilience/decorators/` or similar

**⚠️ Issue #3: Compliance subfolder in repositories**
- `repositories/compliance/audit-log.repository.ts`
- Other repositories are flat
- **Recommendation**: Either flatten all or group all by domain

#### Recommendations
1. Consolidate `persistence/` into `database/`
2. Create `resilience/decorators/` for circuit breaker wrappers
3. Standardize repository organization (flat vs grouped)

---

### 5. Integration Layer (`src/integration/`)

**Purpose**: Third-party service integrations

#### Structure
```
integration/
├── biometric-providers/
│   ├── common/              (empty)
│   └── webauthn/            (empty)
├── email-providers/
│   ├── common/              (empty)
│   ├── mailgun/             (empty)
│   ├── sendgrid/            (empty)
│   └── ses/                 (empty)
└── storage-providers/
    ├── common/              (empty)
    ├── aws/                 (empty)
    └── azure/               (empty)
```

#### Assessment: ⚠️ **PLACEHOLDER ONLY**

#### Issues
- **All folders are empty** - this is a prepared structure
- **Overlap with domain/notifications/providers** - same providers in two places
- **Overlap with infrastructure/providers** - OAuth providers there

#### Recommendations

**Option A: Consolidate into Infrastructure**
- Move all integration concerns to `infrastructure/providers/`
- Delete `integration/` layer
- Organize by provider type:
  ```
  infrastructure/providers/
  ├── email/
  │   ├── sendgrid/
  │   ├── ses/
  │   └── mailgun/
  ├── sms/
  │   └── twilio/
  ├── oauth/
  │   ├── google/
  │   ├── github/
  │   └── microsoft/
  ├── storage/
  │   ├── aws/
  │   └── azure/
  └── biometric/
      └── webauthn/
  ```

**Option B: Keep Integration Layer**
- Move providers from `domain/notifications/providers/` here
- Move providers from `infrastructure/providers/` here
- Make this the single source for all external integrations

**Recommendation**: **Option A** - Consolidate into infrastructure
- Simpler structure
- Integration is an infrastructure concern
- Avoids confusion about where to put new providers

---

### 6. Shared Layer (`src/shared/`)

**Purpose**: Cross-cutting utilities used by multiple layers

#### Structure
```
shared/
├── errors/                      ✅ Correct
│   ├── handlers/
│   ├── transformers/
│   └── types/
├── email/                       ❌ WRONG - Duplicate
│   └── email.service.with-circuit-breaker.ts
├── mail/                        ⚠️ Overlaps with application/email
│   ├── providers/
│   │   ├── nodemailer-provider.ts
│   │   └── template-renderer.ts
│   ├── queue/               (empty)
│   └── templates/
│       ├── layouts/
│       ├── sms/
│       └── *.hbs (11 templates)
└── webhook/                     ❌ WRONG - Business logic
    ├── webhook-delivery.factory.ts
    └── webhook-delivery.service.impl.ts
```

#### Assessment: ⚠️ **NEEDS CLEANUP**

#### Issues Found

**❌ Issue #1: Duplicate Circuit Breaker**
- `shared/email/email.service.with-circuit-breaker.ts`
- Same file exists in `application/email/`
- **Solution**: Remove from shared, keep in infrastructure

**❌ Issue #2: Business Logic in Shared**
- `webhook/webhook-delivery.service.impl.ts` is application logic
- **Solution**: Move to `application/services/`

**❌ Issue #3: Mail Templates Placement**
- Templates are infrastructure concerns (rendering)
- **Solution**: Move to `infrastructure/mail/templates/`

**❌ Issue #4: Nodemailer Provider**
- Provider implementation is infrastructure
- **Solution**: Move to `infrastructure/providers/email/`

#### Recommendations

**Shared layer should only contain:**
- Error types and handlers ✅
- Common types/interfaces
- Pure utility functions
- Constants

**Move out:**
1. `shared/email/` → DELETE (duplicate)
2. `shared/webhook/` → `application/services/`
3. `shared/mail/providers/` → `infrastructure/providers/email/`
4. `shared/mail/templates/` → `infrastructure/mail/templates/`

**After cleanup:**
```
shared/
├── errors/
│   ├── handlers/
│   ├── transformers/
│   └── types/
├── types/           (add common types)
├── constants/       (add constants)
└── utils/           (add pure utilities)
```

---

## Dependency Flow Analysis

### Current Dependencies (with violations)

```
API Layer
  ↓ depends on
Application Layer
  ↓ depends on
Domain Layer ← ❌ IMPORTS FROM Infrastructure (logger, SDKs)
  ↓ should depend on
Infrastructure Layer
```

### Correct Dependency Flow

```
API Layer
  ↓
Application Layer
  ↓
Domain Layer (NO DEPENDENCIES)
  ↑
Infrastructure Layer (implements domain interfaces)
```

### Violations Found

1. **Domain → Infrastructure**
   - `domain/notifications/providers/*.ts` imports `infrastructure/logging/logger.js`
   - `domain/notifications/providers/*.ts` imports external SDKs (Twilio, SendGrid)

2. **Shared → Application**
   - `shared/mail/providers/nodemailer-provider.ts` imports `application/services/email.service.js`

3. **Application → Infrastructure (acceptable but could be better)**
   - Circuit breaker wrappers in application layer

---

## Communication Patterns

### Current Patterns

1. **API → Application**: ✅ Direct service calls
2. **Application → Domain**: ✅ Uses entities and repositories
3. **Application → Infrastructure**: ✅ Through interfaces (mostly)
4. **Domain Events**: ✅ Event-driven for notifications
5. **Queue-based**: ✅ Background jobs for emails, webhooks, cleanup

### Strengths
- Good use of dependency injection (Awilix)
- Repository pattern properly used
- Event-driven architecture for notifications
- Circuit breaker pattern for resilience
- Queue-based processing for async operations

### Improvements Needed
- Domain should not know about infrastructure
- Use dependency injection for all cross-layer dependencies
- Consider CQRS pattern for complex queries

---

## Specific File Misplacements

### Must Move

| Current Location | Correct Location | Reason |
|-----------------|------------------|---------|
| `domain/repositories/webhook.repository.impl.ts` | `infrastructure/repositories/` | Concrete implementation |
| `domain/notifications/` (entire folder) | `infrastructure/notifications/` | Infrastructure concern |
| `shared/webhook/webhook-delivery.service.impl.ts` | `application/services/` | Business logic |
| `shared/mail/providers/` | `infrastructure/providers/email/` | Infrastructure |
| `shared/mail/templates/` | `infrastructure/mail/templates/` | Infrastructure |
| `application/email/email.service.with-circuit-breaker.ts` | `infrastructure/resilience/decorators/` | Infrastructure |
| `infrastructure/oauth.service.with-circuit-breaker.ts` | `infrastructure/resilience/decorators/` | Better organization |

### Should Delete

| File | Reason |
|------|--------|
| `shared/email/email.service.with-circuit-breaker.ts` | Duplicate of application/email version |
| `integration/` (entire folder if empty) | No implementation, causes confusion |

---

## Architectural Patterns Used

### ✅ Patterns Correctly Implemented

1. **Clean Architecture** - 4-layer separation (with violations noted)
2. **Repository Pattern** - Abstracts data access
3. **Dependency Injection** - Awilix container
4. **Circuit Breaker** - Resilience pattern
5. **Event-Driven** - Domain events for notifications
6. **Factory Pattern** - Email service factory
7. **Strategy Pattern** - Multiple notification providers
8. **Decorator Pattern** - Circuit breaker wrappers
9. **Queue Pattern** - BullMQ for background jobs
10. **Middleware Pattern** - Fastify middleware chain

### ⚠️ Patterns Partially Implemented

1. **CQRS** - Not implemented (could benefit complex queries)
2. **Saga Pattern** - Not implemented (could help distributed transactions)
3. **API Versioning** - Folder exists but empty

---

## Performance & Scalability Considerations

### Strengths
- ✅ Redis caching layer
- ✅ Connection pooling (PostgreSQL)
- ✅ Query optimization service
- ✅ Response compression
- ✅ ETag support
- ✅ Rate limiting
- ✅ Background job processing
- ✅ Circuit breakers prevent cascading failures

### Potential Bottlenecks
- ⚠️ No read replicas mentioned
- ⚠️ No database sharding strategy
- ⚠️ No CDN for static assets
- ⚠️ Webhook delivery could overwhelm if many webhooks

---

## Security Architecture

### Strengths
- ✅ Argon2id password hashing
- ✅ RS256 JWT tokens
- ✅ MFA support (TOTP, SMS)
- ✅ Device fingerprinting
- ✅ Audit logging
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ Input validation (Zod)
- ✅ CORS configuration
- ✅ WebAuthn support (prepared)

### Recommendations
- Consider adding API key rotation
- Implement token blacklisting for logout
- Add IP-based rate limiting
- Consider adding honeypot fields

---

## Testing Strategy

### Current Setup
- Vitest for unit tests
- Fast-check for property-based testing
- Testcontainers for integration tests
- Supertest for API tests

### Recommendations
- Add test coverage requirements (>80%)
- Add mutation testing
- Add load testing (k6, Artillery)
- Add security testing (OWASP ZAP)

---

## Monitoring & Observability

### Current Implementation
- ✅ Prometheus metrics
- ✅ Winston logging
- ✅ OpenTelemetry tracing
- ✅ Health checks
- ✅ Alerting service

### Recommendations
- Add distributed tracing visualization (Jaeger/Zipkin)
- Add log aggregation (ELK stack)
- Add APM (Application Performance Monitoring)
- Add error tracking (Sentry)

---

## Final Recommendations

### Priority 1: Critical Fixes (Must Do)

1. **Move `domain/repositories/webhook.repository.impl.ts`**
   ```bash
   mv src/domain/repositories/webhook.repository.impl.ts \
      src/infrastructure/repositories/webhook.repository.ts
   ```

2. **Move `domain/notifications/` to infrastructure**
   ```bash
   mv src/domain/notifications \
      src/infrastructure/notifications
   ```

3. **Remove duplicate circuit breaker from shared**
   ```bash
   rm src/shared/email/email.service.with-circuit-breaker.ts
   ```

4. **Move webhook delivery service**
   ```bash
   mv src/shared/webhook/* \
      src/application/services/
   ```

### Priority 2: Organizational Improvements (Should Do)

5. **Consolidate mail infrastructure**
   ```bash
   mv src/shared/mail/providers \
      src/infrastructure/providers/email
   mv src/shared/mail/templates \
      src/infrastructure/mail/templates
   ```

6. **Consolidate persistence schemas**
   ```bash
   mv src/infrastructure/persistence/schemas/* \
      src/infrastructure/database/schema/
   rmdir src/infrastructure/persistence
   ```

7. **Organize circuit breaker decorators**
   ```bash
   mkdir src/infrastructure/resilience/decorators
   mv src/infrastructure/oauth.service.with-circuit-breaker.ts \
      src/infrastructure/resilience/decorators/
   mv src/application/email/email.service.with-circuit-breaker.ts \
      src/infrastructure/resilience/decorators/
   ```

8. **Remove or implement integration layer**
   - If keeping: Move providers from domain and infrastructure here
   - If removing: Delete empty folders

### Priority 3: Enhancements (Nice to Have)

9. **Add missing shared utilities**
   - Create `shared/types/` for common types
   - Create `shared/constants/` for constants
   - Create `shared/utils/` for pure functions

10. **Implement API versioning**
    - Add v1, v2 folders in `api/common/versioning/`
    - Or remove the empty folder

11. **Standardize repository organization**
    - Either flatten all repositories
    - Or group all by domain (auth, compliance, etc.)

12. **Add CQRS pattern**
    - Separate read and write models for complex queries
    - Add `application/queries/` and `application/commands/`

---

## Conclusion

### What's Great
- ✅ Clear architectural intent with 4-layer separation
- ✅ Strong use of design patterns (Repository, Factory, Strategy, Circuit Breaker)
- ✅ Comprehensive security implementation
- ✅ Good monitoring and observability setup
- ✅ Professional-grade infrastructure (caching, queuing, resilience)
- ✅ Type-safe with TypeScript strict mode
- ✅ Well-organized API layer

### What Needs Fixing
- ❌ Domain layer has infrastructure dependencies (critical violation)
- ❌ Repository implementation in domain layer
- ❌ Notification providers in wrong layer
- ❌ Duplicate files in shared layer
- ❌ Business logic in shared layer
- ⚠️ Empty integration layer causing confusion
- ⚠️ Inconsistent organization in some areas

### Final Verdict

**This is a solid B+ architecture** that demonstrates strong understanding of clean architecture principles. The violations found are fixable and don't compromise the overall system quality. With the recommended changes, this would easily become an **A-grade architecture**.

The system is **production-ready** as-is, but implementing the Priority 1 fixes would make it **exemplary** and truly follow clean architecture principles.

**Estimated effort to fix all issues**: 4-8 hours
**Risk of refactoring**: Low (mostly moving files, updating imports)
**Benefit**: High (true clean architecture, better maintainability)

---

## Architecture Diagram

### Current State
```
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │Controllers│  │  Routes  │  │ Validators │  │Serializers│ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Application Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │  Auth    │  │   MFA    │  │  Webhooks  │  │  Email   │ │
│  │ Service  │  │ Service  │  │  Service   │  │ Service  │ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Domain Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Entities │  │  Value   │  │   Events   │  │Repository│ │
│  │          │  │ Objects  │  │            │  │Interfaces│ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
│  ❌ Notifications (should be in Infrastructure)             │
│  ❌ Webhook Repo Impl (should be in Infrastructure)         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Database │  │  Cache   │  │   Queue    │  │ Security │ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │Monitoring│  │  Logging │  │ Middleware │  │Resilience│ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Shared Layer                            │
│  ┌──────────┐  ❌ Email (duplicate)                         │
│  │  Errors  │  ❌ Webhook (business logic)                  │
│  └──────────┘  ❌ Mail (infrastructure)                     │
└─────────────────────────────────────────────────────────────┘
```

### Recommended State
```
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│  Controllers → Routes → Validators → Serializers             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Application Layer                          │
│  Services orchestrate domain logic and infrastructure        │
│  ✅ All business use cases here                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Domain Layer                             │
│  ✅ Pure business logic - NO external dependencies          │
│  ✅ Only interfaces, entities, value objects, events        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  ✅ All external integrations                               │
│  ✅ Notification providers                                  │
│  ✅ Repository implementations                              │
│  ✅ Mail templates and rendering                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Shared Layer                            │
│  ✅ Only: Errors, Types, Constants, Pure Utilities          │
└─────────────────────────────────────────────────────────────┘
```

---

**Generated**: December 4, 2025
**Analyst**: Kiro AI Architecture Analyzer
**Project**: Enterprise Authentication System v1.0.0
