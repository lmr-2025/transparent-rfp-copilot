# Tech Debt Tracker

Last updated: 2025-12-20

## Priority Levels
- **P0**: Security/data risk - fix immediately
- **P1**: Bugs or significant UX issues - fix this sprint
- **P2**: Code quality issues - fix when touching related code
- **P3**: Nice to have - backlog

---

## Feature Flags Status

| Feature | Default | Status | Notes |
|---------|---------|--------|-------|
| `chat` | ON | POC | Works, needs streaming/WebSocket for production |
| `contracts` | OFF | Paused | Resume post-v1 |
| `customerProfiles` | OFF | POC | Links customers to projects |
| `usage` | ON | Ready | Production ready |
| `auditLog` | ON | Ready | Production ready |

### Hidden/Undocumented Endpoints (for future use)
- ~~`/api/skills/merge`~~ - Deleted 2025-12-15 (dead code, never called from UI)

---

## Legacy Code Deprecation Timeline

### Skill Normalization (`src/lib/skillStorage.ts`)
**Deprecation Date:** 2025-03-01

The `normalizeSkill()` function (148 lines) handles 5+ legacy data formats:
- `responseTemplate` field
- `sourceMapping[]` array
- `information.sources` nested field
- `lastSourceLink` single URL
- `category` (singular) → `categories` (array)

**Plan:**
1. After 2025-03-01, remove legacy field handling
2. Run migration script to update any remaining old-format skills
3. Simplify `normalizeSkill()` to ~20 lines

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

### 35. ✅ FIXED: Modal/Dialog System Consolidation
**Status:** Completed 2025-12-20
**Resolution:** All modals now use Radix UI Dialog. Migrated 7 modal components:
- `TransparencyModal` - Uses Dialog with Tailwind styling
- `FlagReviewModal` - Uses Dialog with Tailwind styling
- `PromptBuilderModal` - Uses Dialog with Tailwind styling
- `LibraryAnalysisModal` - Uses Dialog with Tailwind styling
- `CreatePresetModal` - Uses Dialog with Tailwind styling
- `EditPresetModal` - Uses Dialog with Tailwind styling
- `ConfirmModal` (+ PromptModal, TextareaPromptModal) - Uses Dialog with Tailwind styling

Removed deprecated `src/components/ui/modal.tsx`. Inline styles replaced with Tailwind classes throughout.

### 36. Type Inconsistencies - Deprecated Fields
**Files:** `src/types/skill.ts`, `src/types/customerProfile.ts`
**Issue:** Mixed use of singular `category` (string) vs plural `categories[]`. Multiple deprecated fields still defined:
- `sources[]` (use `sourceUrls` instead)
- `category` (use `categories[]` instead)
- `information` (kept for backwards compatibility)
- `lastSourceLink` (use `sourceUrls` instead)

**Evidence (skill.ts):**
```typescript
// Line 32: Legacy type
export type SkillCategory = string;

// Line 68: Deprecated field still in use
category?: SkillCategory; // Deprecated - use categories[] instead
```

**Risk:** Developer confusion, inconsistent data
**Fix:**
1. Remove deprecated type aliases
2. Run migration script for database records
3. Update all code to use `categories[]` exclusively

**Effort:** Medium (requires migration)

### ~~37. Hardcoded LLM Parameters~~ ✅ FIXED
**Fixed:** 2025-12-20
- Added `LLM_PARAMS` to `src/lib/config.ts` with `maxTokens` and `temperature.precise`/`temperature.balanced`
- Updated `src/lib/llm.ts` to use these constants in all 3 LLM calls

### ~~38. API Route Factory Error Pattern Mismatch~~ ✅ FIXED
**Fixed:** 2025-12-20
- Updated `src/lib/apiRouteFactory.ts` to import and use `errors` from `apiResponse.ts`
- Replaced all `errorResponse()` calls with `errors.internal()`, `errors.validation()`, `errors.notFound()`
- Removed the custom `errorResponse()` helper function

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

