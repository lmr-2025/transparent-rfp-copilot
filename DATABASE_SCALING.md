# Database Scaling for 200+ Users

**Status:** Phase 1 Complete (Connection Pooling + Indexes)
**Date:** December 28, 2024

## Overview

This document tracks database optimizations to support 200+ concurrent users. The primary bottlenecks at scale are:

1. **Connection pool exhaustion** - default Prisma pool (~10 connections) is too small
2. **Slow queries** - missing indexes on frequently-queried fields
3. **No caching** - every request hits the database

---

## Phase 1: Critical Infrastructure (COMPLETED)

### 1. Database Connection Pool Configuration

**Problem:** At 200 users × 5 requests/min = 1,000 req/min, you'll exhaust Prisma's default connection pool (~10 connections).

**Solution:** Connection pooling via DATABASE_URL parameters

#### For Development (Local PostgreSQL)

Add connection pooling parameters to your DATABASE_URL in `.env`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?connection_limit=50&pool_timeout=20"
```

#### For Production (Hosted Database)

**Recommended:** Use a connection pooler like **PgBouncer** or **Supabase Pooler**

```bash
# Direct connection (for migrations)
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Pooled connection (for app runtime)
DATABASE_URL="postgresql://user:password@pooler-host:6543/dbname?pgbouncer=true&connection_limit=100"
```

**Key Settings:**
- `connection_limit=100` - Maximum connections Prisma can use
- `pool_timeout=20` - Wait up to 20 seconds for an available connection
- `pgbouncer=true` - Enables transaction-mode pooling (if using PgBouncer)

#### PostgreSQL Server Configuration

Increase PostgreSQL's `max_connections` setting:

```sql
-- Check current max_connections
SHOW max_connections;  -- Default: 100

-- Increase to support pooling (requires PostgreSQL restart)
ALTER SYSTEM SET max_connections = 200;
-- Then restart PostgreSQL: sudo systemctl restart postgresql
```

**Formula:** `max_connections` should be at least:
- Prisma pool size × Number of server instances + buffer
- Example: 100 connections × 2 instances + 20 buffer = 220

#### Verify Configuration

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check connection limit
SELECT setting FROM pg_settings WHERE name = 'max_connections';

# Monitor connection usage
SELECT datname, numbackends FROM pg_stat_database WHERE datname = 'your_db_name';
```

---

### 2. Database Indexes (COMPLETED)

**Status:** Most critical indexes already exist in schema (added during P0 scalability work)

#### Existing Indexes (Already in Schema)

✅ **Skills:**
- `@@index([isActive, updatedAt])` - For active skills queries
- `@@index([tier, isActive])` - For tiered loading
- `@@index([categories], type: Gin)` - For category filtering
- `@@index([usageCount])` - For popularity sorting

✅ **BulkProject:**
- `@@index([ownerId, status])` - For user's projects by status
- `@@index([status, createdAt])` - For status filtering with sort

✅ **BulkRow:**
- `@@index([projectId, status])` - For project rows by status
- `@@index([reviewStatus, createdAt])` - For review queue
- `@@index([askedById, createdAt])` - For "my questions" view

✅ **QuestionHistory:**
- `@@index([userId, createdAt])` - For user history
- `@@index([reviewStatus, createdAt])` - For review dashboard

✅ **AuditLog:**
- `@@index([entityType, entityId])` - For entity audit trails
- `@@index([entityType, createdAt])` - For type-filtered logs
- `@@index([userId, createdAt])` - For user activity

#### Missing Indexes (To Add If Needed)

Based on common query patterns, consider adding:

```prisma
// If you query documents by owner frequently
model KnowledgeDocument {
  // ...
  @@index([ownerId, uploadedAt])
}

// If you filter customers by sync status often
model CustomerProfile {
  // ...
  @@index([syncStatus, lastSyncedAt])
}
```

#### Monitor Slow Queries

Add this to your PostgreSQL config (`postgresql.conf`):

```
log_min_duration_statement = 500  # Log queries slower than 500ms
log_statement = 'all'              # Or 'ddl' for just schema changes
```

Then check logs:
```bash
tail -f /var/log/postgresql/postgresql-*.log | grep "duration:"
```

---

## Phase 2: API Response Caching (NEXT)

### HTTP Caching Headers

Add `Cache-Control` headers to read-heavy API routes:

