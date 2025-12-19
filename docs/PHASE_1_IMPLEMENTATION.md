# Phase 1 Implementation: Skills to Git

**Date**: 2025-12-19
**Status**: Implementation Plan - Ready to Build
**Timeline**: 2-3 weeks
**Goal**: Git-backed skills with review toggle infrastructure (disabled by default)

---

## Overview

**What we're building**:
- Export existing skills to git repository
- Add git commit on every skill save
- Add review toggle infrastructure (OFF by default)
- Zero workflow changes for users
- Build foundation for future review system

**What users experience**:
- Same UI, same buttons, same workflow
- Git is completely invisible
- Fast iteration continues
- Version history available for rollback

---

## Implementation Phases

### **Week 1: Foundation & Infrastructure**

#### Day 1-2: Git Setup & Schema Changes
- [ ] Create `skills/` directory structure
- [ ] Add review fields to Prisma schema
- [ ] Run database migration
- [ ] Create git utilities library

#### Day 3-4: Export & Sync Scripts
- [ ] Export existing skills to markdown files
- [ ] Build sync scripts (git → database)
- [ ] Test bidirectional sync

#### Day 5: Testing & Validation
- [ ] Verify all skills exported correctly
- [ ] Test sync processes
- [ ] Initial commit to git

### **Week 2: Core Integration**

#### Day 6-8: Skill Save Integration
- [ ] Add git commit to skill create endpoint
- [ ] Add git commit to skill update endpoint
- [ ] Add git commit to skill refresh endpoint
- [ ] Add review mode checks (defaulting to disabled)

#### Day 9-10: Testing & Polish
- [ ] Test skill creation with git
- [ ] Test skill editing with git
- [ ] Test skill refresh with git
- [ ] Verify database + git stay in sync

### **Week 3: UI Enhancements & Review Toggle**

#### Day 11-13: Admin Settings
- [ ] Add review toggle to admin UI
- [ ] Add category review settings
- [ ] Store settings in database
- [ ] Default: Reviews OFF

#### Day 14-15: Final Testing & Deployment
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Documentation
- [ ] Deploy to production

---

## Detailed Task Breakdown

### Task 1: Directory Structure

```bash
# Create directory structure
mkdir -p skills/.skills

# Add .gitignore
echo "node_modules/" > skills/.gitignore

# Add README
cat > skills/README.md << 'EOF'
# Skills Knowledge Base

This directory contains all skills in markdown format.

## Structure
- Each skill is a single `.md` file
- Filename is slug of skill title
- YAML frontmatter for metadata
- Markdown content for skill body

## Editing
- **Web UI**: Use the web app to edit skills (recommended)
- **Direct Git**: Edit markdown files directly and commit

## Sync
- Web UI changes → auto-commit to git
- Git changes → sync to database via GitHub Action
EOF

git add skills/
git commit -m "Initialize skills directory structure"
```

---

### Task 2: Prisma Schema Migration

```prisma
// prisma/schema.prisma

model Skill {
  id              String   @id @default(uuid())
  title           String
  content         String   @db.Text
  categories      String[]
  quickFacts      Json?    // DEPRECATED - migrate to content
  edgeCases       String[] // DEPRECATED - migrate to content
  sourceUrls      Json?
  sourceDocuments Json?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastRefreshedAt DateTime?
  createdBy       String?
  ownerId         String?
  owner           User?    @relation("SkillOwner", fields: [ownerId], references: [id])
  owners          Json?
  history         Json?

  // NEW: Review system fields (for future use)
  requiresReview  Boolean?  // NULL = inherit from category
  minApprovers    Int?      // NULL = use category default
  status          SkillStatus @default(PUBLISHED)
  draftContent    String?   @db.Text
  pendingReviewers Json?
  reviewRequestedAt DateTime?
  reviewRequestedBy String?
  reviewComments  Json?

  @@index([isActive, updatedAt])
  @@index([status])
}

enum SkillStatus {
  DRAFT          // Saved but not published
  IN_REVIEW      // Submitted for review
  PUBLISHED      // Live and active (default)
  ARCHIVED       // Archived/inactive
}

model SkillCategory {
  id              String   @id @default(uuid())
  name            String   @unique
  description     String?  @db.Text
  color           String?
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // NEW: Review defaults for this category
  requiresReview  Boolean  @default(false)
  minApprovers    Int      @default(1)
  approverEmails  String[] @default([])
}

// Update AppSetting to support review mode
model AppSetting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String   @db.Text // Store as JSON for complex values
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Migration command**:
```bash
npx prisma migrate dev --name add_review_system
npx prisma generate
```

---

### Task 3: Git Utilities Library

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

const SKILLS_DIR = path.join(process.cwd(), "skills");

export async function readSkillFile(slug: string): Promise<SkillFile | null> {
  try {
    const filepath = path.join(SKILLS_DIR, `${slug}.md`);
    const raw = await fs.readFile(filepath, "utf-8");
    const { data, content } = matter(raw);

    return {
      id: data.id,
      slug,
      title: data.title,
      content: content.trim(),
      categories: data.categories || [],
      owners: data.owners || [],
      sources: data.sources || [],
      created: data.created,
      updated: data.updated,
      active: data.active !== false,
    };
  } catch (error) {
    return null;
  }
}

export async function listSkillFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(SKILLS_DIR);
    return files.filter(f => f.endsWith(".md") && f !== "README.md");
  } catch (error) {
    return [];
  }
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
  const filepath = path.join(SKILLS_DIR, `${slug}.md`);
  await fs.writeFile(filepath, markdown, "utf-8");
}

export function getSkillSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
```

