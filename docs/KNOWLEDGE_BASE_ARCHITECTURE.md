# Knowledge Base Architecture - Git-First Approach

**Date**: 2025-12-19
**Status**: Architecture Decision
**Goal**: Shared knowledge base for all Monte Carlo systems

---

## Requirements

1. **Single source of truth** for all of Monte Carlo
2. **Product LLMs** can reference skills
3. **RFP tool** uses skills (current functionality)
4. **Engineering** can add/maintain skills via GitHub
5. **Easy refresh** via web UI (current workflow)
6. **Future-proof** - change now vs migrate later

---

## Recommended Architecture: Git-First with Database Cache

### Core Principle
**Git repository is the source of truth. Database is a cache for the web app.**

```
┌─────────────────────────────────────────┐
│     skills/ (Git Repository)            │  ← SOURCE OF TRUTH
│  - compliance-and-certifications.md     │
│  - data-encryption-security.md          │
│  - incident-response-procedures.md      │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ↓                   ↓
   Web UI Changes      Eng GitHub PRs
        │                   │
        ├───────────────────┤
        ↓                   ↓
   Git Commit          Git Commit
        │                   │
        └─────────┬─────────┘
                  ↓
        GitHub Action / Webhook
                  ↓
        Sync to PostgreSQL
                  ↓
        ┌─────────┴──────────┐
        │                    │
        ↓                    ↓
   Web App (cache)    Product LLMs (read files)
   - Browse/Edit      - Direct file access
   - Refresh          - MCP server
   - RFP responses    - API endpoint
```

---

## File Structure

### Skills Directory
```
skills/
  compliance-and-certifications.md
  data-encryption-security.md
  incident-response-procedures.md
  sso-authentication-methods.md
  gdpr-data-privacy.md
  ...

.skills/
  metadata.json        ← Generated index for fast lookups
  categories.json      ← Category definitions
```

### Skill File Format (Anthropic-compatible)
```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
title: Compliance & Certifications
categories: [Security, Compliance, Auditing]
created: 2024-01-15T10:30:00Z
updated: 2025-12-19T14:20:00Z
owners:
  - name: Jane Smith
    email: jane@montecarlodata.com
    userId: user-123
sources:
  - url: https://montecarlodata.com/security/compliance
    addedAt: 2024-01-15T10:30:00Z
    lastFetched: 2025-12-19T14:20:00Z
  - url: https://montecarlodata.com/docs/dpa
    addedAt: 2024-03-20T09:15:00Z
active: true
---

# Compliance & Certifications

## Overview
Monte Carlo holds SOC 2 Type II, ISO 27001, and is GDPR compliant. Our compliance program includes regular third-party audits conducted annually by [Auditor Name] and continuous monitoring through automated systems.

## Certifications Held
- **SOC 2 Type II**: Audited annually by [Auditor], covers security, availability, and confidentiality. Full report available to customers under NDA.
- **ISO 27001**: Information security management system certified since 2021. Covers all production infrastructure and data handling processes.
- **GDPR**: Full compliance with EU data protection regulations. Data Processing Addendum (DPA) available upon request.
- **HIPAA**: Available for Enterprise customers requiring healthcare compliance. Requires signed Business Associate Agreement (BAA).

## Audit & Compliance Process
- Annual SOC 2 Type II audits conducted by independent third party
- Quarterly internal security reviews and vulnerability assessments
- Continuous monitoring with automated compliance checks (AWS Config, CloudTrail)
- Penetration testing performed bi-annually by external security firm
- Compliance reports available to customers under NDA

## Common Questions

**Q: What compliance certifications do you have?**
A: SOC 2 Type II (audited annually by [Auditor]), ISO 27001 (certified since 2021), GDPR compliant. HIPAA available for Enterprise customers with signed BAA.

**Q: Can we get a copy of your SOC 2 report?**
A: Yes, SOC 2 Type II reports are available to customers under NDA. Contact security@montecarlodata.com with your request. Report covers platform and infrastructure, updated annually.

**Q: Are you HIPAA compliant?**
A: HIPAA compliance is available for Enterprise plan customers and requires signing a Business Associate Agreement (BAA). Contact sales@montecarlodata.com to discuss requirements.

## Edge Cases & Limitations
- SOC 2 report covers the platform and cloud infrastructure only, not customer-deployed components or third-party integrations
- HIPAA compliance requires Enterprise plan + signed Business Associate Agreement (BAA) - contact sales team
- Compliance reports are provided under NDA and cannot be shared publicly
- Custom compliance frameworks (FedRAMP, PCI DSS Level 1) are not currently supported - contact sales for Enterprise compliance needs
```

