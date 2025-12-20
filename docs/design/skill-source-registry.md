# Skill-Source Registry Design

**Author:** Claude Code
**Created:** 2024-12-20
**Status:** In Progress
**Branch:** `feature/knowledge-library-organization`

---

## Problem Statement

The current data model for linking skills to their sources (URLs and documents) has several issues:

1. **Asymmetric relationships**: Skills store sources in JSON arrays (`sourceUrls`), but `ReferenceUrl` records only support a single `skillId` foreign key
2. **Non-queryable**: Can't efficiently answer "which skills use this URL?" without scanning all skills
3. **Data loss risk**: If a URL is used by multiple skills, only the last `skillId` is stored
4. **No independent source lifecycle**: Sources are tightly coupled to skills, making reuse difficult

## Goals

1. **Source Registry**: Sources (URLs, documents) exist independently and can be linked to multiple skills
2. **Portable Skills**: Skills remain self-contained for git sync (content + source metadata travels)
3. **GTM Use Cases**: Marketing/sales can browse and use sources directly
4. **Refresh Workflow**: Easy to refresh skills from their sources
5. **Future AWS Ready**: Architecture supports serverless deployment

## Design Decision: Why Option B (Source Registry)

We considered three options:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Simple cleanup - ask on delete | Minimal changes | Doesn't solve querying issues |
| B | **Source Registry with join table** | Full flexibility, queryable | More complex migration |
| C | Sources are ephemeral | Simple | Can't reuse sources, no refresh |

