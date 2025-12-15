# Tech Debt Tracker

Last updated: 2025-12-15

## Priority Levels
- **P0**: Security/data risk - fix immediately
- **P1**: Bugs or significant UX issues - fix this sprint
- **P2**: Code quality issues - fix when touching related code
- **P3**: Nice to have - backlog

---

## ✅ COMPLETED: UI Layer Rebuild

**Decision Date:** 2025-12-14
**Status:** Core pages migrated

### What Was Done
- ✅ **Chat page** - Rebuilt with React Query, shadcn/ui, extracted components
- ✅ **Projects list** - Rebuilt with React Query, extracted ProjectCard/ProjectsTable/StatusFilter
- ✅ **Knowledge library** - Rebuilt with React Query, tabs, category filter, owner management, bulk ops

### New Stack (in use)
- **UI Components:** shadcn/ui (Button, Card, Input, Select, Dialog)
- **Server State:** React Query (TanStack Query) via `use-knowledge-data.ts`, `use-project-data.ts`
- **Styling:** Tailwind CSS (replaces inline styles in migrated pages)

### Still Using Old Patterns (not migrated yet)
- `src/app/admin/settings/page.tsx` (1,317 lines, inline styles)
- `src/app/knowledge/bulk/page.tsx` (1,284 lines, inline styles)
- `src/app/projects/[projectId]/page.tsx` (1,236 lines, inline styles)
- `src/app/customers/add/page.tsx` (1,164 lines, inline styles)
- `src/app/customers/page.tsx` (inline styles, direct API calls)

---

## ✅ COMPLETED: Rate Limiting on API Routes

**Completed Date:** 2025-12-14

Added rate limiting using `@upstash/ratelimit` with Redis (falls back to in-memory for development).

**Routes with LLM rate limiting (10 req/min):**
- `/api/chat` - Main Claude API
- `/api/knowledge-chat` - Knowledge-based chat
- `/api/contracts/[id]/analyze` - Contract analysis
- `/api/skills/analyze` - URL skill analysis
- `/api/skills/analyze-rfp` - RFP skill analysis
- `/api/skills/suggest` - Skill draft generation
- `/api/questions/answer` - Question answering
- `/api/prompts/optimize` - Prompt optimization
- `/api/customers/analyze` - Customer profile analysis

**Rate limit tiers defined in `/src/lib/rateLimit.ts`:**
- `llm`: 10 requests/minute (expensive Claude calls)
- `standard`: 100 requests/minute (normal API routes)
- `auth`: 5 requests/minute (prevent brute force)
- `read`: 200 requests/minute (lenient read-only)

---

## ✅ COMPLETED: Fire-and-Forget localStorage Sync

**Completed Date:** 2025-12-14

Fixed fire-and-forget pattern in `categoryStorage.ts`:
- `addCategory()`, `updateCategory()`, `deleteCategory()` are now async
- API call happens first; if it fails, local state is not updated
- UI components updated with loading states and toast notifications
- Updated `/admin/categories/page.tsx` and `/admin/settings/page.tsx`

Note: `skillStorage.ts` already used proper async patterns (`createSkillViaApi`, etc.)
Note: `chatPromptLibrary.ts` uses localStorage only (instruction presets have their own API)

---

## ✅ COMPLETED: Standardized API Utilities

**Completed Date:** 2025-12-14

Created `/src/lib/apiResponse.ts` with standardized patterns:
- **Error responses:** `apiError()`, `errors.validation()`, `errors.notFound()`, etc. with consistent `{error: {code, message, details}}`
- **Success responses:** `apiSuccess()` with optional pagination/transparency metadata
- **Validation:** `parseAndValidate()` returns structured field-level errors
- **Route middleware:** `createRoute()` composable handler with auth + rate limiting

**Example route migrated:** `/api/context-snippets` now uses new pattern.

**Remaining routes can be migrated incrementally** - new pattern is opt-in and backwards compatible.

---

## P1: High Priority

### ~~17. Reference URLs Have No "Add" Page~~ ✅ FIXED
**Fixed:** 2025-12-15
- Created `/knowledge/urls/add` page for adding Reference URLs
- Updated links in `/knowledge/page.tsx` and `/knowledge/add/page.tsx`

### ~~3. Browser `alert()` Usage~~ ✅ FIXED
**Status:** All `alert()` calls replaced with `toast.success/error/info()` from sonner library.