---

## How Different Systems Access Skills

### 1. Product LLMs (Read Files Directly)
**Use case**: LLMs in Monte Carlo product need to reference skills

**Approach**: Direct file access or MCP server
```python
# In product code
from pathlib import Path

def load_skills_for_llm(categories: list[str] = None):
    skills_dir = Path("skills")
    skills = []

    for skill_file in skills_dir.glob("*.md"):
        content = skill_file.read_text()

        # Parse frontmatter
        metadata, body = parse_frontmatter(content)

        # Filter by category if needed
        if categories and not any(c in metadata.get("categories", []) for c in categories):
            continue

        if metadata.get("active", True):
            skills.append({
                "title": metadata["title"],
                "content": body,
                "categories": metadata.get("categories", []),
            })

    return skills
```

### 2. Web App (Database Cache)
**Use case**: Browse, edit, refresh skills via web UI

**Approach**: Database as cache, sync from git
- Users edit via web UI → saves to database → commits to git
- Git changes (PRs from eng) → trigger sync → update database
- Database provides fast queries, permissions, UI

### 3. External Tools (MCP Server - Optional)
**Use case**: Claude Code, Cursor, other AI tools

**Approach**: MCP server reads from git
```typescript
// skills-mcp/index.ts
server.setRequestHandler("resources/list", async () => {
  const skillFiles = await fs.readdir("skills");
  return {
    resources: skillFiles.map(filename => ({
      uri: `skill:///${filename}`,
      name: filename.replace(".md", ""),
      mimeType: "text/markdown",
    })),
  };
});
```

### 4. API Access (Other MC Systems)
**Use case**: Other Monte Carlo applications need skills

**Approach**: REST API that reads from git or database
```typescript
// /api/v1/knowledge/skills
GET /api/v1/knowledge/skills
GET /api/v1/knowledge/skills?categories=Security,Compliance
GET /api/v1/knowledge/skills/{slug}