### 39. Missing Database Transactions
**Files:** Most mutation API endpoints
**Issue:** Only `src/app/api/customers/[id]/route.ts` uses transactions. Other critical mutations don't wrap operations in transactions.

**Risk:** Data inconsistency on partial failures
**Fix:**
1. Audit all multi-step mutation routes
2. Add `prisma.$transaction()` wrapping
3. Create reusable transaction helper

**Effort:** Medium

### 40. N+1 Query Audit Needed
**Files:** Various API routes with `findMany`
**Issue:** Some `findMany` queries may lack proper `include` relationships, causing N+1 queries.

**Risk:** Performance degradation at scale
**Fix:**
1. Add database query logging in development
2. Audit all `findMany` to ensure proper `include`/`select`
3. Consider query profiling tool

**Effort:** Medium

### 41. Validation Schema Duplication
**Files:** `src/lib/validations.ts`
**Issue:** Similar schema definitions exist separately:
- `sourceUrlItemSchema` vs `customerSourceUrlSchema`
- Repeated `quickFactSchema` union definitions

**Risk:** Inconsistent validation, maintenance burden
**Fix:**
1. Consolidate similar schema patterns
2. Create reusable schema builders
3. Document schema versioning for migrations

**Effort:** Low-Medium

### ~~42. Create UI Component Index~~ ✅ FIXED
**Fixed:** 2025-12-20
- Created `src/components/ui/index.ts` with exports for all 15 UI components
- Organized by category: Core (Button, Badge, Card, Input, etc.), Dialog, Modal, Loading, Status

### 6. Large Components - Refactoring Candidates

**Recently Refactored (2025-12-16):**
| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `projects/[projectId]/page.tsx` | 1995 | 1030 | -48% |
| `admin/settings/page.tsx` | 1563 | ~650 | -58% |
| `knowledge/add/page.tsx` | 1413 | 634 | -55% |
| `customers/add/page.tsx` | 1121 | 511 | -54% |
| `projects/questions/page.tsx` | 1071 | 657 | -39% |
| `chat/instruction-presets/page.tsx` | 934 | 389 | -58% |
| `knowledge/import/page.tsx` | 892 | 393 | -56% |
| `projects/upload/page.tsx` | 850 | 435 | -49% |
| `audit-log/page.tsx` | 820 | 232 | -72% |

**Remaining Candidates (400+ lines):**

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| `admin/prompt-library/components/BuilderTab.tsx` | 1,368 | High | Prompt builder - largest component |
| `accuracy/page.tsx` | 1,329 | High | Accuracy tracking dashboard |
| `projects/[projectId]/page.tsx` | 1,255 | High | Project detail page |
| `knowledge/page.tsx` | 1,081 | High | Knowledge library main page |
| `knowledge/documents/page.tsx` | 668 | Medium | Document management page |
| `lib/chatPromptLibrary.ts` | 618 | Low | Prompt definitions - may be intentional |
| `lib/promptBlocks.ts` | 605 | Low | Prompt blocks - may be intentional |
| `components/ConfirmModal.tsx` | 599 | Medium | Modal component with many variants |
| `customers/page.tsx` | 592 | Medium | Customer list page |
| `knowledge/page.tsx` | 586 | Medium | Knowledge library main page |
| `contracts/upload/page.tsx` | 568 | Medium | Contract upload wizard |
| `knowledge/components/knowledge-item-card.tsx` | 552 | Medium | Reusable card component |
| `lib/llm.ts` | 530 | Low | LLM utilities - may be intentional |
| `reviews/page.tsx` | 505 | Medium | Review inbox page |
| `contracts/[id]/page.tsx` | 496 | Medium | Contract detail page |
| `api/skills/analyze/route.ts` | 495 | Low | API route - complex logic |
| `admin/categories/page.tsx` | 493 | Medium | Category management |
| `components/PromptPreviewPanel.tsx` | 486 | Medium | Prompt preview component |
| `chat/page.tsx` | 470 | Low | Already uses Zustand stores |
| `components/ConversationalRefinement.tsx` | 468 | Medium | Chat refinement component |
| `usage/page.tsx` | 468 | Medium | Usage analytics page |
| `components/FlagReviewModal.tsx` | 460 | Medium | Review modal component |
| `lib/chatProjectTemplates.ts` | 433 | Low | Template definitions |
| `components/PromptBlocksEditor.tsx` | 432 | Medium | Editor component |
| `lib/apiRouteFactory.ts` | 408 | Low | Factory pattern - intentional |
| `components/VisualPromptEditor.tsx` | 407 | Medium | Visual editor component |
| `api/customers/build-from-docs/route.ts` | 406 | Low | API route - complex logic |

