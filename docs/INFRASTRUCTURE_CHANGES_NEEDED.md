# Infrastructure Changes Needed for Git-Backed Skills

This document tracks infrastructure changes that will be needed when deploying git-backed skills to AWS production.

**Status**: Not yet implemented. Review before deployment.

---

## Development Timeline

**Week 1 - Foundation** (Completed: Dec 19, 2025)
- ⏱️ Time spent: ~1 hour
- Added Prisma schema changes
- Created skill file operations library
- Created git sync operations library
- Built export and sync scripts
- Set up skills/ directory structure

**Week 2 - API Integration** (Completed: Dec 19, 2025)
- ⏱️ Time spent: ~30 minutes
- Integrated git commits into POST/PUT/DELETE endpoints
- Added conditional git commits (only for PUBLISHED skills)
- Tested with 3 real skills successfully

**Documentation & AWS Planning** (Completed: Dec 19, 2025)
- ⏱️ Time spent: ~45 minutes
- Comprehensive AWS deployment architecture
- Infrastructure changes tracking document
- Debug scripts for local development

**Sync Tracking Backend** (Completed: Dec 19, 2025)
- ⏱️ Time spent: ~45 minutes
- Added SkillSyncLog model for tracking all sync operations
- Added sync status fields to Skill model (lastSyncedAt, syncStatus, gitCommitSha)
- Created skillSyncLog library with helpers (withSyncLogging, getSyncHealthStatus)
- Updated git functions to return commit SHAs
- Wrapped all git operations in API endpoints with sync logging

**Total time so far**: ~3 hours

**Next Phase - UI Sync Status** (Not Started)
- ⏱️ Estimated: 1-2 hours
- Add sync status indicator to UI
- Show last sync time and status
- Add manual sync trigger button
- Display sync errors/warnings
- Create API endpoints for sync status

---

## Overview

Git-backed skills work perfectly in local development where the app can commit directly to git. However, in AWS production (ECS/Fargate), containers are ephemeral and can't maintain a `.git/` directory or push to GitHub.

**Recommended Solution**: Lambda-based git sync (see detailed design in `git-backed-skills-deployment.md`)

---

## Required Infrastructure Changes

### 1. Lambda Functions

#### Lambda 1: skills-to-git
**Purpose**: Sync RDS skill changes to GitHub
**Trigger**: EventBridge event when skills are created/updated/deleted
**Specs**:
- Runtime: Node.js 20.x
- Memory: 512 MB (need space for git repo in /tmp)
- Timeout: 60 seconds
- VPC: Must have access to RDS in private subnets
- Permissions: RDS read, Secrets Manager read, GitHub API write

**Terraform module location**: `infrastructure/lambda/skills-to-git/`

#### Lambda 2: git-to-skills
**Purpose**: Sync GitHub changes to RDS
**Trigger**: GitHub webhook on push to main branch
**Specs**:
- Runtime: Node.js 20.x
- Memory: 1024 MB (may process multiple skills)
- Timeout: 120 seconds
- VPC: Must have access to RDS in private subnets
- Permissions: RDS write, Secrets Manager read, GitHub API read

**Terraform module location**: `infrastructure/lambda/git-to-skills/`

---

### 2. EventBridge Rule

**Purpose**: Trigger `skills-to-git` Lambda when skill records change in RDS

**Options**:
1. **Application-emitted events** (recommended):
   - Application code emits custom EventBridge events
   - More reliable and explicit
   - Can include custom metadata

2. **RDS event notifications**:
   - Monitor RDS for data changes
   - Less reliable, harder to filter

**Terraform module location**: `infrastructure/eventbridge/skill-sync/`

---

### 3. API Gateway

**Purpose**: Receive GitHub webhooks and invoke `git-to-skills` Lambda

**Specs**:
- REST API or HTTP API
- POST endpoint: `/github-webhook`
- Signature verification for security
- Integration with Lambda

**Terraform module location**: `infrastructure/api-gateway/github-webhook/`

---

### 4. Secrets Manager Secrets

#### GitHub Personal Access Token
**Name**: `transparent-trust/github-token`
**Required scopes**:
- `repo` (full control of private repositories)
- `workflow` (optional: update GitHub Actions)