**Chose Option B because:**
- GTM needs direct access to sources
- Refresh workflow requires knowing all skills using a source
- Sources are "ingredients" that should be reusable
- Aligns with future AWS Lambda architecture (sources can be fetched/cached independently)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GIT REPOSITORY                            │
│  skills/*.md - Self-contained with embedded sourceUrls metadata │
│  (Portable to agentskills.io, AWS Lambda, etc.)                 │
└─────────────────────────────────────────────────────────────────┘
                              │ git sync
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL DATABASE                               │
│                                                                  │
│  ReferenceUrl          SkillSource (JOIN)        Skill          │
│  ├─ id                 ├─ skillId ──────────────► id            │
│  ├─ url        ◄────── ├─ sourceId               ├─ title       │
│  ├─ title              ├─ sourceType             ├─ content     │
│  ├─ categories         ├─ addedAt                ├─ sourceUrls  │ ← denormalized for git
│  └─ fetchedAt          └─ isPrimary              └─ categories  │
│                                                                  │
│  KnowledgeDocument                                               │
│  ├─ id         ◄────── (sourceType: "document")                 │
│  ├─ filename                                                     │
│  └─ content                                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

### New: SkillSource Join Table

```prisma
model SkillSource {
  id         String   @id @default(cuid())
  skillId    String
  sourceId   String
  sourceType String   // "url" | "document"
  addedAt    DateTime @default(now())
  isPrimary  Boolean  @default(false)

  skill      Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([skillId, sourceId, sourceType])
  @@index([sourceId, sourceType])
  @@index([skillId])
}
```

### Modified: ReferenceUrl

```prisma
model ReferenceUrl {
  // Keep existing fields
  id          String   @id @default(cuid())
  url         String
  title       String?
  description String?
  categories  String[] @default([])
  addedAt     DateTime @default(now())
  lastUsedAt  DateTime?
  usageCount  Int      @default(0)
  ownerId     String?

  // REMOVE: skillId (replaced by SkillSource)
  // REMOVE: isReferenceOnly (all sources are independent now)

  // ADD: computed field via SkillSource relation
}
```

### Modified: Skill

```prisma
model Skill {
  // Keep existing fields including sourceUrls JSON for git sync
  sourceUrls     Json?  // Denormalized for portability
  sourceDocuments Json? // Denormalized for portability

  // ADD: relation to join table
  skillSources   SkillSource[]
}
```

## Implementation Phases

### Phase 1: Schema Migration
- [x] Add SkillSource model to schema
- [x] Run migration to create table
- [x] Keep existing fields (non-breaking)

### Phase 2: Data Migration
- [x] Script to populate SkillSource from existing data:
  - From Skill.sourceUrls JSON → create SkillSource + ReferenceUrl if needed
  - From ReferenceUrl.skillId → create SkillSource
  - From KnowledgeDocument.skillId → create SkillSource
- [x] Migration executed successfully (see log below)

### Phase 3: API Updates
- [x] POST /api/reference-urls/link now uses SkillSource join table
- [x] Keep writing sourceUrls JSON for git compatibility (unchanged)
- [x] New endpoint: GET /api/sources/:id/skills - query skills by source
- [x] GET /api/reference-urls now includes skillCount
- [x] GET /api/reference-urls/:id now includes skillCount
- [x] Delete skill cascade handled by Prisma (onDelete: Cascade on SkillSource)

### Phase 4: UI Updates
- [x] Sources tab shows "Used by X skills" count (via skillCount badge on URL items)
- [x] UnifiedLibraryItem type extended with skillCount field
- [x] urlToUnifiedItem passes through skillCount from API
- [ ] Source detail shows linked skills (future: click skill count to see list)
- [x] Delete skill cascade handled by Prisma (sources remain in registry)

### Phase 5: Cleanup
- [x] Remove ReferenceUrl.skillId from Prisma schema
- [x] Remove KnowledgeDocument.skillId from Prisma schema
- [x] Update TypeScript types (ReferenceUrl, KnowledgeDocument)
- [x] Update API routes (reference-urls/[id], documents/[id])
- [x] Update hooks (use-knowledge-data.ts - removed linkedSkillId)
- [x] Push schema changes to database (10 ReferenceUrl.skillId values were already migrated to SkillSource)

### Phase 6: Dynamic Category Derivation
- [x] URL categories are now derived dynamically from linked skills via SkillSource
- [x] GET /api/reference-urls computes categories as union of all linked skills' categories
- [x] GET /api/reference-urls/[id] computes categories the same way
- [x] Category filtering on Sources tab now works based on derived categories
- [x] Falls back to stored categories for unlinked URLs (standalone sources)
- [x] No sync needed when skill categories change - always computed fresh

---

## Implementation Log

### Session 1: 2024-12-20

**Start time:** ~4:00 PM PT

#### Work completed:

1. **Design document created** (~15 min)
   - Documented problem, goals, architecture
   - Defined data model changes
   - Outlined implementation phases

2. **Phase 1: Schema changes** (~10 min)
   - Added `SkillSource` model to `prisma/schema.prisma`
   - Added `skillSources` relation to `Skill` model
   - Pushed schema to database with `prisma db push`
   - Prisma client regenerated with new types

3. **Phase 2: Data migration script** (~15 min)
   - Created `scripts/migrate-skill-sources.ts`
   - Supports `--dry-run` flag for testing
   - Uses upsert for idempotency (safe to run multiple times)
   - Migration results:
     ```
     Skills processed:              12
     URLs from Skill.sourceUrls:    69
     URLs from ReferenceUrl.skillId: 10
     ReferenceUrls created:         59
     SkillSource links created:     69
     Errors:                        0
     ```

4. **Phase 3: API updates** (~20 min)
   - Updated `POST /api/reference-urls/link` to use SkillSource join table
   - Added `GET /api/sources/[id]/skills` endpoint
   - Updated `GET /api/reference-urls` to include `skillCount` for each URL
   - Updated `GET /api/reference-urls/[id]` to include `skillCount`
   - Fixed TypeScript error in migration script (Prisma.DbNull syntax)

5. **Phase 4: UI updates** (~10 min)
   - Extended `UnifiedLibraryItem` type with `skillCount` field
   - Updated `urlToUnifiedItem` to pass through skillCount from API
   - Added skill count badge to URL items in `KnowledgeItemCard` component
   - Badge shows book icon with count, tooltip shows "Used by X skills"

6. **Phase 5: Cleanup** (~10 min)
   - Removed `skillId` from ReferenceUrl and KnowledgeDocument in Prisma schema
   - Updated TypeScript types to remove skillId, add skillCount
   - Updated API routes to remove skillId handling
   - Updated hooks to use skillCount instead of linkedSkillId
   - Pushed schema changes to database (dropped columns safely - data was migrated to SkillSource)

**Total implementation time: ~1 hour 15 minutes**

#### All phases completed

---

## Open Questions

1. **Should we keep sourceUrls JSON on Skill permanently?**
   - Yes, for git sync portability. The join table is for local querying.

2. **What happens when deleting a source that's linked to skills?**
   - Option A: Block deletion, show "used by X skills"
   - Option B: Cascade remove from SkillSource, skill keeps denormalized copy
   - **Decision:** Option A - require unlinking first

3. **How to handle duplicates during migration?**
   - Same URL might exist in both Skill.sourceUrls and ReferenceUrl table
   - **Decision:** Dedupe by URL, create single ReferenceUrl, link via SkillSource

---

## Success Criteria

- [x] Can query "find all skills using URL X" efficiently (GET /api/sources/:id/skills)
- [x] Deleting a skill leaves sources in registry (Prisma cascade on SkillSource only)
- [x] Sources can exist without being linked to any skill (ReferenceUrl independent)
- [x] Git-synced skills still work (sourceUrls JSON intact, unchanged)
- [ ] Refresh workflow can update all skills from a source (future enhancement)