### ~~3b. Browser `confirm()` Usage~~ ✅ FIXED
**Status:** All `confirm()` calls replaced with `<ConfirmModal>` component using `useConfirm` hook.

### ~~4. Sequential API Calls (Performance)~~ ✅ FIXED
**File:** `src/app/knowledge/page.tsx`
**Status:** Changed to `Promise.all()` for parallel fetching

### ~~5. Silent Error Handling~~ ✅ FIXED
**Status:** All `.catch(console.error)` calls replaced with `toast.error()` notifications.

---

## P2: Medium Priority

### 6. Large Components (>1000 lines)
**Files:**
- `src/app/admin/settings/page.tsx` (1,316 lines)
- `src/app/knowledge/bulk/page.tsx` (1,283 lines)
- `src/app/chat/components/ChatSidebar.tsx` (1,236 lines)
- `src/app/chat/page.tsx` (1,170 lines)

**Risk:** Unmaintainable, hard to test, slow IDE
**Fix:** Extract sub-components to separate files
**Effort:** High (incremental)

### 7. Inline Styles Everywhere
**Files:** 20+ components use `style={{...}}`
**Risk:** No caching, new refs every render, inconsistent theming
**Fix:** Create shared component library with Tailwind or CSS modules
**Effort:** High (incremental)

### 8. 30+ useState Hooks in Chat Page
**File:** `src/app/chat/page.tsx` (lines 49-86)
**Risk:** Prop drilling hell, hard to track state dependencies
**Fix:** Use Zustand or React Context for state management
**Effort:** High

### 9. No Pagination in Library Views
**File:** `src/app/knowledge/page.tsx`
**Risk:** Memory issues at scale, slow renders with large libraries
**Fix:** Implement server-side pagination, virtualization (react-window)
**Effort:** Medium

### ~~10. Hardcoded Magic Numbers~~ ✅ FIXED
**Status:** Already fixed - Created `src/lib/constants.ts` with named values (see "Recently Fixed" section).

### 11. Inconsistent API Response Formats
**Files:** Various API routes
**Evidence:**
- `/api/documents` returns `{ documents: [...] }`
- `/api/reference-urls` returns array directly
- `/api/customers` returns `{ profiles: [...] }`
**Fix:** Standardize to `{ success, data, error?, pagination? }`
**Effort:** Medium

### 12. Missing Type Safety
**Files:** Multiple
**Evidence:** `as` casts without validation, missing Zod parsing on responses
**Fix:** Use Zod for all API response parsing
**Effort:** Medium

---

## P3: Low Priority / Nice to Have

### 13. Missing API Documentation
**Files:** All API routes
**Fix:** Add JSDoc with input/output schemas, error codes, auth requirements
**Effort:** Low

### 14. Accessibility Issues
**Risk:** No ARIA labels, focus management in modals, color-only indicators
**Fix:** Audit and add accessibility features
**Effort:** Medium

### ~~15. Duplicate Business Logic~~ ✅ FIXED
**Status:** Already fixed - Owner logic extracted to `owner-management-dialog.tsx` component with `isOwner()` helper.

### 16. Remaining Tags Code to Remove
**Status:** Skills `tags` field removed (2025-12-15), but tag-related code exists elsewhere
**Files with `tags`:**
- `prisma/schema.prisma` - CustomerProfile has `tags String[]`, Document has `tags String[]`
- `src/lib/validations.ts` - Customer schemas still have tags validation
- `src/app/customers/` - Customer pages display/manage tags
- `src/app/knowledge/documents/` - Document pages may display tags

**Decision needed:** Are tags useful for CustomerProfile and Document, or should they be removed too?
**Fix:** If not useful, remove tags from remaining models following the Skill pattern
**Effort:** Medium (similar to Skill tags removal - ~20 files)

---

## Recently Fixed (2025-12-14)

### UI Migrations
- [x] ~~Chat page v1~~ - Migrated to React Query + shadcn/ui with extracted components
- [x] ~~Projects list v1~~ - Migrated to React Query + shadcn/ui with StatusFilter, ProjectCard, ProjectsTable
- [x] ~~Knowledge library v1~~ - Migrated to React Query + shadcn/ui with tabs, category filter, owner management, bulk operations
- [x] ~~Orphaned routes~~ - Deleted `/knowledge/unified-library`, `/knowledge/urls`, `/knowledge/library`, `/knowledge/categories`, `/knowledge/workflow`, `/customers/library` (~2000 lines dead code)

