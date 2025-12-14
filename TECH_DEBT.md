# Tech Debt Tracker

Last updated: 2025-12-14

## Priority Levels
- **P0**: Security/data risk - fix immediately
- **P1**: Bugs or significant UX issues - fix this sprint
- **P2**: Code quality issues - fix when touching related code
- **P3**: Nice to have - backlog

---

## P1: High Priority

### 1. No Rate Limiting on API Routes
**Files:** All `/src/app/api/*` routes
**Risk:** Cost explosion (Claude API), DoS vulnerability
**Fix:** Add rate limiting middleware (e.g., `@upstash/ratelimit` or custom Redis-based)
**Effort:** Medium

### 2. Browser `confirm()` and `alert()` Usage (40+ instances)
**Files:**
- `src/app/projects/page.tsx`
- `src/app/projects/[projectId]/page.tsx`
- `src/app/knowledge/page.tsx`
- `src/app/knowledge/from-url/page.tsx`
- `src/app/chat/page.tsx`
- `src/app/admin/settings/page.tsx`
- And others...

**Risk:** Poor UX, can't be styled, blocks main thread
**Fix:** Create a shared `<ConfirmModal>` and `<Toast>` component
**Effort:** Medium

### 3. Chat Page is 25,000+ Tokens (~1000+ lines)
**File:** `src/app/chat/page.tsx`
**Risk:** Unmaintainable, slow IDE performance
**Fix:** Extract into:
- `ChatSidebar.tsx`
- `ChatMessageList.tsx`
- `ChatInputArea.tsx`
- `useChatState.ts` (custom hook)

**Effort:** High

---

## P2: Medium Priority

### 4. Inline Styles Everywhere
**Files:** Most components use `style={{...}}`
**Risk:**
- Can't be cached by browser
- Creates new object refs on every render
- Inconsistent theming
- Hard to maintain

**Fix:** Migrate to CSS modules or consolidate to shared style objects
**Effort:** High (but can be done incrementally)

### 5. Duplicate Data Fetching Patterns
**Files:** Most page components
**Risk:** No caching, no loading states, code duplication
**Fix:** Use SWR or React Query, create shared data hooks
**Effort:** Medium

### 6. `getProgressStats()` Not Memoized
**File:** `src/app/projects/page.tsx:156-166`
**Risk:** Performance - iterates rows 7 times per project, called in `.map()` loops
**Fix:** Memoize with `useMemo` or pre-compute in a Map
**Effort:** Low

### 7. Duplicate `projectsWithFlaggedQuestions` Computation
**File:** `src/app/projects/page.tsx:202-204`
**Risk:** Same filter logic as `filteredProjects` when `statusFilter === "has_flagged"`
**Fix:** Derive from `filteredProjects` instead of recomputing
**Effort:** Low

### 8. Missing useEffect Dependencies (Suppressed with eslint-disable)
**File:** `src/app/chat/page.tsx:388`
```tsx
}, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps
```
**Risk:** Stale closures, bugs
**Fix:** Add missing deps or refactor to avoid the pattern
**Effort:** Low

### 9. Unused Variables in Project Page
**File:** `src/app/projects/[projectId]/page.tsx:382`
**Risk:** Dead code
**Fix:** Delete or use the variable
**Effort:** Low

---

## P3: Low Priority / Nice to Have

### 10. 28 API Routes Using `any` Type
**Files:** See grep for `any` in `src/app/api/`
**Risk:** Type safety bypassed
**Fix:** Define proper types for all API request/response bodies
**Effort:** Medium

### 11. Branding Loading State Not Used
**File:** `src/lib/branding.tsx`
```tsx
const [isLoading, setIsLoading] = useState(true);
// But isLoading is never consumed in UI
```
**Risk:** Flash of default content on slow connections
**Fix:** Show skeleton or loading state while branding loads
**Effort:** Low

### 12. Inconsistent Error Response Formats
**Files:** Various API routes
**Risk:** Frontend has to handle multiple error formats
**Fix:** Standardize on `{ error: string, code?: string }` format
**Effort:** Low

### 13. No Loading Spinners During Mutations
**Files:** Delete/approve buttons in project pages
**Risk:** User can double-click, no feedback
**Fix:** Add loading states to mutation buttons
**Effort:** Low

---

## Recently Fixed (2025-12-14)

- [x] ~~No auth on `/api/chat`~~ - Added `requireAuth()`
- [x] ~~No auth on GET `/api/skills`~~ - Added `requireAuth()`
- [x] ~~Prompt Builder link visible to non-admins on homepage~~ - Conditionally rendered
- [x] ~~SSRF protection allowed DNS resolution failures~~ - Now rejects on DNS failure
- [x] ~~Unused `defaultChallengePrompt` with eslint-disable~~ - Deleted
- [x] ~~Broken heading when `has_flagged` filter active~~ - Fixed conditional logic
- [x] ~~Summary cards couldn't toggle off~~ - Click again returns to "All"
- [x] ~~Redundant "Open" button in projects table~~ - Removed (row is clickable)

---

## How to Use This Document

1. **Before starting a feature:** Check if it touches files with tech debt
2. **During PR review:** Reference this for "while you're in there" improvements
3. **Sprint planning:** Pull P1 items into backlog
4. **After fixing:** Move items to "Recently Fixed" with date
