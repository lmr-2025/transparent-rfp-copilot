# Git-Backed Skills: AWS Deployment Considerations

## Current Architecture

**Local Development:**
- Database (PostgreSQL) - writable, cache layer
- Git (skills/ directory) - source of truth
- Web UI creates/updates skills → writes to both DB and git automatically
- Engineers edit markdown → run `npm run sync:skills` to sync git → database

**AWS Production (ECS/Fargate + RDS):**
- RDS PostgreSQL (Multi-AZ) - writable database cache
- Git repository - source of truth
- ECS containers are **ephemeral and stateless**
- **PROBLEM**: ECS containers can't write to git and push to remote

---

## Key Challenges for AWS Deployment

### 1. **ECS Containers Can't Commit to Git**

**Problem:**
- ECS tasks are ephemeral (can restart/redeploy anytime)
- Local git commits made in a container are lost when container restarts
- Containers don't have persistent volumes with `.git/` directory
- Can't easily push to GitHub from ECS (requires SSH keys or tokens)

**Impact:**
- Web UI skill creation would write to RDS but NOT commit to git
- Git and RDS would quickly get out of sync
- Engineers editing markdown wouldn't see changes from web UI

### 2. **Database-First Problem**

**Problem:**
- In AWS, RDS becomes de facto source of truth
- Git becomes stale unless manually synced
- Defeats the purpose of git-backed skills

### 3. **Sync Script Can't Run Automatically**

**Problem:**
- `npm run sync:skills` needs to run after git changes
- In AWS, there's no automated trigger after `git pull`
- ECS containers don't automatically pull latest git changes

### 4. **Concurrent Write Conflicts**

**Problem:**
- Multiple ECS tasks (horizontal scaling) all have separate git repos
- Each container's git state is independent and ephemeral
- No coordination between containers

---

## Proposed Solutions

### Option 1: **Lambda-Based Git Sync** (Recommended)

**Architecture:**
```
Web UI (ECS) → RDS (write)
                ↓
          Lambda (triggered) → Git commit & push
                ↓
          GitHub webhook → Lambda → sync:skills to RDS
```

**How It Works:**
1. Web UI writes to RDS only (no git commits in ECS)
2. RDS write triggers SNS notification or EventBridge event
3. Lambda function:
   - Clones git repo to `/tmp` (ephemeral Lambda storage)
   - Updates skill markdown file
   - Commits and pushes to GitHub
4. GitHub webhook triggers another Lambda on push
5. Second Lambda runs `npm run sync:skills` to update RDS from git

**Pros:**
- ECS remains stateless
- Git operations isolated in Lambda (clean, controlled)
- Automatic bidirectional sync
- Scales independently of web app

**Cons:**
- More infrastructure (2 Lambdas, SNS/EventBridge, GitHub webhook)
- Lambda /tmp has 512MB limit (git repo must fit)
- Cold start delay (1-2 seconds for first execution)

**Implementation:**
- Lambda 1: `skills-to-git` - triggered by RDS changes via EventBridge
- Lambda 2: `git-to-skills` - triggered by GitHub webhook
- Both use shared layer with git CLI and Node.js dependencies

---

### Option 2: **EFS-Backed Git Repository**

**Architecture:**
```
ECS Tasks → Shared EFS volume with .git/ directory
         → RDS (cache)
```

**How It Works:**
1. Mount EFS volume to all ECS tasks at `/mnt/skills-repo`
2. `.git/` directory persists across container restarts
3. ECS tasks can git commit and push directly
4. Use file locks to prevent concurrent write conflicts

**Pros:**
- Simpler architecture (no Lambda)
- ECS tasks have direct git access
- Low latency (local filesystem)

**Cons:**
- EFS is slower than local disk (network filesystem)
- File locking complexity across containers
- Git conflicts still possible with multiple tasks
- Security: GitHub credentials must be in ECS tasks
- EFS costs ($0.30/GB-month + throughput costs)

---

### Option 3: **Hybrid: RDS Primary, Git Export Only**

**Architecture:**
```
Web UI (ECS) → RDS (source of truth)
             → Manual git export script
Engineers → Edit markdown → Manual RDS import
```

**How It Works:**
1. RDS is the true source of truth in production
2. Periodic Lambda or cron job exports RDS → git (using export-skills-to-git.ts)
3. Engineers clone repo, edit markdown locally, then import via web UI

**Pros:**
- Simplest AWS architecture
- No concurrency issues
- RDS is clearly the source of truth

**Cons:**
- Git is read-only in production (defeats collaboration)
- Engineers can't use git workflow for skills
- Manual import process is friction

---

### Option 4: **GitHub Actions as Sync Service**

**Architecture:**
```
Web UI (ECS) → RDS only
             ↓ (webhook or polling)
GitHub Actions → Export RDS → Commit to git
GitHub Actions → On push → Sync to RDS
```

**How It Works:**
1. Web UI writes to RDS, sends webhook to GitHub
2. GitHub Actions workflow:
   - Connects to RDS via VPN/VPC peering
   - Runs `npm run export:skills`
   - Commits and pushes changes
