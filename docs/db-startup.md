# Database Startup & Sync Guide (Local & RDS)

## Local setup (docker-compose)
1) Start Postgres (compose uses port 55432 to avoid host conflicts):
```bash
docker compose up -d postgres
```
2) Point Prisma at compose DB (set in each shell before commands):
```bash
export DATABASE_URL='postgresql://grcminion:grcminion_dev_password@127.0.0.1:55432/grcminion?schema=public'
```
To avoid repeating, add this to `.env.local` or your shell profile:
```
export DATABASE_URL=postgresql://grcminion:grcminion_dev_password@127.0.0.1:55432/grcminion?schema=public
```
Then `source .env.local` before running commands, or let your shell load it automatically.
3) Generate Prisma client:
```bash
npx prisma generate
```
4) Check DB health:
```bash
npm run db:preflight
```
Expected on fresh DB: “No blockers found.” (Warnings appear only if tables/columns are missing.)
5) Seed (optional):
```bash
npx prisma db seed
```

## Fresh DB / RDS (clean apply)
Use the baseline migration (legacy migrations removed):
```bash
# Drop & recreate public schema (only if safe for that DB)
psql "$DATABASE_URL" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
# Apply baseline
psql "$DATABASE_URL" -f prisma/migrations/20251228010000_baseline/migration.sql
# Regenerate client
npx prisma generate
# Preflight check
npm run db:preflight
```
If you cannot drop the schema, run the baseline in a new database or dedicated schema.

## Notes & gotchas
- Always export `DATABASE_URL` before running Prisma/npm scripts; otherwise Prisma defaults to localhost:5432.
- Prefer putting `DATABASE_URL` in `.env.local` (and sourcing it) so every shell uses the same DSN.
- Compose Postgres listens on host port 55432.
- The baseline already includes hardening: unique `Skill.title`, unique `CustomerProfile.name`, and GIN indexes on array fields.
- Legacy migrations were removed; `prisma/migrations/20251228010000_baseline` is the source of truth.