### Security & Quality
- [x] ~~Admin settings stored in plaintext~~ - Implemented AES-256-GCM encryption for sensitive values
- [x] ~~Sequential API calls in knowledge/page.tsx~~ - Changed to `Promise.all()` for 5x faster loading
- [x] ~~Hardcoded magic numbers~~ - Created `src/lib/constants.ts` with named values
- [x] ~~No toast library / alert() usage~~ - Installed `sonner`, replaced ALL alert() calls with toast notifications
- [x] ~~Chat page too large (2515 lines)~~ - Refactored to 1170 lines with extracted components
- [x] ~~Missing useEffect dependencies in chat page~~ - Used ref to track query param processing
- [x] ~~API Routes using `any` type~~ - Already fixed (no `any` types found)
- [x] ~~Inconsistent error response formats~~ - Already standardized to `{ error: string }`
- [x] ~~No auth on `/api/chat`~~ - Added `requireAuth()`
- [x] ~~No auth on GET `/api/skills`~~ - Added `requireAuth()`
- [x] ~~Prompt Builder link visible to non-admins on homepage~~ - Conditionally rendered
- [x] ~~SSRF protection allowed DNS resolution failures~~ - Now rejects on DNS failure
- [x] ~~Unused `defaultChallengePrompt` with eslint-disable~~ - Deleted
- [x] ~~Broken heading when `has_flagged` filter active~~ - Fixed conditional logic
- [x] ~~Summary cards couldn't toggle off~~ - Click again returns to "All"
- [x] ~~Redundant "Open" button in projects table~~ - Removed (row is clickable)
- [x] ~~`getProgressStats()` not memoized~~ - Pre-compute in useMemo with Map
- [x] ~~Duplicate `projectsWithFlaggedQuestions` computation~~ - Use `filteredProjects` instead
- [x] ~~Unused `handleChallenge` function with eslint-disable~~ - Deleted
- [x] ~~Branding loading state not used~~ - Show skeleton while loading
- [x] ~~No loading state on Delete button~~ - Added `deletingId` state
- [x] ~~Silent error handling (.catch(console.error))~~ - All replaced with toast.error() notifications
- [x] ~~Browser confirm() usage~~ - All 15 confirm() calls replaced with ConfirmModal component
- [x] ~~Browser prompt() usage~~ - All prompt() calls replaced with PromptModal/TextareaPromptModal components

---

## ~~P2: Broken/Stale Links~~ ✅ FIXED

### ~~Deleted Page Links~~
**Fixed:** 2025-12-15
- Fixed `/knowledge/urls` → `/knowledge/from-url` in `src/app/knowledge/add/page.tsx`
- Other deleted routes had no stale links in code

---

## ✅ COMPLETED: Critical Security & Performance Fixes (2025-12-15)

### Security Fixes Applied
- [x] **Auth on GET routes** - Added `requireAuth()` to `/api/customers`, `/api/documents`, `/api/projects`
- [x] **SSRF protection** - Added `validateUrlForSSRF()` to `fetchUrlContent()` in `apiHelpers.ts`
- [x] **File size limit** - Added 10MB limit to document upload in `/api/documents`

### Performance Fixes Applied
- [x] **N+1 query fix** - Project updates now use diff-based association updates (only add/remove changed)
- [x] **Row upsert** - Project row updates use `upsert` instead of delete-all-then-recreate
- [x] **Transaction wrapping** - Project updates wrapped in `$transaction()` for atomicity
- [x] **Pagination** - Added `limit`/`offset` params to skills (100/500), customers (100/500), documents (100/500), projects (50/200)
- [x] **Database index** - Added unique constraint on `BulkRow(projectId, rowNumber)` for efficient upserts

### Dead Code Removed
- [x] **Angel-tree models** - Removed `Item`, `Listing`, `Purchase` models (~75 lines)
- [x] **Angel-tree enums** - Removed `ItemCategory`, `ItemPriority`, `Retailer` enums
- [x] **Angel-tree code** - Deleted orphaned `angel-tree-actions.ts` and `seed.js`

### PowerPoint Support Added
- [x] **PPTX parsing** - Added `node-pptx-parser` with temp file handling
- [x] **Template generation** - "Save as Template" checkbox generates markdown templates via LLM

---

## ✅ REVIEWED: Not Over-Engineered (2025-12-15)

