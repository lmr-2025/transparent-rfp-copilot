# Deployment Runbook

## Overview

This runbook covers standard deployment procedures for the application.

**Owner:** Engineering team

---

## Deployment Environments

| Environment | URL | Branch | Auto-deploy |
|-------------|-----|--------|-------------|
| Production | [Your prod URL] | `main` | Yes (Vercel) |
| Preview | Auto-generated | PR branches | Yes (Vercel) |
| Local | localhost:3000 | Any | Manual |

---

## Standard Deployment (via Vercel)

### Automatic Deployment
Pushing to `main` triggers automatic deployment:

```bash
git checkout main
git pull origin main
git merge feature-branch
git push origin main
# Vercel automatically deploys
```

### Monitor Deployment
1. Check Vercel dashboard for build status
2. Review build logs for errors
3. Verify deployment URL is accessible

---

## Pre-Deployment Checklist

### Before Merging to Main

- [ ] All tests pass locally: `npm run test` (if tests exist)
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Database migrations are ready: `npx prisma migrate deploy`
- [ ] Environment variables documented (if new ones added)
- [ ] PR reviewed and approved

### Database Migrations

If your PR includes Prisma schema changes:

```bash
# Generate migration
npx prisma migrate dev --name descriptive_name

# Commit the migration file
git add prisma/migrations
git commit -m "Add migration: descriptive_name"
```

**Production migrations run automatically** via Vercel's build command.

---

## Manual Deployment

If automatic deployment is disabled or you need to force deploy:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Deploy preview
vercel
```

---

## Post-Deployment Verification

### Smoke Tests (Manual)

1. [ ] Home page loads
2. [ ] Authentication works (sign in/out)
3. [ ] Chat functionality works
4. [ ] Knowledge library loads
5. [ ] No console errors

### Health Checks

```bash
# Check if app responds
curl -I https://your-app-url.vercel.app

# Check API health (if you have a health endpoint)
curl https://your-app-url.vercel.app/api/health
```

---

## Deployment Failures

### Build Failure

1. Check Vercel build logs
2. Common issues:
   - TypeScript errors: `npx tsc --noEmit` locally
   - Missing dependencies: `npm ci && npm run build`
   - Environment variables: Ensure all required vars are set in Vercel

### Runtime Failure

1. Check Vercel function logs
2. Check for missing environment variables
3. Check database connectivity
4. Rollback if needed (see [Rollback Runbook](./rollback.md))

---

## Environment Variables

### Required for Production

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Vercel |
| `NEXTAUTH_URL` | Production URL | Vercel |
| `NEXTAUTH_SECRET` | Auth encryption key | Vercel |
| `ANTHROPIC_API_KEY` | Claude API key | Vercel |
| `ENCRYPTION_KEY` | Settings encryption | Vercel |

### Adding New Environment Variables

1. Add to Vercel project settings
2. Document in this runbook
3. Update `.env.example` for local development
4. Redeploy for changes to take effect

---

## Related Runbooks

- [Rollback](./rollback.md)
- [Incident Response](./incident-response.md)
