# Feature Debt

Technical features and improvements that are partially implemented or need additional work.

## Owner → System User Linking

**Status:** Schema ready, needs UI/API work

**Current state:**
- `BulkProject.ownerId` field exists in Prisma schema with relation to `User`
- `ownerName` is stored as a string (denormalized)
- Owner is manually entered as text

**To complete:**
1. Update project upload page to:
   - Auto-fill owner from authenticated session (`session.user.id`)
   - Or provide dropdown to select from system users
2. Update project creation API to save `ownerId` alongside `ownerName`
3. Optionally: Display owner as clickable link or show avatar in projects table

**Effort:** Medium (2-4 hours)

**Files involved:**
- `src/app/projects/upload/page.tsx`
- `src/app/api/projects/route.ts`
- `prisma/schema.prisma` (already has the relation)