**How to create**:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`
4. Store token in Secrets Manager

**Terraform**: Add to existing `infrastructure/secrets-manager/main.tf`

---

### 5. Security Groups

#### Lambda to RDS Security Group
**Purpose**: Allow Lambda functions to connect to RDS

**Rules**:
- Egress to RDS: port 5432 (PostgreSQL)
- Egress to internet: port 443 (GitHub API)

**Terraform**: Add to existing `infrastructure/security-groups/main.tf`

---

### 6. IAM Roles and Policies

#### Lambda Execution Role
**Permissions needed**:
- VPC access (AWSLambdaVPCAccessExecutionRole)
- CloudWatch Logs write
- Secrets Manager read (for GitHub token, DATABASE_URL)
- RDS Data API access (if using Data API instead of direct connection)

**Terraform**: Add to existing `infrastructure/iam/lambda-execution-roles.tf`

---

### 7. CloudWatch Alarms

**Monitoring for**:
- Lambda execution failures
- Sync lag time (time between RDS write and git commit)
- Git push failures (parse Lambda logs)
- RDS/git drift detection

**Terraform module location**: `infrastructure/monitoring/skill-sync-alarms.tf`

---

### 8. GitHub Webhook Configuration

**Manual setup required**:
1. Go to GitHub repo settings → Webhooks
2. Add webhook:
   - Payload URL: `https://api.yourdomain.com/github-webhook`
   - Content type: `application/json`
   - Secret: Generate and store in Secrets Manager
   - Events: "Just the push event"
   - Active: ✓

**Note**: This can't be automated via Terraform (requires GitHub admin access)

---

### 9. Sync Status Tracking Table (New)

**Purpose**: Track sync operations for UI visibility and debugging

**Prisma Schema Addition**:
```prisma
model SkillSyncLog {
  id            String   @id @default(cuid())
  skillId       String
  operation     String   // "create", "update", "delete"
  direction     String   // "db-to-git", "git-to-db"
  status        String   // "pending", "success", "failed"
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  error         String?  @db.Text
  gitCommitSha  String?
  syncedBy      String?  // user ID or "system"

  skill         Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@index([skillId])
  @@index([status])
  @@index([startedAt])
}

// Add to Skill model:
model Skill {
  // ... existing fields
  syncLogs      SkillSyncLog[]
  lastSyncedAt  DateTime?
  syncStatus    String?  // "synced", "pending", "failed"
  gitCommitSha  String?  // Latest git commit SHA for this skill
}
```

**Migration**: Will need `prisma migrate dev` to add these fields

---

## Application Code Changes

### Required Changes

1. **Conditional Git Commits in ECS**:
   - Add environment variable: `ENABLE_GIT_COMMITS=false` in production
   - Check this flag before calling `saveSkillAndCommit()`, etc.
   - In local dev: `ENABLE_GIT_COMMITS=true` (default)