### Prompt Blocks System (~560 lines)
**Verdict:** Actually in active use - NOT over-engineered
- Used by 14+ API routes and pages
- Provides composable prompts with context-specific variants
- Supports admin UI for customization
- Value: Consistent prompts across different contexts

### Category Storage (localStorage + database)
**Verdict:** Intentional caching strategy - NOT a bug
- Database (via API) is the source of truth
- localStorage is cache for fast initial render
- All writes go through API first, then update cache
- **Minor issue:** Some pages use sync `loadCategories()` and never fetch from API

### Audit Log ipAddress/userAgent Fields
**Verdict:** Designed for future use - NOT a bug
- Schema supports these fields, `createAuditLog()` accepts them
- Helper functions don't pass them (would require request context threading)
- Value: Security auditing capability when needed

---

## P3: Remaining Items from Code Review

### 18. Category Storage Sync
**Issue:** Some pages use sync `loadCategories()` (localStorage) and never fetch from API
**Files:**
- `src/app/admin/categories/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/knowledge/from-url/page.tsx`
- `src/app/knowledge/urls/add/page.tsx`
- `src/app/knowledge/documents/page.tsx`
**Risk:** Categories created on one machine won't appear on another until manual refresh
**Fix:** Update pages to use `loadCategoriesFromApi()` via React Query hooks (like `use-chat-data.ts`)
**Effort:** Low-Medium

### 19. Audit Log Request Context
**Issue:** `ipAddress` and `userAgent` fields never populated
**Risk:** Reduced security audit trail
**Fix:** Thread request object through API handlers to audit functions, extract headers
**Effort:** Medium (requires touching all API routes that audit)

### 20. Rate Limit In-Memory Fallback
**Issue:** Rate limiting falls back to in-memory Map when Redis unavailable
**File:** `src/lib/rateLimit.ts`
**Risk:** Not production-safe for multi-instance deployments
**Fix:** Require Redis in production, or use distributed alternative
**Effort:** Low (configuration change)

---

## Code Review Findings (2025-12-15)

### ✅ Fixed During Review
- [x] **Missing auth on GET `/api/skills/[id]`** - Added `requireAuth()` to single skill endpoint

### P1: High Priority (New)

#### ~~21. Missing Rate Limiting on LLM Routes~~ ✅ FIXED
**Fixed:** 2025-12-15
- `/api/skills/merge` - Added rate limiting (customers/suggest already had it)

#### ~~22. Unbounded LLM Context Size~~ ✅ FIXED
**Fixed:** 2025-12-15
- Added `truncateContext()` helper to enforce `CONTEXT_LIMITS.MAX_CONTEXT` (100k chars)
- Knowledge context gets 60% budget, customer context gets 30% budget
- Response includes `contextTruncated` flag when truncation occurs
- Truncated content includes indicator message

#### ~~23. OAuth Secrets Unencrypted in Setup Route~~ ✅ FIXED
**Fixed:** 2025-12-15
- Added encryption for sensitive keys (matching admin settings pattern)
- Setup route now requires ENCRYPTION_KEY for secrets

### P2: Medium Priority (New)

#### ~~24. Unsafe Type Casts in Skill Update~~ ✅ REVIEWED
**Status:** Reviewed 2025-12-15 - The cast is appropriate since Prisma models are plain objects and `computeChanges()` only needs generic record access. Not a real issue.

#### ~~25. Unvalidated JSON.parse in Document Upload~~ ✅ FIXED
**Fixed:** 2025-12-15
- Added try-catch with proper error response
- Added type validation to ensure parsed value is string array

#### ~~26. Sequential URL Fetching in Analyze Route~~ ✅ FIXED
**Fixed:** 2025-12-15
- Changed `fetchSourceContent()` to use `Promise.all()` for parallel fetching
- 10 URLs now fetch concurrently instead of sequentially

#### ~~27. Missing URL Validation on Customer sourceUrls~~ ✅ FIXED
**Fixed:** 2025-12-15
- Changed `sourceUrls` from `z.array(z.string())` to `z.array(z.string().url())`
- Applied to both create and update schemas

#### ~~28. HTML Entity Decoding Incomplete~~ ✅ FIXED
**Fixed:** 2025-12-15
- Added numeric entity decoding (decimal `&#123;` and hex `&#x7B;`)
- Added more common named entities (&hellip;, &copy;, &reg;, &trade;, &bull;, &apos;, &lsquo;)