**Risk:** Unmaintainable, hard to test, slow IDE
**Fix:** Extract sub-components to separate files (follow pattern from recent refactors)
**Effort:** Medium per file (incremental)

**Note:** Files marked "Low" priority are often intentionally large (prompt libraries, utilities, API routes with complex logic). Focus on page components and UI components first.

### 7. Inline Styles Everywhere
**Files:** 20+ components use `style={{...}}`
**Risk:** No caching, new refs every render, inconsistent theming
**Fix:** Create shared component library with Tailwind or CSS modules
**Effort:** High (incremental)

### ~~8. 30+ useState Hooks in Chat Page~~ ✅ FIXED
**Status:** Reviewed 2025-12-15 - Chat page already refactored! Only 4 useState hooks remain (for modals). State management uses:
- `useChatStore` (Zustand) for messages, loading, sidebar state
- `useSelectionStore` (Zustand) for knowledge item selection
- React Query for data fetching

**Also Fixed:**
- `src/app/knowledge/bulk/page.tsx` - Extracted 10 useState hooks to `src/stores/bulk-import-store.ts`

### 9. No Pagination in Library Views (Deferred)
**File:** `src/app/knowledge/page.tsx`
**Status:** Partially mitigated - API supports pagination (limit/offset), but frontend loads all items
**Risk:** Memory issues at scale, slow renders with large libraries
**Mitigation in place:**
- API routes (`/api/skills`, `/api/documents`, etc.) support `limit`/`offset` params (100/500 default)
- React Query caches data efficiently
- Client-side filtering is fast for typical library sizes (hundreds of items)
**Full fix would require:**
- Install `react-window` or `@tanstack/react-virtual` for virtualized list rendering
- Add "Load more" or infinite scroll pagination in frontend
- Refactor list rendering to use virtualized component
**Effort:** Medium
**Priority:** Low until users report performance issues with very large libraries (1000+ items)

### ~~10. Hardcoded Magic Numbers~~ ✅ FIXED
**Status:** Already fixed - Created `src/lib/constants.ts` with named values (see "Recently Fixed" section).

### ~~11. Inconsistent API Response Formats~~ ✅ IN PROGRESS
**Status:** Core routes migrated (2025-12-15)
**Files:** Various API routes
**Migrated to `apiSuccess()` pattern:**
- `/api/documents` - `{ data: { documents: [...] } }`
- `/api/reference-urls` - `{ data: [...] }`
- `/api/customers` - `{ data: { profiles: [...] } }`
- `/api/customers/[id]` - `{ data: { profile: {...} } }` (GET, PUT, DELETE)
- `/api/skills` - `{ data: { skills: [...] } }`
- `/api/skills/[id]` - `{ data: { skill: {...} } }` (GET, PUT, DELETE)
- `/api/projects` - `{ data: { projects: [...] } }`
- `/api/projects/[id]` - `{ data: { project: {...} } }` (GET, PUT, DELETE)
- `/api/chat` - `{ data: { content: [...], usage: {...}, id: string } }`
- `/api/questions/answer` - `{ data: { answer, conversationHistory, usedFallback } }`
- `/api/reviews` - already migrated
- `/api/documents/[id]` - already migrated
- `/api/reference-urls/link` - already migrated