2. **Emit EventBridge Events** (if using Option 1):
   - Install `@aws-sdk/client-eventbridge`
   - Emit events after skill create/update/delete
   - Handle EventBridge failures gracefully (log but don't fail request)

3. **Webhook Signature Verification**:
   - Add endpoint: `POST /api/github-webhook`
   - Verify GitHub webhook signature using secret
   - Parse payload and trigger sync logic

### Optional Enhancements

4. **Manual Sync Trigger**:
   - Admin UI button: "Sync Skills from Git"
   - Calls Lambda directly or triggers EventBridge event

5. **Sync Status Dashboard** (HIGH PRIORITY):
   - **Goal**: Make sync status transparent and visible to all users
   - Show sync status badge on skill list and detail pages
   - Display last sync time for each skill
   - Show sync errors/warnings prominently
   - Add global sync health indicator in header/footer
   - Provide "Force Sync" button for admins when things go wrong

   **UI Components Needed**:
   - `SkillSyncBadge` - Status indicator (✓ Synced, ⏳ Pending, ❌ Failed)
   - `SyncStatusBar` - Global header showing overall sync health
   - `SyncLogViewer` - Detailed sync history for debugging
   - `ManualSyncButton` - Admin tool to force sync

   **API Endpoints Needed**:
   - `GET /api/skills/sync/status` - Overall sync health
   - `GET /api/skills/[id]/sync-logs` - Sync history for a skill
   - `POST /api/skills/sync/trigger` - Manual sync trigger
   - `GET /api/skills/sync/drift` - Detect DB/git differences

---

## Deployment Order

1. **Phase 1: Infrastructure**
   - [ ] Create Lambda functions (code + Terraform)
   - [ ] Create EventBridge rule
   - [ ] Create API Gateway
   - [ ] Set up Secrets Manager secrets
   - [ ] Configure security groups
   - [ ] Set up CloudWatch alarms

2. **Phase 2: Application Changes**
   - [ ] Add `ENABLE_GIT_COMMITS` environment variable check
   - [ ] Emit EventBridge events (optional)
   - [ ] Add GitHub webhook endpoint
   - [ ] Test in staging environment

3. **Phase 3: GitHub Setup**
   - [ ] Create GitHub Personal Access Token
   - [ ] Store token in Secrets Manager
   - [ ] Configure GitHub webhook

4. **Phase 4: Testing**
   - [ ] Test RDS → Git sync
   - [ ] Test Git → RDS sync
   - [ ] Test conflict resolution
   - [ ] Load test (multiple concurrent skill creations)

5. **Phase 5: Production Deployment**
   - [ ] Deploy to production
   - [ ] Monitor sync metrics
   - [ ] Document runbooks

---

## Cost Estimate

**Lambda**:
- skills-to-git: ~1M invocations/month × $0.20/1M = $0.20
- git-to-skills: ~100K invocations/month × $0.20/1M = $0.02
- Compute: 1M × 1GB × 1s × $0.0000166667 = $16.67

**EventBridge**:
- Custom events: 1M events/month × $1.00/million = $1.00

**API Gateway**:
- GitHub webhooks: 100K requests/month × $3.50/million = $0.35

**Total**: ~$18/month

---

## Risks to Consider

1. **Lambda /tmp space limit (512MB)**
   - Git repo must fit in /tmp
   - Use shallow clone: `git clone --depth 1`

2. **Git push conflicts**
   - Multiple Lambda invocations may conflict
   - Implement retry with exponential backoff

3. **Sync lag**
   - Expected: 5-10 seconds
   - Acceptable: Up to 30 seconds
   - Alert if > 30 seconds

4. **GitHub API rate limits**
   - 5000 requests/hour with PAT
   - Use GitHub App for higher limits (if needed)

5. **Network failures**
   - GitHub API down
   - RDS connection timeout
   - Use DLQ (Dead Letter Queue) for failed invocations

---

## Alternative Approaches (Not Recommended)

### Option B: EFS-Backed Git Repository
- Mount EFS volume to all ECS tasks
- Persistent `.git/` directory across containers
- **Cons**: File locking complexity, EFS costs, slower than local disk

### Option C: GitHub Actions
- GitHub Actions workflow syncs RDS ↔ Git
- **Cons**: Requires RDS access from GitHub (security concern), slower

### Option D: RDS Primary, Git Export Only
- RDS is source of truth, periodic export to git
- **Cons**: Defeats git collaboration, engineers can't edit markdown

---

## Open Questions

- [ ] **Conflict resolution**: What happens if skill is edited in both web UI and git simultaneously?
- [ ] **Git commit attribution**: Should we use skill owner's email in git commit author?
- [ ] **Branch strategy**: Always commit to `main` or use feature branches for drafts?
- [ ] **Batch commits**: Should we batch multiple skill changes into one commit?
- [ ] **Webhook security**: How strictly should we verify GitHub webhook signatures?
- [ ] **Fallback strategy**: What happens if Lambda is down? Manual sync button?

---

## Documentation Needed Before Deployment

1. **Runbook**: How to manually sync if automated sync fails
2. **Runbook**: How to recover from sync conflicts
3. **Runbook**: How to rotate GitHub PAT
4. **Monitoring**: Dashboard for sync health
5. **Alerts**: Who gets paged if sync fails?

---

## Next Steps

**Before implementation**:
1. Review this document with team
2. Decide on Lambda-based approach vs alternatives
3. Answer open questions above
4. Get approval for ~$18/month AWS cost increase

**Implementation**:
1. Create Lambda function code (TypeScript)
2. Write Terraform modules for all infrastructure
3. Update application code to disable git commits in ECS
4. Test thoroughly in staging
5. Deploy to production

---

**Last Updated**: 2025-12-19
**Status**: Planning phase - no infrastructure deployed yet
**Owner**: TBD