3. On push to main, another workflow runs `npm run sync:skills`

**Pros:**
- Uses existing GitHub infrastructure
- CI/CD pipeline already configured
- No Lambda costs

**Cons:**
- GitHub Actions needs RDS access (security concern)
- Slower than Lambda (workflow startup time)
- Webhook setup more complex

---

## Recommended Approach: **Option 1 (Lambda-Based Git Sync)**

### Phase 1: Basic Implementation

**Lambda 1: skills-to-git**
```typescript
// Triggered by EventBridge rule on RDS Skill table changes
export const handler = async (event) => {
  const { skillId, operation } = event.detail;

  // Fetch skill from RDS
  const skill = await fetchSkillFromRDS(skillId);

  // Clone repo to /tmp (or pull if exists)
  await git.clone('https://github.com/org/repo', '/tmp/skills-repo');

  // Update markdown file
  const slug = getSkillSlug(skill.title);
  await writeSkillFile(`/tmp/skills-repo/skills/${slug}.md`, skill);

  // Commit and push
  await git.add('skills/*.md');
  await git.commit(`${operation}: ${skill.title}`);
  await git.push();
};
```

**Lambda 2: git-to-skills**
```typescript
// Triggered by GitHub webhook on push to main
export const handler = async (event) => {
  const { commits } = JSON.parse(event.body);

  // Check if skills/ directory changed
  const skillsChanged = commits.some(c =>
    c.modified.some(f => f.startsWith('skills/'))
  );

  if (!skillsChanged) return;

  // Clone repo
  await git.clone('https://github.com/org/repo', '/tmp/skills-repo');

  // Run sync script
  await exec('npm run sync:skills', { cwd: '/tmp/skills-repo' });
};
```

### Phase 2: Enhanced Implementation

**Add to Lambda 1:**
- Conflict detection (check if git version is newer than RDS)
- Retry logic for git push failures
- SNS notification on sync failures
- CloudWatch metrics for sync latency

**Add to Lambda 2:**
- Idempotency (check git commit SHA before syncing)
- Batch processing (sync multiple changed skills at once)
- Rollback on sync errors

### Phase 3: Monitoring & Alerting

**CloudWatch Alarms:**
- Lambda execution failures
- Sync lag time (time between RDS write and git commit)
- Git push failures
- RDS/git drift detection

**Dashboard:**
- Last sync time
- Pending sync queue
- Sync error rate
- Skills in RDS vs skills in git count

---

## Infrastructure Requirements

### Lambda Functions

**skills-to-git Lambda:**
```terraform
resource "aws_lambda_function" "skills_to_git" {
  function_name = "transparent-trust-skills-to-git"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = 60  # Git operations can be slow
  memory_size   = 512 # Need space for git repo in /tmp

  environment {
    variables = {
      GITHUB_TOKEN     = var.github_token_secret_arn
      GITHUB_REPO      = "monte-carlo-data/transparent-trust"
      DATABASE_URL     = var.database_url_secret_arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_to_rds.id]
  }
}
```

**git-to-skills Lambda:**
```terraform
resource "aws_lambda_function" "git_to_skills" {
  function_name = "transparent-trust-git-to-skills"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = 120  # Sync can process many skills
  memory_size   = 1024

  environment {
    variables = {
      GITHUB_TOKEN = var.github_token_secret_arn
      DATABASE_URL = var.database_url_secret_arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_to_rds.id]
  }
}
```

### EventBridge Rule

```terraform
resource "aws_cloudwatch_event_rule" "skill_changes" {
  name        = "transparent-trust-skill-changes"
  description = "Trigger Lambda on Skill table changes"

  event_pattern = jsonencode({
    source      = ["aws.rds"]
    detail-type = ["RDS DB Instance Event"]
    detail = {
      EventCategories = ["notification"]
    }
  })
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.skill_changes.name
  target_id = "SkillsToGitLambda"
  arn       = aws_lambda_function.skills_to_git.arn
}
```

### GitHub Webhook

**Setup:**
1. Go to GitHub repo settings → Webhooks
2. Add webhook:
   - Payload URL: `https://api.yourdomain.com/github-webhook` (API Gateway → Lambda)
   - Content type: `application/json`
   - Secret: Store in Secrets Manager
   - Events: "Just the push event"

**API Gateway to Lambda:**
```terraform
resource "aws_api_gateway_rest_api" "github_webhook" {
  name = "transparent-trust-github-webhook"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.github_webhook.id
  resource_id = aws_api_gateway_resource.webhook.id
  http_method = aws_api_gateway_method.post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.git_to_skills.invoke_arn
}
```

### Secrets

**GitHub Personal Access Token:**
```terraform
resource "aws_secretsmanager_secret" "github_token" {
  name        = "transparent-trust/github-token"
  description = "GitHub PAT for skills sync"
}
```

**Required permissions for PAT:**
- `repo` (full control of private repositories)
- `workflow` (update GitHub Actions workflows)

### Security Groups

