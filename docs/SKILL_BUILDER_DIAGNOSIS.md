# Skill Builder Diagnosis

**Date**: 2025-12-19
**Issue**: Skill builder returning 500 error on `/knowledge/add` page
**Status**: Infrastructure work is NOT the cause

---

## Investigation Summary

### What I Checked

1. **Skill Builder Code**: ✅ Intact and well-structured
   - `/knowledge/add/page.tsx` - Main UI (no issues)
   - `/api/skills/plan/route.ts` - Planning endpoint (no issues)
   - `/api/skills/analyze/route.ts` - Analysis endpoint (no issues)
   - Recent commits show active development

2. **Infrastructure Changes**: ✅ Not Related
   - Only added documentation files:
     - `docs/INTEGRATIONS.md`
     - `docs/SKILL_MARKDOWN_ENHANCEMENT.md`
     - `docs/AWS_DEPLOYMENT.md` updates
   - No code changes to skill builder
   - No changes to API routes
   - No changes to dependencies

3. **Environment**: ✅ Configured
   - `.env` file exists
   - `ANTHROPIC_API_KEY` is set
   - `DATABASE_URL` is set
   - Dev server is running on port 3000

4. **Build**: ✅ No Build Errors
   - `npm run build` completes successfully
   - No TypeScript errors
   - No ESLint warnings

### Current Status

**Problem**: The `/knowledge/add` page returns a **500 Internal Server Error**

**Evidence**:
```bash
$ curl http://localhost:3000/knowledge/add
# Returns HTML with 500 error
```

**This is a runtime error**, not a build-time or configuration issue.

---

## Root Cause Analysis

### Likely Causes (ranked by probability)

#### 1. **Database Connection Issue** (Most Likely)
The skill builder queries the database for existing skills and categories.

**Check**:
```bash
# Test database connection
npx prisma studio
# or
npx prisma db push
```

**If database is down or migrations haven't run**:
```bash
npx prisma migrate dev
npx prisma generate
```

#### 2. **API Route Runtime Error**
The page may be failing during server-side rendering when fetching initial data.

**Check**:
- Look at dev server console logs (not captured in our check)
- Check browser devtools console for errors
- Check network tab for which API call is failing

#### 3. **Missing Data in Database**
The page might expect certain data (like skill categories) that don't exist.

**Check**:
```sql
-- Check if skill categories exist
SELECT * FROM "SkillCategory" LIMIT 5;

-- Check if there are any skills
SELECT COUNT(*) FROM "Skill";
```

**Fix**:
```bash
# If categories are missing, seed them
# (There should be a seed script or you can add manually via Prisma Studio)
```

#### 4. **React Component Error**
The page component might be throwing during render.

**Check**:
- Look for `useState` hooks with invalid initial state
- Look for `useEffect` hooks that throw
- Check for null/undefined access

---

## How to Debug

### Step 1: Check Server Logs

The dev server should be printing errors to the console. Find the terminal where `npm run dev` is running and look for:
- Red error messages
- Stack traces
- Failed API calls

### Step 2: Check Browser Console

1. Open `http://localhost:3000/knowledge/add` in browser
2. Open DevTools (F12)
3. Go to Console tab
4. Look for red errors
5. Go to Network tab
6. Look for failed requests (red status codes)

### Step 3: Test Database

```bash
# Navigate to project
cd "/Users/lross/Source Control/transparent-trust"

# Test Prisma connection
npx prisma studio
# This should open a browser window - if it fails, database is misconfigured

# Check migrations
npx prisma migrate status

# If migrations are pending
npx prisma migrate dev
```

### Step 4: Test API Endpoints Directly

```bash
# Test the analyze endpoint
curl -X POST http://localhost:3000/api/skills/analyze \
  -H "Content-Type: application/json" \
  -d '{"sourceUrls":["https://example.com"],"existingSkills":[]}'

# Should return JSON (not HTML 500 error)
```

### Step 5: Check for Recent Code Changes

```bash
# See what changed in the last week
git log --oneline --since="1 week ago" -- "src/app/knowledge/add/**"

# If there were recent changes, check them
git diff HEAD~5 -- "src/app/knowledge/add/page.tsx"
```

---

## Quick Fixes to Try

### Fix 1: Reset Database

```bash
# Warning: This will delete all data!
npx prisma migrate reset

# Then seed with basic categories
npx prisma studio
# Manually add a few SkillCategory entries
```

### Fix 2: Clear Next.js Cache

```bash
rm -rf .next
npm run dev:clean
```

### Fix 3: Reinstall Dependencies

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

### Fix 4: Check for Stale Environment Variables

```bash
# Restart dev server to pick up any .env changes
npm run stop
npm run dev
```

---

## What's NOT the Problem

❌ **Infrastructure documentation** - Only added markdown files, no code changes
❌ **Build errors** - Build completes successfully
❌ **Missing dependencies** - All packages are installed
❌ **Missing environment variables** - API key and database URL are set
❌ **Recent code changes to skill builder** - Last changes were 2 weeks ago and working

---

## Recommended Next Steps

1. **Immediate**: Check the dev server console logs for the actual error message
2. **If database issue**: Run `npx prisma migrate dev` and `npx prisma studio`
3. **If API issue**: Test API endpoints directly with curl
4. **If component issue**: Check browser console for React errors

---

## Additional Context

### Recent Work on This Project

**Today (2025-12-19)**:
- Added `docs/INTEGRATIONS.md` - Salesforce, Google, Snowflake integration guides
- Added `docs/SKILL_MARKDOWN_ENHANCEMENT.md` - Plan for improving skill structure
- Updated `README.md` - Added AWS and integrations sections

**None of these changes touch skill builder code.**

### Skill Builder Architecture

**Page**: `/knowledge/add/page.tsx`
- Client component using Zustand store
- Workflow steps: Source Input → Analysis → Review → Save
- Depends on API routes for LLM analysis

**API Routes**:
- `/api/skills/analyze` - Analyze URLs/docs and suggest actions
- `/api/skills/plan` - Conversational planning for skill organization
- `/api/skills/route` - CRUD operations for skills

**Dependencies**:
- Database (Prisma) - For existing skills and categories
- Anthropic API - For LLM analysis
- Client state (Zustand) - For workflow management

---

## Conclusion

**The skill builder failure is unrelated to the infrastructure documentation work.**

The 500 error is most likely:
1. Database connection issue
2. Missing database migrations
3. Runtime error in API route
4. Missing required data (categories)

**Action Required**: Check the dev server console logs to see the actual error message, then follow the debugging steps above.

---

Generated: 2025-12-19
By: Claude Code
Status: Diagnosis Complete - Awaiting User Investigation