---

### Task 4: Git Sync Library

```typescript
// src/lib/skillGitSync.ts

import { exec } from "child_process";
import { promisify } from "util";
import { writeSkillFile, SkillFile, getSkillSlug } from "./skillFiles";

const execAsync = promisify(exec);

export interface GitAuthor {
  name: string;
  email: string;
}

export async function saveSkillAndCommit(
  slug: string,
  skill: SkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<void> {
  // Write to file
  await writeSkillFile(slug, skill);

  // Git add
  const filepath = `skills/${slug}.md`;
  await execAsync(`git add "${filepath}"`);

  // Check if there are changes to commit
  try {
    const { stdout } = await execAsync("git diff --staged --quiet");
    // If no error, no changes to commit
    return;
  } catch (error) {
    // Has changes, proceed with commit
  }

  // Git commit with author
  const escapedMessage = commitMessage.replace(/"/g, '\\"');
  await execAsync(
    `git commit -m "${escapedMessage}" --author="${author.name} <${author.email}>"`
  );

  // Optionally push (or let GitHub Action handle it)
  // await execAsync("git push origin main");
}

export async function getSkillCommitHistory(slug: string, limit: number = 10): Promise<Array<{
  sha: string;
  author: string;
  date: string;
  message: string;
}>> {
  try {
    const { stdout } = await execAsync(
      `git log -${limit} --format=%H|%an|%ae|%ai|%s -- skills/${slug}.md`
    );

    return stdout.trim().split("\n").map(line => {
      const [sha, name, email, date, message] = line.split("|");
      return {
        sha,
        author: `${name} <${email}>`,
        date,
        message,
      };
    });
  } catch (error) {
    return [];
  }
}

export async function getSkillContentAtCommit(
  slug: string,
  commitSha: string
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git show ${commitSha}:skills/${slug}.md`
    );
    return stdout;
  } catch (error) {
    return null;
  }
}

export async function revertSkillToCommit(
  slug: string,
  commitSha: string,
  author: GitAuthor
): Promise<void> {
  const content = await getSkillContentAtCommit(slug, commitSha);
  if (!content) {
    throw new Error(`Could not find skill at commit ${commitSha}`);
  }

  // Parse the content
  const matter = require("gray-matter");
  const { data, content: body } = matter(content);

  // Write to file
  await writeSkillFile(slug, {
    ...data,
    content: body,
    updated: new Date().toISOString(),
  });

  // Commit the revert
  await execAsync(`git add skills/${slug}.md`);
  await execAsync(
    `git commit -m "Revert skill: ${data.title} to ${commitSha}" --author="${author.name} <${author.email}>"`
  );
}
```

---

### Task 5: Export Existing Skills

```typescript
// scripts/export-skills-to-git.ts

import { PrismaClient } from "@prisma/client";
import { writeSkillFile, getSkillSlug } from "../src/lib/skillFiles";
import { saveSkillAndCommit } from "../src/lib/skillGitSync";

const prisma = new PrismaClient();