```terraform
resource "aws_security_group" "lambda_to_rds" {
  name        = "transparent-trust-lambda-rds"
  description = "Allow Lambda to access RDS"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.rds_cidr]
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # For GitHub API
  }
}
```

---

## Alternative: Simplified EventBridge Approach

Instead of monitoring RDS directly, emit custom events from the application:

**In API routes (src/app/api/skills/route.ts):**
```typescript
import { EventBridge } from '@aws-sdk/client-eventbridge';

const eventbridge = new EventBridge();

// After skill creation
await eventbridge.putEvents({
  Entries: [{
    Source: 'transparent-trust.skills',
    DetailType: 'SkillCreated',
    Detail: JSON.stringify({
      skillId: skill.id,
      title: skill.title,
      operation: 'create'
    })
  }]
});
```

**Pros:**
- More explicit and reliable than RDS monitoring
- Can include custom metadata
- Works even if RDS doesn't have event notifications

**Cons:**
- Application code knows about AWS infrastructure
- Need to handle EventBridge failures

---

## Migration Plan

### Week 1: Lambda Infrastructure
1. Create Lambda functions (skills-to-git, git-to-skills)
2. Set up EventBridge rule for RDS events
3. Create GitHub webhook endpoint (API Gateway)
4. Configure IAM roles and security groups
5. Add Secrets Manager for GitHub token

### Week 2: Application Integration
1. Update API routes to emit EventBridge events
2. Add fallback: if Lambda fails, log error but don't fail request
3. Test sync both directions (RDS → git, git → RDS)
4. Add monitoring dashboard

### Week 3: Testing & Rollout
1. Test in staging environment
2. Validate sync latency and reliability
3. Document runbooks for sync failures
4. Deploy to production
5. Monitor sync metrics

---

## Cost Estimation

**Lambda:**
- skills-to-git: 1M invocations/month × $0.20/1M = **$0.20**
- git-to-skills: 100K invocations/month × $0.20/1M = **$0.02**
- Compute: 1M × 1GB × 1s × $0.0000166667 = **$16.67**

**EventBridge:**
- Custom events: 1M events/month × $1.00/million = **$1.00**

**API Gateway:**
- GitHub webhooks: 100K requests/month × $3.50/million = **$0.35**

**Total: ~$18/month**

---

## Risks & Mitigations

### Risk 1: Lambda /tmp Space Limit (512MB)
**Mitigation:**
- Use shallow clone: `git clone --depth 1`
- Only clone skills/ directory if possible
- Clean up /tmp between invocations

### Risk 2: Git Push Conflicts
**Mitigation:**
- Implement retry with exponential backoff
- Pull before push in Lambda
- Add conflict resolution logic (last-write-wins for now)

### Risk 3: GitHub API Rate Limits
**Mitigation:**
- Use GitHub App instead of PAT (higher rate limits)
- Cache git repo in Lambda /tmp across invocations
- Batch multiple skill changes into single commit

### Risk 4: Sync Lag
**Mitigation:**
- Set CloudWatch alarm for sync lag > 30 seconds
- Use SQS queue to buffer high-volume skill creation
- Scale Lambda concurrency if needed

### Risk 5: Network Failures (GitHub down)
**Mitigation:**
- Add DLQ (Dead Letter Queue) for failed Lambda invocations
- Implement retry with exponential backoff
- Fallback: Manual sync via admin UI button

---

## Testing Strategy

### Unit Tests
- Test skill markdown serialization/deserialization
- Test git commit message generation
- Test conflict detection logic

### Integration Tests
- Test Lambda → RDS connection
- Test Lambda → GitHub API
- Test EventBridge → Lambda triggering
- Test GitHub webhook → Lambda flow

### E2E Tests
1. Create skill via web UI → verify git commit appears
2. Edit skill markdown in GitHub → verify RDS updates
3. Create skill in GitHub → verify RDS imports it
4. Update skill in web UI → verify git commit updates

### Load Tests
- 100 skills created simultaneously → verify all sync
- 1000 git commits → verify RDS syncs correctly
- Lambda timeout under high load

---

## Documentation Requirements

### For Engineers
- How to edit skills in git (markdown format, frontmatter)
- How to trigger manual sync if needed
- What to do if sync fails (runbook)

### For DevOps
- How to deploy Lambda functions
- How to rotate GitHub PAT
- How to monitor sync health
- How to debug sync failures

### For Product
- Expected sync latency (5-10 seconds)
- What happens during sync failures
- When to use web UI vs git for editing

---

## Open Questions

1. **Conflict resolution strategy**: Last-write-wins? Manual review? Merge both?
2. **Git commit attribution**: Use skill owner's email in git commit?
3. **Branch strategy**: Always commit to `main`? Or feature branches for drafts?
4. **Skill versioning**: Keep git history? Or squash commits?
5. **Batch size**: How many skill changes to batch into one commit?
6. **Webhook security**: How to verify GitHub webhook signature?

---

## Next Steps

1. Review this document with team
2. Decide on Option 1 (Lambda) vs other approaches
3. Create infrastructure Terraform modules
4. Implement Lambda functions
5. Update application code to emit events
6. Deploy to staging and test
