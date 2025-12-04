# Architecture Refactoring - Quick Checklist

## Pre-Flight Checks
- [ ] Commit all current changes
- [ ] Create backup branch: `git branch backup-before-refactoring`
- [ ] Create refactoring branch: `git checkout -b refactor/architecture-cleanup`
- [ ] Verify project builds: `npm run build`
- [ ] Verify tests pass: `npm test`

---

## Phase 1: Domain Layer Fixes (CRITICAL)

### Move Webhook Repository
- [ ] Move `src\domain\repositories\webhook.repository.impl.ts` → `src\infrastructure\repositories\webhook.repository.ts`
- [ ] Update `src\domain\repositories\index.ts` to export only interface

### Move Notification Providers
- [ ] Create `src\infrastructure\notifications\` directory
- [ ] Move `src\domain\notifications\channels\*` → `src\infrastructure\notifications\channels\`
- [ ] Move `src\domain\notifications\providers\*` → `src\infrastructure\notifications\providers\`
- [ ] Delete `src\domain\notifications\` directory

---

## Phase 2: Shared Layer Cleanup (HIGH)

### Remove Duplicates
- [ ] Delete `src\shared\email\` directory (duplicate circuit breaker)

### Move Webhook Services
- [ ] Move `src\shared\webhook\webhook-delivery.factory.ts` → `src\application\services\`
- [ ] Move `src\shared\webhook\webhook-delivery.service.impl.ts` → `src\application\services\`
- [ ] Move `src\shared\webhook\index.ts` → `src\application\services\webhook-delivery.index.ts`
- [ ] Delete `src\shared\webhook\` directory

### Move Mail Infrastructure
- [ ] Create `src\infrastructure\mail\` directory structure
- [ ] Move `src\shared\mail\providers\*` → `src\infrastructure\mail\providers\`
- [ ] Move `src\shared\mail\templates\*` → `src\infrastructure\mail\templates\`
- [ ] Delete `src\shared\mail\` directory

---

## Phase 3: Infrastructure Organization (MEDIUM)

### Consolidate Schemas
- [ ] Move `src\infrastructure\persistence\schemas\*` → `src\infrastructure\database\schema\`
- [ ] Move `src\infrastructure\persistence\sessions.schema.ts` → `src\infrastructure\database\schema\`
- [ ] Delete `src\infrastructure\persistence\` directory

### Organize Circuit Breakers
- [ ] Create `src\infrastructure\resilience\decorators\` directory
- [ ] Move `src\infrastructure\oauth.service.with-circuit-breaker.ts` → `src\infrastructure\resilience\decorators\`
- [ ] Move `src\application\email\email.service.with-circuit-breaker.ts` → `src\infrastructure\resilience\decorators\`

### Flatten Repositories
- [ ] Move `src\infrastructure\repositories\compliance\audit-log.repository.ts` → `src\infrastructure\repositories\`
- [ ] Delete `src\infrastructure\repositories\compliance\` directory

---

## Phase 4: Integration Layer (MEDIUM)

- [ ] Delete `src\integration\` directory (all folders are empty)

---

## Phase 5: Enhance Shared Layer (LOW)

- [ ] Create `src\shared\types\` directory
- [ ] Create `src\shared\constants\` directory
- [ ] Create `src\shared\utils\` directory
- [ ] Create `src\shared\types\common.types.ts`
- [ ] Create `src\shared\constants\app.constants.ts`
- [ ] Update `src\shared\index.ts`

---

## Phase 6: Update Imports (CRITICAL)

### Automated Updates
- [ ] Run import update script for mail providers
- [ ] Run import update script for webhook repository
- [ ] Run import update script for circuit breakers
- [ ] Run import update script for compliance repositories

### Manual Updates
- [ ] Update `src\application\services\template.service.ts` (template path)
- [ ] Update `src\domain\repositories\index.ts` (export only interfaces)
- [ ] Update `src\infrastructure\index.ts` (circuit breaker exports)
- [ ] Update `src\application\email\index.ts` (if needed)

---

## Phase 7: Verification (CRITICAL)

- [ ] Run type check: `npm run typecheck`
- [ ] Fix any TypeScript errors
- [ ] Run build: `npm run build`
- [ ] Fix any build errors
- [ ] Run linter: `npm run lint`
- [ ] Fix any linting issues
- [ ] Run tests: `npm test`
- [ ] Fix any test failures
- [ ] Manual smoke test: Start application and test key features

---

## Phase 8: Cleanup (LOW)

- [ ] Remove empty directories
- [ ] Update README.md architecture section
- [ ] Create ADR document
- [ ] Update any architecture diagrams

---

## Phase 9: Commit and Review (CRITICAL)

- [ ] Review all changes: `git status`
- [ ] Review diff: `git diff`
- [ ] Stage all changes: `git add .`
- [ ] Commit with detailed message
- [ ] Push to remote: `git push origin refactor/architecture-cleanup`
- [ ] Create pull request
- [ ] Request team review

---

## Post-Refactoring Verification

### Immediate Checks
- [ ] Application starts without errors
- [ ] All API endpoints work
- [ ] Authentication flow works
- [ ] Database operations work
- [ ] Cache operations work
- [ ] Queue operations work
- [ ] Email sending works
- [ ] Webhook delivery works

### Code Quality Checks
- [ ] No circular dependencies
- [ ] No domain → infrastructure imports
- [ ] All repository implementations in infrastructure
- [ ] No business logic in shared layer
- [ ] Consistent file organization

### Documentation Checks
- [ ] README updated
- [ ] Architecture diagrams updated
- [ ] ADR created
- [ ] Team notified of changes

---

## Rollback Plan (If Needed)

If something goes wrong:

```powershell
# Abort current changes
git reset --hard HEAD

# Switch back to backup branch
git checkout backup-before-refactoring

# Or restore from specific commit
git checkout <commit-hash>
```

---

## Success Criteria

✅ **All checks must pass:**
- TypeScript compiles without errors
- All tests pass
- Application runs without errors
- No architectural violations remain
- Team approves changes

---

## Time Estimates

- Phase 1 (Domain): 30 minutes
- Phase 2 (Shared): 45 minutes
- Phase 3 (Infrastructure): 30 minutes
- Phase 4 (Integration): 15 minutes
- Phase 5 (Enhance): 20 minutes
- Phase 6 (Imports): 30 minutes
- Phase 7 (Verification): 30 minutes
- Phase 8 (Cleanup): 15 minutes
- Phase 9 (Commit): 10 minutes

**Total: 2-3 hours**

---

## Notes

- Execute phases sequentially
- Don't skip verification steps
- Commit after each major phase if desired
- Keep backup branch until confident
- Test thoroughly before merging

---

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete
**Started**: ___________
**Completed**: ___________
**Issues Encountered**: ___________