async function exportSkills() {
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    include: { owner: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Exporting ${skills.length} skills to git...`);

  for (const skill of skills) {
    const slug = getSkillSlug(skill.title);

    const skillFile = {
      id: skill.id,
      slug,
      title: skill.title,
      content: skill.content,
      categories: skill.categories || [],
      owners: (skill.owners as any) || [],
      sources: (skill.sourceUrls as any) || [],
      created: skill.createdAt.toISOString(),
      updated: skill.updatedAt.toISOString(),
      active: skill.isActive,
    };

    await saveSkillAndCommit(
      slug,
      skillFile,
      `Export skill: ${skill.title}`,
      {
        name: skill.owner?.name || skill.createdBy || "System",
        email: skill.owner?.email || skill.createdBy || "system@example.com",
      }
    );

    console.log(`✓ Exported: ${skill.title}`);
  }

  console.log(`\n✅ Exported ${skills.length} skills to skills/ directory`);
  console.log(`📝 Git history created for all skills`);
}

exportSkills()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run command**:
```bash
npx tsx scripts/export-skills-to-git.ts
```

---

### Task 6: Sync Script (Git → Database)

```typescript
// scripts/sync-skills-to-db.ts

import { PrismaClient } from "@prisma/client";
import { listSkillFiles, readSkillFile } from "../src/lib/skillFiles";

const prisma = new PrismaClient();

async function syncSkillsToDatabase() {
  const files = await listSkillFiles();

  console.log(`Syncing ${files.length} skills to database...`);

  for (const filename of files) {
    const slug = filename.replace(".md", "");
    const skill = await readSkillFile(slug);

    if (!skill) {
      console.log(`⚠️  Could not read: ${filename}`);
      continue;
    }

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
        status: "PUBLISHED", // Default status
        createdAt: new Date(skill.created),
        updatedAt: new Date(skill.updated),
      },
    });

    console.log(`✓ Synced: ${skill.title}`);
  }

  console.log(`\n✅ Synced ${files.length} skills to database`);
}

syncSkillsToDatabase()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Add to package.json**:
```json
{
  "scripts": {
    "skills:export": "tsx scripts/export-skills-to-git.ts",
    "skills:sync": "tsx scripts/sync-skills-to-db.ts",
    "skills:index": "tsx scripts/generate-skill-index.ts"
  }
}
```

---

### Task 7: Update Skill API Endpoints

```typescript
// src/app/api/skills/route.ts (POST - Create)

import { saveSkillAndCommit } from "@/lib/skillGitSync";
import { getSkillSlug } from "@/lib/skillFiles";
import { getReviewMode } from "@/lib/reviewConfig";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const body = await request.json();
  const validation = validateBody(createSkillSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const data = validation.data;

  // Check review mode (will be 'none' by default)
  const reviewMode = await getReviewMode();
  const status = reviewMode === 'none' ? 'PUBLISHED' : 'DRAFT';

  // Create skill in database
  const skill = await prisma.skill.create({
    data: {
      title: data.title,
      content: data.content,
      categories: data.categories,
      sourceUrls: data.sourceUrls,
      isActive: data.isActive,
      status, // PUBLISHED if reviews disabled
      createdBy: auth.session.user.email || undefined,
      ownerId: auth.session.user.id,
      owners: data.owners,
      history: [{
        date: new Date().toISOString(),
        action: "created",
        summary: "Skill created",
        user: auth.session.user.email,
      }],
    },
  });

  // If reviews are disabled (default), commit to git immediately
  if (status === 'PUBLISHED') {
    const slug = getSkillSlug(skill.title);
    await saveSkillAndCommit(
      slug,
      {
        id: skill.id,
        slug,
        title: skill.title,
        content: skill.content,
        categories: skill.categories || [],
        owners: skill.owners as any || [],
        sources: skill.sourceUrls as any || [],
        created: skill.createdAt.toISOString(),
        updated: skill.updatedAt.toISOString(),
        active: skill.isActive,
      },
      `Create skill: ${skill.title}`,
      {
        name: auth.session.user.name || "Unknown",
        email: auth.session.user.email || "unknown@example.com",
      }
    );
  }

  await invalidateSkillCache();

  return apiSuccess({ skill }, { status: 201 });
}
```

---

### Task 8: Review Configuration Helper

```typescript
// src/lib/reviewConfig.ts

import { prisma } from "./prisma";

export type ReviewMode = 'none' | 'self' | 'team';

export async function getReviewMode(): Promise<ReviewMode> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: 'review_mode' },
  });

  return (setting?.value as ReviewMode) || 'none';
}

export async function setReviewMode(mode: ReviewMode): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: 'review_mode' },
    update: { value: mode },
    create: { key: 'review_mode', value: mode },
  });
}

export async function getReviewRequired(skillId: string): Promise<boolean> {
  // Always return false in Phase 1 (reviews disabled)
  return false;

  // Future implementation:
  // const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  // if (!skill) return false;
  // if (skill.requiresReview !== null) return skill.requiresReview;
  // const category = await prisma.skillCategory.findFirst({
  //   where: { name: { in: skill.categories } },
  // });
  // return category?.requiresReview || false;
}
```

---

### Task 9: Admin Settings UI (Toggle Infrastructure)