**Frontend hooks updated** to handle both old and new formats for backwards compatibility:
- `src/lib/skillStorage.ts` - `loadSkillsFromApi()`, `createSkillViaApi()`, `updateSkillViaApi()`
- `src/lib/projectApi.ts` - `fetchAllProjects()`, `fetchProject()`, `createProject()`, `updateProject()`
- `src/hooks/use-knowledge-data.ts` - already handled
- `src/components/ConversationalRefinement.tsx` - chat response handling

**Remaining routes** can be migrated incrementally (~40 routes still use direct `NextResponse.json`)

### 12. Missing Type Safety
**Status:** Input validation complete, response parsing still needed
**Files:** Multiple
**Evidence:** `as` casts without validation, missing Zod parsing on responses
**Note:** Input validation already comprehensive in `src/lib/validations.ts` with Zod schemas for all create/update operations. The remaining work is adding response schemas and parsing API responses in frontend hooks.
**Fix:** Add Zod response schemas and update frontend fetch hooks
**Effort:** Medium

---

## P3: Low Priority / Nice to Have

### ~~13. Missing API Documentation~~ ✅ PARTIAL FIX
**Fixed:** 2025-12-15
- Added comprehensive JSDoc documentation to key API routes:
  - `/api/skills` (GET, POST) - full parameter/response documentation
  - `/api/chat` (POST) - includes rate limit info, examples
  - `/api/customers` (GET, POST) - full parameter/response documentation
- Pattern established for other routes to follow
- Remaining routes can be documented incrementally when modified

### ~~14. Accessibility Issues~~ ✅ PARTIAL FIX
**Fixed:** 2025-12-15
- Added ARIA modal attributes (`role="dialog"`, `aria-modal`, `aria-labelledby`) to:
  - `TransparencyModal.tsx`
  - `PromptBuilderModal.tsx`
- Added `aria-expanded` and `aria-controls` to expandable sections:
  - `PromptBuilderModal.tsx` section headers
  - `SkillHistoryViewer.tsx` history toggle
  - `knowledge-sidebar.tsx` instructions section
  - `knowledge-item-card.tsx` expand/collapse button
- Added `aria-label` to icon-only buttons:
  - `chat-input.tsx` send button
  - `knowledge-item-card.tsx` (manage owners, expand, delete)
  - `knowledge-sidebar.tsx` selectable items with `aria-pressed`
- Added keyboard support (Enter/Space) to clickable divs:
  - `PromptBuilderModal.tsx` section headers
  - `SkillHistoryViewer.tsx` history toggle
- Added `htmlFor` label associations:
  - `SkillOwnerEditor.tsx` name/email inputs
  - `knowledge-sidebar.tsx` preset selector
- `ConfirmModal.tsx` already had proper ARIA attributes
- Remaining: Color-only status indicators (would need visual patterns)

### ~~15. Duplicate Business Logic~~ ✅ FIXED
**Status:** Already fixed - Owner logic extracted to `owner-management-dialog.tsx` component with `isOwner()` helper.

### ~~16. Remaining Tags Code to Remove~~ ✅ FIXED
**Fixed:** 2025-12-15
- CustomerProfile `tags` field removed from schema, types, APIs, and frontend pages
- Document model already uses `categories` (not `tags`) - no changes needed
- Skills `tags` field was removed earlier (2025-12-15)

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

### ~~18. Category Storage Sync~~ ✅ FIXED
**Fixed:** 2025-12-15
- Updated all pages to use `loadCategoriesFromApi()` with `useEffect` instead of sync `loadCategories()`
- Added loading states to category lists in `/admin/categories/page.tsx` and `/admin/settings/page.tsx`
- Updated `/knowledge/from-url/page.tsx`, `/knowledge/urls/add/page.tsx`, `/knowledge/documents/page.tsx`
- Categories now properly sync from API on page load

