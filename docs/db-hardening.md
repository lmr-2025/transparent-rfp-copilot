# DB Hardening Checklist (Postgres)

This repo now adds stricter constraints and indexes. Run the preflight before applying migrations so you can fix data issues first.

## What changed
- Unique keys: `Skill.title`, `CustomerProfile.name`.
- GIN indexes on array filters: `Skill.categories`, `KnowledgeDocument.categories`, `ReferenceUrl.categories`, `KnowledgeRequest.categories`, `InstructionPreset.defaultCategories`.
- Baseline migration: `prisma/migrations/20251228010000_baseline/migration.sql` now represents the full schema (legacy migrations removed to avoid drift).

## Preflight
```bash
npm run db:preflight
```
- Fails (exit code 1) if:
  - Duplicate skill titles (case-insensitive).
  - Duplicate customer names (case-insensitive).
  - Null `ownerId` on: Skill, CustomerProfile, KnowledgeDocument, BulkProject, Template, CollateralOutput, ContractReview.

## Fix flow before `prisma migrate deploy`
1) Resolve duplicates reported above (rename/merge as appropriate).
2) Backfill missing owners (assign real owner or “system” owner).
3) Re-run `npm run db:preflight` until clean.
4) Run Prisma migrate against Postgres to apply the unique constraints and GIN indexes.

## Baseline migration application (dev/RDS)
- We removed legacy migrations; use the baseline for clean setups.
- To apply to a fresh dev DB or new RDS:
  1. Ensure `DATABASE_URL` points at the target.
  2. Drop and recreate `public` (dev-safe): `psql "$DATABASE_URL" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'`
  3. Apply the baseline: `psql "$DATABASE_URL" -f prisma/migrations/20251228010000_baseline/migration.sql`
  4. Run `npx prisma generate` (to refresh client) and `npm run db:preflight`.
- If you cannot drop the schema (shared DB), create a new schema or run the baseline in an isolated database.