```tsx
// src/app/admin/settings/components/ReviewsTab.tsx

"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";

export function ReviewsTab() {
  const [reviewMode, setReviewMode] = useState<'none' | 'self' | 'team'>('none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReviewMode();
  }, []);

  async function fetchReviewMode() {
    const res = await fetch('/api/admin/review-settings');
    const data = await res.json();
    setReviewMode(data.reviewMode || 'none');
  }

  async function handleSave() {
    setLoading(true);
    await fetch('/api/admin/review-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewMode }),
    });
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Review Mode</h2>
        <p className="text-sm text-gray-600 mb-6">
          Control how skills are reviewed before publishing.
        </p>

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <input
              type="radio"
              id="review-none"
              checked={reviewMode === 'none'}
              onChange={() => setReviewMode('none')}
              className="mt-1"
            />
            <div>
              <label htmlFor="review-none" className="font-medium">
                Disabled (Default)
              </label>
              <p className="text-sm text-gray-600">
                Skills save directly without approval. Fast iteration mode.
                Recommended while building your knowledge base.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <input
              type="radio"
              id="review-self"
              checked={reviewMode === 'self'}
              onChange={() => setReviewMode('self')}
              className="mt-1"
            />
            <div>
              <label htmlFor="review-self" className="font-medium">
                Self-Review
              </label>
              <p className="text-sm text-gray-600">
                Preview changes before publishing. Catch your own mistakes.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <input
              type="radio"
              id="review-team"
              checked={reviewMode === 'team'}
              onChange={() => setReviewMode('team')}
              className="mt-1"
            />
            <div>
              <label htmlFor="review-team" className="font-medium">
                Team Review
              </label>
              <p className="text-sm text-gray-600">
                Require approval from reviewers. Formal review process.
              </p>
            </div>
          </div>
        </div>

        {reviewMode === 'none' && (
          <Alert severity="info" className="mt-6">
            ✅ Fast mode enabled. All skills save directly to git without approval.
          </Alert>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </Card>
    </div>
  );
}
```

---

## Testing Checklist

### Pre-Deployment Tests

- [ ] **Export test**: All skills export to markdown correctly
- [ ] **Sync test**: Sync script imports skills without errors
- [ ] **Create test**: New skill creates git commit
- [ ] **Update test**: Skill edit creates git commit
- [ ] **Refresh test**: Skill refresh creates git commit with change notes
- [ ] **History test**: Can view git commit history
- [ ] **Review mode test**: Toggle works, defaults to 'none'
- [ ] **Performance test**: No slowdown on skill operations
- [ ] **Database sync**: Database and git stay in sync

### Post-Deployment Validation

- [ ] Create a new skill → Verify git commit
- [ ] Edit existing skill → Verify git commit
- [ ] Refresh a skill → Verify git commit with highlights
- [ ] Check git log → Verify commit messages are clear
- [ ] Verify admin toggle → Defaults to "Disabled"

---

## Deployment Steps

### 1. Database Migration
```bash
npx prisma migrate deploy
npx prisma generate
```

### 2. Export Existing Skills
```bash
npm run skills:export
git push origin main
```

### 3. Deploy Application Code
```bash
git add .
git commit -m "Phase 1: Add git-backed skills with review infrastructure"
git push origin main

# Deploy to production (your deployment process)
```

### 4. Verify Production
- Check skills/ directory has all files
- Create test skill, verify git commit
- Check admin settings, verify toggle present

---

## Rollback Plan

If issues occur:

1. **Revert code**: `git revert <commit>`
2. **Database rollback**: `npx prisma migrate rollback`
3. **Clear skills directory**: Keep git commits as backup
4. **App continues working**: Database operations unaffected

---

## Success Criteria

- ✅ All existing skills exported to `skills/` directory
- ✅ New skills create git commits automatically
- ✅ Skill edits create git commits automatically
- ✅ Skill refreshes create git commits automatically
- ✅ Review toggle exists but defaults to OFF
- ✅ Zero workflow changes for users
- ✅ No performance degradation
- ✅ Database and git stay in sync

---

## Next Steps After Phase 1

Once Phase 1 is stable:

**Phase 2** (Optional - When Ready):
- Enable self-review mode
- Add "Save as Draft" button
- Add "Publish" button
- Test with internal team

**Phase 3** (Optional - When Needed):
- Enable team review mode
- Build review dashboard
- Add notifications
- Full review workflow

---

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Foundation | Schema, scripts, export skills |
| **Week 2** | Integration | Git commits on save, sync working |
| **Week 3** | Polish | Admin toggle, testing, deployment |

**Total**: 2-3 weeks for complete Phase 1

---

Generated: 2025-12-19
Author: Claude Code
Status: Ready to Build - Let's Start!