### ~~19. Audit Log Request Context~~ ✅ PARTIAL FIX
**Fixed:** 2025-12-15
- Added `getRequestContext(request)` helper to extract IP address and User-Agent from requests
- Supports multiple header formats: `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip` (Cloudflare)
- Updated all audit log helper functions to accept optional `requestContext` parameter
- Updated `/api/skills` POST route as example
- Other API routes can be updated incrementally to pass request context

### ~~20. Rate Limit In-Memory Fallback~~ ✅ FIXED
**Fixed:** 2025-12-15
- Added production warning when Redis not configured
- Logs `[RATE_LIMIT] Redis not configured in production...` on first use
- Warns about multi-instance deployment safety
- Development continues to work with in-memory fallback

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

#### ~~26. Sequential URL Fetching in API Routes~~ ✅ FIXED
**Fixed:** 2025-12-15
- Changed all URL fetching to use `Promise.all()` for parallel fetching:
  - `/api/skills/analyze` - `fetchSourceContent()` and `analyzeAndGroupUrls()`
  - `/api/skills/suggest` - `buildSourceMaterial()`
  - `/api/customers/suggest` - `buildSourceMaterial()`
  - `/api/context-snippets/suggest` - `buildSourceMaterial()`

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

#### ~~31. Console.log Used for Production Errors~~ ✅ FIXED
**Fixed:** 2025-12-15
- Created `src/lib/logger.ts` - lightweight structured logger
  - JSON output in production for log aggregation (Datadog, CloudWatch, etc.)
  - Human-readable output in development
  - Supports error serialization with stack traces
  - Child loggers for request-scoped context
- **All API routes migrated** - 0 `console.error` calls remaining in `/src/app/api`
- **Frontend cleanup (2025-12-15):** Replaced all user-facing console.error with toast notifications or silent failures
- **Lib utilities cleanup (2025-12-15):** Migrated remaining utilities to structured logger
  - `apiRouteFactory.ts` - 5 calls migrated with operation context
  - `auditLog.ts` - 1 call migrated with entity context
  - `apiResponse.ts` - 1 call migrated
  - `categoryStorageServer.ts` - 1 call migrated
  - `encryption.ts` - 1 call migrated
  - `usageTracking.ts` - 1 call migrated with feature/model context
  - `branding.tsx` - 1 call converted to silent failure (defaults work fine)
- **Remaining (intentional):** Only 3 `console.error` calls remain:
  - `logger.ts` (2 calls) - This IS the logger, wraps console.error by design
  - `error.tsx` (1 call) - Next.js error boundary, appropriate use

#### 32. Inconsistent Naming: BulkProject vs Project
**File:** `prisma/schema.prisma` (lines 78-105)
**Issue:** Model named `BulkProject` but represents any project
**Risk:** Confusing for new developers
**Fix:** Rename to `Project` (requires migration + code updates)
**Effort:** High

#### 33. eslint-disable Comments in API Route Factory
**File:** `src/lib/apiRouteFactory.ts` (5 instances)
**Issue:** Uses `@typescript-eslint/no-explicit-any` to work around Prisma's dynamic model access
**Pattern:** `(prisma as any)[model]` for generic CRUD operations
**Risk:** Type safety loss, potential runtime errors
**Fix Options:**
- Accept as necessary for generic route factory pattern
- Rewrite with proper generics and Prisma type inference
**Effort:** High (if rewriting)

#### 34. Unused Variable eslint-disable in Skills Route
**File:** `src/app/api/skills/route.ts` (line 87)
**Issue:** `// eslint-disable-next-line @typescript-eslint/no-unused-vars` for destructured `owner`
**Risk:** Minor - indicates potential cleanup opportunity
**Fix:** Remove unused destructuring or use the variable
**Effort:** Low

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