### P3: Low Priority (New)

#### 29. Deprecated SystemPrompt Model Still in Schema
**File:** `prisma/schema.prisma` (lines 248-258)
**Issue:** Comment says "DEPRECATED - use PromptBlock instead" but model still exists
**Risk:** Confusion, accidental use
**Fix:** Remove model and run migration
**Effort:** ~~Low~~ **Medium-High** - Model is still actively used by `/api/system-prompts` routes and `/api/contracts/[id]/analyze`. Requires data migration to PromptBlock and updating all API routes.

#### 30. Conversation History Stored as JSON Without Pagination
**File:** `prisma/schema.prisma` (line 442)
**Issue:** Chat messages stored as JSON array in single field. Long conversations could exceed limits
**Risk:** Database bloat, slow queries
**Fix:** Normalize to separate ChatMessage table with pagination
**Effort:** High

#### 31. Console.log Used for Production Errors
**Files:** Multiple API routes
**Issue:** Errors logged to `console.error` but no structured logging or alerting
**Risk:** Hard to monitor production issues
**Fix:** Add structured logging (winston/pino) with error tracking
**Effort:** Medium

#### 32. Inconsistent Naming: BulkProject vs Project
**File:** `prisma/schema.prisma` (lines 78-105)
**Issue:** Model named `BulkProject` but represents any project
**Risk:** Confusing for new developers
**Fix:** Rename to `Project` (requires migration + code updates)
**Effort:** High

---

## Feature Backlog (2025-12-15)

### ~~F1. Duplicate Usage Pages~~ ✅ FIXED
**Fixed:** 2025-12-15
- Deleted duplicate `src/app/admin/usage/page.tsx` (469 lines)
- Replaced with redirect to `/usage`
- Single usage page now serves both routes

### F2. Missing Export/Download for Knowledge Items
**Current State:** Projects have Excel export, but Skills/Documents/Reference URLs have no export
**User Need:** Ability to backup or migrate knowledge base
**Fix Options:**
- Add CSV/JSON export for each knowledge type
- Add bulk export for entire knowledge base
**Effort:** Medium

### F3. No Import for Skills
**Current State:** Documents have import, Reference URLs have bulk add, but Skills have no import
**User Need:** Migrate skills between environments or restore from backup
**Fix:** Add JSON/CSV import similar to document import
**Effort:** Medium

### F4. Chat History Search
**Current State:** Chat sessions listed in sidebar but not searchable
**User Need:** Find past conversations by content or topic
**Fix:** Add search input to ChatSidebar, query against messages JSON
**Effort:** Medium

### F5. Knowledge Item Versioning
**Current State:** Skills are overwritten on edit, no history
**User Need:** See what changed, revert bad edits
**Fix:** Store version history (simple: JSON changelog field, proper: separate Version table)
**Effort:** High

### F6. Bulk Edit for Knowledge Items
**Current State:** Can bulk delete, but not bulk edit (category, owner)
**User Need:** Reassign many items when owner leaves
**Fix:** Add "Edit Selected" option to bulk actions
**Effort:** Medium

### F7. Dashboard/Analytics Page
**Current State:** Usage shows API costs, but no business metrics
**User Need:** See question response times, confidence distribution, most-used skills
**Fix:** Add analytics dashboard with charts
**Effort:** High

### F8. Webhook/Integration for External Systems
**Current State:** Slack webhook exists for notifications
**User Need:** Trigger actions in other systems when answers are generated
**Fix:** Add configurable webhooks for events (answer_generated, skill_created, etc.)
**Effort:** High

### F9. Mobile-Responsive Design
**Current State:** Pages work on mobile but not optimized
**User Need:** Use on tablet during meetings
**Fix:** Add responsive breakpoints, test on mobile devices
**Effort:** Medium

### F10. Keyboard Shortcuts
**Current State:** Only Enter to submit in chat
**User Need:** Power users want shortcuts for common actions
**Fix:** Add keyboard shortcut system (Cmd+K for search, Cmd+N for new, etc.)
**Effort:** Medium

---

## How to Use This Document

1. **Before starting a feature:** Check if it touches files with tech debt
2. **During PR review:** Reference this for "while you're in there" improvements
3. **Sprint planning:** Pull P1 items into backlog
4. **After fixing:** Move items to "Recently Fixed" with date