Response:
{
  "skills": [
    {
      "id": "...",
      "title": "Compliance & Certifications",
      "content": "# Compliance...",
      "categories": ["Security", "Compliance"],
      "metadata": { ... }
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Create Git Repository Structure (2-3 hours)

**1.1 Create skills directory**
```bash
mkdir -p skills/.skills
```

**1.2 Export existing skills to markdown**
```typescript
// scripts/export-skills-to-git.ts
import { prisma } from "../src/lib/prisma";
import fs from "fs/promises";
import path from "path";

async function exportSkills() {
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    include: { owner: true },
  });

  for (const skill of skills) {
    const filename = skill.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const frontmatter = {
      id: skill.id,
      title: skill.title,
      categories: skill.categories || [],
      created: skill.createdAt.toISOString(),
      updated: skill.updatedAt.toISOString(),
      owners: skill.owners || [],
      sources: skill.sourceUrls || [],
      active: skill.isActive,
    };

    const markdown = `---
${JSON.stringify(frontmatter, null, 2)}
---

${skill.content}
`;

    await fs.writeFile(
      path.join("skills", `${filename}.md`),
      markdown,
      "utf-8"
    );
  }

  console.log(`Exported ${skills.length} skills to skills/`);
}

exportSkills();
```

**1.3 Generate metadata index**
```typescript
// scripts/generate-skill-index.ts
// Creates .skills/metadata.json for fast lookups without parsing all files
```

**1.4 Add to git**
```bash
git add skills/
git commit -m "Export skills to git repository (source of truth)"
```

---

### Phase 2: Build Sync Layer (3-4 hours)

**2.1 Create file reader utility**
```typescript
// src/lib/skillFiles.ts
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export interface SkillFile {
  id: string;
  slug: string;
  title: string;
  content: string;
  categories: string[];
  owners: Array<{ name: string; email?: string; userId?: string }>;
  sources: Array<{ url: string; addedAt: string; lastFetched?: string }>;
  created: string;
  updated: string;
  active: boolean;
}

export async function readSkillFile(filename: string): Promise<SkillFile> {
  const filepath = path.join(process.cwd(), "skills", filename);
  const raw = await fs.readFile(filepath, "utf-8");
  const { data, content } = matter(raw);

  return {
    id: data.id,
    slug: filename.replace(".md", ""),
    title: data.title,
    content: content.trim(),
    categories: data.categories || [],
    owners: data.owners || [],
    sources: data.sources || [],
    created: data.created,
    updated: data.updated,
    active: data.active !== false,
  };
}

export async function listSkillFiles(): Promise<string[]> {
  const skillsDir = path.join(process.cwd(), "skills");
  const files = await fs.readdir(skillsDir);
  return files.filter(f => f.endsWith(".md"));
}

export async function writeSkillFile(slug: string, skill: SkillFile): Promise<void> {
  const frontmatter = {
    id: skill.id,
    title: skill.title,
    categories: skill.categories,
    created: skill.created,
    updated: new Date().toISOString(),
    owners: skill.owners,
    sources: skill.sources,
    active: skill.active,
  };

  const markdown = matter.stringify(skill.content, frontmatter);
  const filepath = path.join(process.cwd(), "skills", `${slug}.md`);
  await fs.writeFile(filepath, markdown, "utf-8");
}
```

**2.2 Create sync script (Git → Database)**
```typescript
// scripts/sync-skills-to-db.ts
import { prisma } from "../src/lib/prisma";
import { listSkillFiles, readSkillFile } from "../src/lib/skillFiles";

export async function syncSkillsToDatabase() {
  const files = await listSkillFiles();

  for (const filename of files) {
    const skill = await readSkillFile(filename);

    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        title: skill.title,
        content: skill.content,
        categories: skill.categories,
        sourceUrls: skill.sources,
        owners: skill.owners,
        isActive: skill.active,
        updatedAt: new Date(skill.updated),
      },
      create: {
        id: skill.id,
        title: skill.title,
        content: skill.content,
        categories: skill.categories,
        sourceUrls: skill.sources,
        owners: skill.owners,
        isActive: skill.active,
        createdAt: new Date(skill.created),
        updatedAt: new Date(skill.updated),
      },
    });
  }

  console.log(`Synced ${files.length} skills to database`);
}

syncSkillsToDatabase();
```

**2.3 Add npm scripts**
```json
// package.json
{
  "scripts": {
    "skills:export": "tsx scripts/export-skills-to-git.ts",
    "skills:sync": "tsx scripts/sync-skills-to-db.ts",
    "skills:index": "tsx scripts/generate-skill-index.ts"
  }
}
```

---

### Phase 3: Update Web App to Use Git (4-5 hours)

**3.1 Update skill creation to commit to git**
```typescript
// src/lib/skillGitSync.ts
import { exec } from "child_process";
import { promisify } from "util";
import { writeSkillFile } from "./skillFiles";

const execAsync = promisify(exec);

export async function saveSkillAndCommit(
  slug: string,
  skill: SkillFile,
  commitMessage: string,
  author: { name: string; email: string }
) {
  // Write to file
  await writeSkillFile(slug, skill);

  // Git add and commit
  const filepath = `skills/${slug}.md`;
  await execAsync(`git add ${filepath}`);
  await execAsync(
    `git commit -m "${commitMessage}" --author="${author.name} <${author.email}>"`
  );

  // Optionally push (or let GitHub Action handle it)
  // await execAsync("git push origin main");

  return skill;
}
```

**3.2 Update API routes to use git**
```typescript
// src/app/api/skills/route.ts
import { readSkillFile, listSkillFiles } from "@/lib/skillFiles";
import { saveSkillAndCommit } from "@/lib/skillGitSync";

export async function GET(request: NextRequest) {
  // Option A: Read from database (faster, cached)
  const skills = await prisma.skill.findMany({ where: { isActive: true } });

  // Option B: Read from files (always fresh, but slower)
  // const files = await listSkillFiles();
  // const skills = await Promise.all(files.map(readSkillFile));

  return apiSuccess({ skills });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const body = await request.json();
  const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const skill: SkillFile = {
    id: crypto.randomUUID(),
    slug,
    title: body.title,
    content: body.content,
    categories: body.categories || [],
    owners: body.owners || [],
    sources: body.sourceUrls || [],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    active: true,
  };

  // Save to git
  await saveSkillAndCommit(
    slug,
    skill,
    `Add skill: ${body.title}`,
    {
      name: auth.session.user.name || "Unknown",
      email: auth.session.user.email || "unknown@example.com",
    }
  );

  // Sync to database cache
  await prisma.skill.create({ data: { ...skill } });

  return apiSuccess({ skill }, { status: 201 });
}
```

---

### Phase 4: Add GitHub Integration (2-3 hours)

**4.1 GitHub Action to sync on PR merge**
```yaml
# .github/workflows/sync-skills.yml
name: Sync Skills to Database

on:
  push:
    branches:
      - main
    paths:
      - 'skills/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Sync skills to database
        run: npm run skills:sync
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Generate skill index
        run: npm run skills:index

      - name: Commit index if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .skills/metadata.json
          git diff --quiet && git diff --staged --quiet || git commit -m "Update skill index [skip ci]"
          git push
```

**4.2 Webhook for real-time sync (optional)**
```typescript
// src/app/api/webhooks/github/route.ts
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256");
  const body = await request.text();

  // Verify webhook signature
  if (!verifyGitHubSignature(signature, body)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(body);

  // If push to main with skills changes
  if (event.ref === "refs/heads/main") {
    const changedFiles = event.commits.flatMap((c: any) =>
      [...c.added, ...c.modified].filter((f: string) => f.startsWith("skills/"))
    );

    if (changedFiles.length > 0) {
      // Trigger sync
      await syncSkillsToDatabase();
    }
  }

  return new Response("OK");
}
```

---

### Phase 5: Product LLM Integration (1-2 hours)

**5.1 Create skill loader for product**
```python
# monte_carlo/knowledge/skill_loader.py
from pathlib import Path
import yaml
import frontmatter

class SkillLoader:
    def __init__(self, skills_dir: Path):
        self.skills_dir = skills_dir

    def load_skills(self, categories: list[str] = None) -> list[dict]:
        """Load skills for LLM context"""
        skills = []

        for skill_file in self.skills_dir.glob("*.md"):
            post = frontmatter.load(skill_file)

            # Filter by category
            if categories and not any(c in post.get("categories", []) for c in categories):
                continue

            # Only active skills
            if not post.get("active", True):
                continue

            skills.append({
                "title": post["title"],
                "content": post.content,
                "categories": post.get("categories", []),
            })

        return skills

    def format_for_llm(self, skills: list[dict]) -> str:
        """Format skills for LLM context"""
        context = "=== KNOWLEDGE BASE ===\n\n"

        for i, skill in enumerate(skills, 1):
            context += f"=== SKILL {i}: {skill['title']} ===\n\n"
            context += skill['content']
            context += "\n\n---\n\n"

        return context

# Usage in product
loader = SkillLoader(Path("/path/to/skills"))
skills = loader.load_skills(categories=["Security", "Compliance"])
context = loader.format_for_llm(skills)

# Add to LLM prompt
response = llm.complete(
    system=f"{context}\n\nUse the skills above to answer questions.",
    messages=[...]
)
```

**5.2 Mount skills directory in product deployment**
```yaml
# docker-compose.yml or k8s config
volumes:
  - ./skills:/app/knowledge/skills:ro  # Read-only mount
```

---

## Migration Strategy

### Week 1: Setup (No Breaking Changes)
1. ✅ Export existing skills to `skills/` directory
2. ✅ Commit to git
3. ✅ Build sync scripts
4. ✅ Test bidirectional sync (git ↔ database)

### Week 2: Dual Write (Both Git + Database)
1. ✅ Update web app to write to both git and database
2. ✅ Set up GitHub Action for auto-sync
3. ✅ Test thoroughly in staging
4. ✅ Deploy to production

### Week 3: Product Integration
1. ✅ Product teams integrate skill loader
2. ✅ Test in staging environment
3. ✅ Deploy to production

### Week 4: Eng Adoption
1. ✅ Documentation for eng teams on PR workflow
2. ✅ First eng-created skills via PR
3. ✅ Verify sync works end-to-end

---

## Developer Workflow (Engineering)

### Adding a New Skill via PR
```bash
# 1. Create branch
git checkout -b add-skill-api-rate-limits

# 2. Create skill file
cat > skills/api-rate-limits.md << 'EOF'
---
id: 550e8400-e29b-41d4-a716-446655440123
title: API Rate Limits
categories: [API, Technical, Integration]
created: 2025-12-19T15:00:00Z
updated: 2025-12-19T15:00:00Z
owners:
  - name: John Doe
    email: john@montecarlodata.com
sources:
  - url: https://docs.montecarlodata.com/api/rate-limits
    addedAt: 2025-12-19T15:00:00Z
active: true
---

# API Rate Limits

## Overview
Monte Carlo APIs enforce rate limits to ensure fair usage...

## Common Questions
...
EOF

# 3. Commit and push
git add skills/api-rate-limits.md
git commit -m "Add skill: API Rate Limits"
git push origin add-skill-api-rate-limits

# 4. Create PR
gh pr create --title "Add API Rate Limits skill" --body "Adds documentation for API rate limits"

# 5. After merge, GitHub Action syncs to database automatically
```

---

## Benefits of This Approach

### ✅ Single Source of Truth
- Git is authoritative
- Database is just a cache
- No confusion about where to edit

### ✅ Version Control
- Full git history of every skill change
- Blame shows who changed what
- Revert changes easily

### ✅ Engineering Workflow
- Engineers create skills via PRs
- Code review process for knowledge
- Automated testing possible

### ✅ Product Integration
- Direct file access (fast)
- No API dependency
- Can bundle skills with product

### ✅ Portability
- Anthropic-compatible format
- Works with any LLM
- Can export to other systems

### ✅ Web UI Still Works
- Non-technical users edit via UI
- UI commits to git automatically
- Best of both worlds

---

## Refresh Workflow (URL-Based Skills)

### Current Refresh Flow
The refresh workflow **continues to work exactly the same** from the user's perspective:

1. User clicks "Refresh" button in UI
2. System fetches content from source URLs
3. LLM generates draft update with change highlights
4. User reviews diff (side-by-side comparison)
5. User approves or rejects changes
6. If approved: Update database + commit to git

### Implementation

**Step 4.1: Update refresh endpoint to commit to git**
```typescript
// src/app/api/skills/[id]/refresh/route.ts (PUT handler)
import { saveSkillAndCommit } from "@/lib/skillGitSync";
import { readSkillFile } from "@/lib/skillFiles";

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const { title, content, changeHighlights } = await request.json();

  // Get existing skill
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) return errors.notFound("Skill");

  const now = new Date();
  const sourceUrls = (skill.sourceUrls as SourceUrl[]) || [];
  const updatedUrls = sourceUrls.map(u => ({
    ...u,
    lastFetchedAt: now.toISOString(),
  }));

  // Update database
  const updatedSkill = await prisma.skill.update({
    where: { id },
    data: {
      title,
      content,
      lastRefreshedAt: now,
      sourceUrls: updatedUrls,
      history: [
        ...(skill.history || []),
        {
          date: now.toISOString(),
          action: "refreshed",
          summary: changeHighlights?.join("; ") || "Refreshed from source URLs",
          user: auth.session.user.email,
        },
      ],
    },
  });

  // Commit to git
  const slug = getSkillSlug(skill.title);
  await saveSkillAndCommit(
    slug,
    {
      id: skill.id,
      slug,
      title,
      content,
      categories: skill.categories || [],
      owners: skill.owners || [],
      sources: updatedUrls,
      created: skill.createdAt.toISOString(),
      updated: now.toISOString(),
      active: skill.isActive,
    },
    `Refresh skill: ${title}\n\n${changeHighlights?.join("\n") || "Updated from source URLs"}`,
    {
      name: auth.session.user.name || "Unknown",
      email: auth.session.user.email || "unknown@example.com",
    }
  );

  return apiSuccess({ skill: updatedSkill });
}
```

### Benefits of Git-First Refresh

**✅ Version History**
- Every refresh creates a git commit
- See exactly what changed and when
- `git blame` shows who refreshed and why

**✅ Rollback Capability**
- If refresh introduces errors, revert the commit
- Compare refreshes: `git diff HEAD~1 skills/compliance.md`

**✅ Audit Trail**
- Git history + database history
- Transparent change tracking

**✅ Zero UI Changes**
- Users see the same refresh button
- Same diff preview
- Same approval workflow

### Example Git History After Refreshes
```bash
$ git log --oneline skills/compliance-and-certifications.md

a3f829c Refresh skill: Compliance & Certifications (jane@mc.com)
        - Updated SOC 2 audit date to 2025
        - Added HIPAA BAA requirements
        - Updated auditor name

b2e718d Refresh skill: Compliance & Certifications (jane@mc.com)
        - No changes detected

9d16f40 Create skill: Compliance & Certifications (jane@mc.com)
```

---

## How Git Makes Update Surfacing BETTER

### Current Approach (Database Only)
**Build stage update detection:**
1. LLM checks if URL already exists in database
2. Shows inline diff using `diffLines` library
3. User reviews change highlights
4. Approve → database update

**Limitations:**
- ❌ No history of previous updates
- ❌ Can't compare skill at different points in time
- ❌ Can't see WHO made each change
- ❌ Can't rollback to previous version easily
- ❌ Limited to database `history` JSON field

### Git-First Approach (Git + Database)
**Same UI, but with git superpowers:**

#### 1. **Richer Diff Visualization**
```typescript
// Current: Shows diff between current content and new draft
const diff = diffLines(skill.content, draftContent);

// Git-enhanced: Can show diff against ANY previous version
const diff = diffLines(
  await getSkillContentAtCommit(skillId, 'HEAD~1'),  // Last version
  draftContent
);

// Or show all changes in last 30 days
const changes = await getSkillChangesInRange(skillId, '30 days ago', 'now');
```

#### 2. **Change History Timeline**
```tsx
// New component: SkillHistoryTimeline.tsx
<div>
  <h3>Recent Changes</h3>
  {commits.map(commit => (
    <div key={commit.sha}>
      <div>{commit.message}</div>
      <div>{commit.author} - {commit.date}</div>
      <button onClick={() => showDiff(commit.sha)}>View Diff</button>
      <button onClick={() => revertTo(commit.sha)}>Revert</button>
    </div>
  ))}
</div>
```

#### 3. **Better Stale Detection**
```typescript
// Current: lastRefreshedAt field in database
const daysSinceUpdate = (now - skill.lastRefreshedAt) / (1000 * 60 * 60 * 24);

// Git-enhanced: See commit activity
const commits = await execAsync(`git log --since="90 days ago" -- skills/${slug}.md`);
if (commits.length === 0) {
  // Truly stale - no activity in 90 days
} else {
  // Show WHO updated it and WHAT changed
  showCommitHistory(commits);
}
```

#### 4. **Automatic Change Detection**
```typescript
// scripts/detect-skill-changes.ts
// Run daily via cron or GitHub Action

const changedSkills = await execAsync(`
  git log --since="24 hours ago" --name-only --pretty=format: -- skills/
`);

if (changedSkills.length > 0) {
  // Send Slack notification
  sendSlackMessage(`📝 ${changedSkills.length} skills updated in last 24h:\n${changedSkills.join('\n')}`);

  // Update dashboard
  await updateSkillActivityDashboard(changedSkills);
}
```

#### 5. **PR-Based Review for Eng Updates**
When engineering creates a skill via PR:
```yaml
# .github/workflows/skill-pr-review.yml
name: Skill PR Review

on:
  pull_request:
    paths:
      - 'skills/**'

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate PR comment with skill changes
        run: |
          # Parse changed skills
          CHANGED=$(git diff --name-only origin/main...HEAD -- skills/)

          # For each changed skill, show diff
          for skill in $CHANGED; do
            echo "## $skill"
            git diff origin/main...HEAD -- "$skill"
          done > skill-changes.md

      - name: Post comment to PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const changes = fs.readFileSync('skill-changes.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Skill Changes\n\n${changes}`
            });
```

#### 6. **Visual Diff in UI (Enhanced)**
```typescript
// src/app/knowledge/[id]/components/SkillDiffViewer.tsx
import { useState } from "react";

export function SkillDiffViewer({ skillId, slug }: { skillId: string, slug: string }) {
  const [compareWith, setCompareWith] = useState<'current' | 'HEAD~1' | 'HEAD~5' | '30d'>('HEAD~1');

  const loadDiff = async () => {
    const response = await fetch(`/api/skills/${skillId}/diff?compare=${compareWith}`);
    const { diff, metadata } = await response.json();

    return {
      diff,
      author: metadata.author,
      date: metadata.date,
      commitMessage: metadata.message,
    };
  };

  return (
    <div>
      <select value={compareWith} onChange={e => setCompareWith(e.target.value)}>
        <option value="current">Compare with current</option>
        <option value="HEAD~1">Compare with last version</option>
        <option value="HEAD~5">Compare with 5 versions ago</option>
        <option value="30d">Compare with 30 days ago</option>
      </select>

      <DiffVisualization diff={diff} />

      <div>
        Last updated by: {author} on {date}
        Commit: {commitMessage}
      </div>
    </div>
  );
}
```

#### 7. **Rollback Capability**
```typescript
// src/app/api/skills/[id]/rollback/route.ts
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { commitSha } = await request.json();

  // Get skill content at that commit
  const { stdout: content } = await execAsync(
    `git show ${commitSha}:skills/${slug}.md`
  );

  // Parse frontmatter
  const { data, content: body } = matter(content);

  // Update database
  await prisma.skill.update({
    where: { id },
    data: {
      title: data.title,
      content: body,
      updatedAt: new Date(),
      history: [
        ...(skill.history || []),
        {
          date: new Date().toISOString(),
          action: "rollback",
          summary: `Rolled back to version from ${commitSha}`,
          user: auth.session.user.email,
        },
      ],
    },
  });

  // Commit the rollback
  await saveSkillAndCommit(
    slug,
    skill,
    `Rollback skill: ${skill.title} to ${commitSha}`,
    author
  );

  return apiSuccess({ skill });
}
```

---

## New Features Enabled by Git

### 1. **Skill Activity Dashboard**
```tsx
// src/app/knowledge/activity/page.tsx
export default async function SkillActivityPage() {
  const recentChanges = await getRecentSkillChanges('7 days');

  return (
    <div>
      <h1>Skill Activity (Last 7 Days)</h1>

      {recentChanges.map(change => (
        <div key={change.commit}>
          <div>{change.skillTitle}</div>
          <div>{change.author} - {change.date}</div>
          <div>Changes: {change.changeHighlights.join(', ')}</div>
          <button>View Full Diff</button>
        </div>
      ))}
    </div>
  );
}
```

### 2. **Blame View** (Who Wrote What)
```tsx
// Shows who wrote each line of a skill
const blame = await execAsync(`git blame skills/${slug}.md`);