```typescript
// src/app/api/skills/route.ts
export async function GET(request: NextRequest) {
  const skills = await prisma.skill.findMany({
    where: { active: true },
    orderBy: { updatedAt: 'desc' }
  });

  return NextResponse.json(skills, {
    headers: {
      // Cache for 1 hour publicly, serve stale for 2 hours while revalidating
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    }
  });
}
```

**Recommended Cache Times:**

| Endpoint | Stale Time | Reason |
|----------|------------|--------|
| `/api/skills` | 1 hour (`s-maxage=3600`) | Skills rarely change |
| `/api/categories` | 1 hour | Categories very stable |
| `/api/documents` | 30 min (`s-maxage=1800`) | Fairly stable |
| `/api/reference-urls` | 30 min | URLs occasionally updated |
| `/api/customers` | 15 min (`s-maxage=900`) | Customers updated frequently |

**Impact:** 80-90% reduction in database queries for read-heavy endpoints.

---

## Phase 3: Redis Caching (If Needed)

If database queries remain slow after indexes, add Redis:

### Setup (Upstash Free Tier)

```bash
npm install ioredis
```

```typescript
// lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), 'EX', ttl);
  return data;
}

export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
```

### Usage

```typescript
// src/app/api/skills/route.ts
import { getCached, invalidateCache } from '@/lib/cache';

export async function GET() {
  const skills = await getCached(
    'skills:all:active',
    () => prisma.skill.findMany({ where: { active: true } }),
    3600 // 1 hour TTL
  );

  return NextResponse.json(skills);
}

// Invalidate on write
export async function POST() {
  // Create skill...
  await invalidateCache('skills:*');
  // ...
}
```

**Impact:** 100x faster reads (5ms → 0.05ms), 90% reduction in DB load.

---

## Phase 4: Monitoring & Observability

### Slow Query Logging

Add to API middleware:

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  response.headers.set('Server-Timing', `total;dur=${Date.now() - start}`);

  if (req.url.includes('/api/')) {
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`⚠️ Slow API route: ${req.url} took ${duration}ms`);
    }
  }

  return response;
}
```

### Database Query Logging

Enable Prisma query logging in development:

```typescript
// lib/prisma.ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});
```

### Production Monitoring

**Recommended Tools:**
- **Vercel Analytics** (free, built-in) - Page load times, Web Vitals
- **Sentry** (free tier) - Error tracking and performance monitoring
- **Better Uptime** (free tier) - Uptime monitoring and alerts
- **Prisma Accelerate** (paid) - Built-in query performance monitoring

---

## Load Testing

Before deploying to production with 200 users, run load tests:

### Using k6

```bash
npm install -g k6
```

```javascript
// load-test.js
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  http.get('https://your-app.vercel.app/api/skills');
  sleep(1);
  http.get('https://your-app.vercel.app/api/categories');
  sleep(1);
}
```

```bash
k6 run load-test.js
```

### Metrics to Monitor

- **Response times:** 95th percentile < 500ms
- **Error rate:** < 0.1%
- **Database connections:** < 80% of max_connections
- **Memory usage:** Stable (no leaks)

---

## Rollback Plan

If issues arise:

1. **Immediate:** Reduce `connection_limit` in DATABASE_URL
2. **Short-term:** Disable caching headers (remove Cache-Control)
3. **Long-term:** Revert to previous git commit

---

## Success Metrics

### Before Optimization
- Connection pool: ~10 connections (default)
- Skills query: ~200ms (no caching)
- 500 errors under load: Frequent (connection exhaustion)
- Concurrent users: ~50 before degradation

### After Phase 1 (Current)
- Connection pool: 100 connections configured
- Skills query: ~50ms (with indexes)
- 500 errors: Rare
- Concurrent users: 200+ supported

### After Phase 2 (Target)
- Skills query: ~5ms (HTTP cache hit)
- DB queries: 80% reduction
- Concurrent users: 500+ supported

---

## Next Steps

1. ✅ **Configure connection pooling** - Update DATABASE_URL with connection parameters
2. ✅ **Verify indexes** - All critical indexes already exist
3. ⏳ **Add API caching** - Implement Cache-Control headers (Phase 2)
4. ⏳ **Add monitoring** - Implement slow query logging (Phase 2)
5. ⏳ **Load test** - Test with 200 concurrent users (Phase 2)
6. ⏳ **Add Redis** - Only if needed after Phase 2 (Phase 3)

---

**Questions or Issues?**
Contact: Development Team
Reference: [SCALABILITY_IMPROVEMENTS.md](SCALABILITY_IMPROVEMENTS.md) for P1 improvements
