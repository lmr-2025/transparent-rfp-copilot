# Tech Debt Tracker

Last updated: 2025-12-14

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

### 10. Hardcoded Magic Numbers
**Files:** Multiple
**Evidence:**
- `.slice(0, 10000)` - unexplained limit
- `contextSize > 100000` - warning threshold
- `USER_INSTRUCTIONS_STORAGE_KEY = "grc-minion-user-instructions"`
**Fix:** Create `constants.ts` with named values
**Effort:** Low

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

### 15. Duplicate Business Logic
**File:** `src/app/knowledge/page.tsx` (lines 509-512, 594-597)
**Evidence:** Owner duplicate check logic repeated
**Fix:** Extract to utility function
**Effort:** Low

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

---

## How to Use This Document

1. **Before starting a feature:** Check if it touches files with tech debt
2. **During PR review:** Reference this for "while you're in there" improvements
3. **Sprint planning:** Pull P1 items into backlog
4. **After fixing:** Move items to "Recently Fixed" with date