// UI shows:
// Line 45: "SOC 2 Type II certified" - jane@mc.com (2024-03-15)
// Line 46: "ISO 27001 since 2021" - bob@mc.com (2024-12-01)
```

### 3. **Change Frequency Heatmap**
```typescript
// Which skills change most often?
const skillFrequency = await execAsync(`
  git log --format= --name-only -- skills/ | sort | uniq -c | sort -rn
`);

// Shows:
// 45 changes - compliance-and-certifications.md (most active)
// 12 changes - data-encryption.md
//  3 changes - api-rate-limits.md (stable)
```

### 4. **Email Digest of Changes**
```typescript
// scripts/send-skill-digest.ts
// Run weekly via cron

const changes = await getSkillChangesInRange('7 days ago', 'now');

const email = `
Skills Updated This Week:

${changes.map(c => `
  - ${c.skillTitle}
    Updated by: ${c.author}
    Changes: ${c.changeHighlights.join(', ')}
    View: ${appUrl}/knowledge/${c.skillId}
`).join('\n')}
`;

sendEmail(recipients, "Weekly Skill Updates", email);
```

### 5. **Compare Across Branches**
```bash
# Compare skills in staging vs production
git diff main..staging -- skills/

# See what will change when we deploy
git diff main..HEAD -- skills/
```

---

## Open Questions

1. **Permissions**: How should we handle access control?
   - Git repo permissions (GitHub teams)
   - Database role-based access control
   - API authentication

2. **Conflicts**: What if web UI and git PR modify same skill?
   - Last write wins?
   - Merge conflict resolution UI?
   - Lock files during edit?

3. **Large files**: What if skills become very large?
   - Split into multiple files?
   - Use Git LFS?
   - Pagination in UI?

4. **Search/indexing**: How should product search skills?
   - Read all files on startup?
   - Use `.skills/metadata.json` index?
   - Elasticsearch/Algolia?

---

## Next Steps

1. **Review this architecture** - Does it meet MC's needs?
2. **Decide on permissions model** - GitHub teams? RBAC?
3. **Start Phase 1** - Export skills to git
4. **Build sync layer** - Bidirectional git ↔ database
5. **Test thoroughly** - Staging environment
6. **Deploy to prod** - Gradual rollout

---

Generated: 2025-12-19
Author: Claude Code
Status: Architecture Proposal - Ready for Review
