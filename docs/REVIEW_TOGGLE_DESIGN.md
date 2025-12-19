# Review Toggle System Design

**Date**: 2025-12-19
**Status**: Implementation Plan
**Goal**: Optional UI-based review workflow that can be toggled on/off

---

## Requirements

1. **While building knowledge base**: Reviews OFF (fast iteration)
2. **After knowledge base mature**: Reviews ON (quality control)
3. **Granular control**: Toggle per skill, category, or globally
4. **UI-based**: No GitHub dependency
5. **Git-backed**: All changes still commit to git for history

---

## Architecture: Three-State System

### State 1: Direct Save (Default - Building Phase)
```
User edits skill → Click "Save" → Commits directly to git
```
- ✅ **Fast**: Instant save
- ✅ **No friction**: No approval needed
- ✅ **Git history**: Still tracked

### State 2: Self-Review (Optional - Quality Check)
```
User edits skill → Click "Save as Draft" → Review own changes → "Publish"
```
- ✅ **Catch mistakes**: Preview before publishing
- ✅ **Still fast**: Single user, no waiting
- ✅ **Git history**: Only published versions committed

### State 3: Team Review (Future - Compliance)
```
User edits skill → "Submit for Review" → Assigned reviewer approves → Commits
```
- ✅ **Formal approval**: Second pair of eyes
- ✅ **Audit trail**: Who approved what
- ✅ **Git history**: Approved changes only

---

## Database Schema Changes

### Add Review Configuration

```prisma
// prisma/schema.prisma

model Skill {
  // ... existing fields

  // Review settings (NULL = inherit from category)
  requiresReview  Boolean?  // NULL = use category default
  minApprovers    Int?      // NULL = use category default (1 or 2)

  // Review state
  status          SkillStatus  @default(PUBLISHED)
  draftContent    String?      @db.Text // Draft version if in review

  // Pending review
  pendingReviewers Json?      // [{userId, name, email, status: 'pending'|'approved'|'rejected'}]
  reviewRequestedAt DateTime?
  reviewRequestedBy String?

  // Review history
  reviewComments  Json?       // [{userId, comment, lineNumber?, createdAt}]
}

enum SkillStatus {
  DRAFT          // Saved but not published
  IN_REVIEW      // Submitted for review
  PUBLISHED      // Live and active
  ARCHIVED       // Archived/inactive
}

model SkillCategory {
  // ... existing fields

  // Review defaults for this category
  requiresReview  Boolean  @default(false)
  minApprovers    Int      @default(1)
  approverEmails  String[] // Whitelist of reviewers
}

// Global settings
model AppSetting {
  // ... existing fields

  // Add review settings
  // key = "review_enabled_globally"
  // value = "true" | "false"
}
```

---

## UI Components

### 1. Admin Settings - Global Toggle

```tsx
// src/app/admin/settings/components/ReviewsTab.tsx

export function ReviewsTab() {
  const [globalReviewEnabled, setGlobalReviewEnabled] = useState(false);

  return (
    <div>
      <h2>Review Settings</h2>

      <Card>
        <h3>Global Review Mode</h3>
        <p>Enable formal review workflows for all skills.</p>

        <Switch
          checked={globalReviewEnabled}
          onChange={setGlobalReviewEnabled}
          label={globalReviewEnabled ? "Reviews Enabled" : "Reviews Disabled"}
        />

        {!globalReviewEnabled && (
          <Alert severity="info">
            Reviews are disabled. All skills save directly without approval.
            This is recommended while building your knowledge base.
          </Alert>
        )}

        {globalReviewEnabled && (
          <Alert severity="success">
            Reviews are enabled. Skills will require approval before publishing.
          </Alert>
        )}
      </Card>

      <Card>
        <h3>Review Behavior</h3>
        <p>What happens when reviews are enabled?</p>

        <RadioGroup>
          <Radio value="self" label="Self-Review (Preview before publish)" />
          <Radio value="team" label="Team Review (Require approval)" />
        </RadioGroup>
      </Card>
    </div>
  );
}
```

### 2. Category Settings - Per-Category Toggle

```tsx
// src/app/admin/settings/components/CategoryReviewSettings.tsx

export function CategoryReviewSettings({ category }: { category: SkillCategory }) {
  return (
    <Card>
      <h3>{category.name}</h3>

      <FormGroup>
        <Switch
          checked={category.requiresReview}
          onChange={(checked) => updateCategory(category.id, { requiresReview: checked })}
          label="Require reviews for this category"
        />

        {category.requiresReview && (
          <>
            <Select label="Minimum Approvers">
              <option value="1">1 approver</option>
              <option value="2">2 approvers</option>
            </Select>

            <ChipInput
              label="Approved Reviewers (emails)"
              value={category.approverEmails}
              onChange={(emails) => updateCategory(category.id, { approverEmails: emails })}
              placeholder="jane@mc.com, bob@mc.com"
            />
          </>
        )}
      </FormGroup>
    </Card>
  );
}
```

### 3. Skill Edit - Conditional Save Buttons

```tsx
// src/app/knowledge/[id]/edit/page.tsx

export default function SkillEditPage({ skill }: { skill: Skill }) {
  const reviewRequired = getReviewRequired(skill);
  const reviewMode = getReviewMode(); // 'none' | 'self' | 'team'

  return (
    <div>
      <SkillEditor skill={skill} onChange={handleChange} />

      {/* No reviews - direct save */}
      {reviewMode === 'none' && (
        <Button onClick={saveDirectly}>
          Save
        </Button>
      )}

      {/* Self-review - save as draft */}
      {reviewMode === 'self' && (
        <>
          <Button onClick={saveAsDraft} variant="secondary">
            Save as Draft
          </Button>
          <Button onClick={publishDirectly}>
            Publish
          </Button>
        </>
      )}

      {/* Team review - submit for approval */}
      {reviewMode === 'team' && reviewRequired && (
        <>
          <Button onClick={saveAsDraft} variant="secondary">
            Save Draft
          </Button>
          <Button onClick={submitForReview}>
            Submit for Review
          </Button>
        </>
      )}

      {reviewMode === 'team' && !reviewRequired && (
        <Button onClick={saveDirectly}>
          Save (No review required)
        </Button>
      )}
    </div>
  );
}
```

### 4. Review Dashboard (When Enabled)

```tsx
// src/app/knowledge/reviews/page.tsx

export default function ReviewsPage() {
  const pendingReviews = usePendingReviews();

  return (
    <div>
      <h1>Pending Reviews</h1>

      {pendingReviews.map(skill => (
        <Card key={skill.id}>
          <div>
            <h3>{skill.title}</h3>
            <div>Requested by: {skill.reviewRequestedBy}</div>
            <div>Categories: {skill.categories.join(", ")}</div>
          </div>

          <DiffViewer
            original={skill.content}
            updated={skill.draftContent}
          />

          <CommentSection
            comments={skill.reviewComments}
            onAddComment={(comment) => addReviewComment(skill.id, comment)}
          />

          <ReviewActions>
            <Button onClick={() => approveSkill(skill.id)}>
              Approve
            </Button>
            <Button onClick={() => requestChanges(skill.id)} variant="warning">
              Request Changes
            </Button>
            <Button onClick={() => rejectSkill(skill.id)} variant="danger">
              Reject
            </Button>
          </ReviewActions>
        </Card>
      ))}
    </div>
  );
}
```

### 5. Review Status Indicator

```tsx
// src/components/SkillStatusBadge.tsx

export function SkillStatusBadge({ skill }: { skill: Skill }) {
  switch (skill.status) {
    case 'DRAFT':
      return <Badge color="gray">Draft</Badge>;
    case 'IN_REVIEW':
      return <Badge color="yellow">In Review</Badge>;
    case 'PUBLISHED':
      return <Badge color="green">Published</Badge>;
    case 'ARCHIVED':
      return <Badge color="red">Archived</Badge>;
  }
}
```

---

## API Endpoints

### 1. Save Directly (Reviews Disabled)

```typescript
// src/app/api/skills/[id]/route.ts (PUT)

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const { title, content } = await request.json();

  // Check if reviews are enabled
  const reviewMode = await getReviewMode();
  const reviewRequired = await getReviewRequired(id);

  if (reviewMode === 'none' || !reviewRequired) {
    // Direct save - commit to git immediately
    const skill = await prisma.skill.update({
      where: { id },
      data: {
        title,
        content,
        status: 'PUBLISHED',
        updatedAt: new Date(),
      },
    });

    // Commit to git
    await saveSkillAndCommit(skill, `Update skill: ${title}`, auth.session.user);

    return apiSuccess({ skill });
  } else {
    // Save as draft (handled by separate endpoint)
    return errors.badRequest("Use /save-draft endpoint when reviews are enabled");
  }
}
```

### 2. Save as Draft

```typescript
// src/app/api/skills/[id]/save-draft/route.ts

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const { title, content } = await request.json();

  const skill = await prisma.skill.update({
    where: { id },
    data: {
      draftContent: content,
      status: 'DRAFT',
      updatedAt: new Date(),
    },
  });

  // NOTE: Do NOT commit to git yet - only drafts

  return apiSuccess({ skill, message: "Saved as draft" });
}
```

### 3. Submit for Review

```typescript
// src/app/api/skills/[id]/submit-review/route.ts

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const { reviewers } = await request.json(); // Optional: specific reviewers

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) return errors.notFound("Skill");

  // Get category reviewers if not specified
  const category = await prisma.skillCategory.findFirst({
    where: { name: { in: skill.categories } },
  });

  const assignedReviewers = reviewers || category?.approverEmails || [];

  // Update skill status
  const updatedSkill = await prisma.skill.update({
    where: { id },
    data: {
      status: 'IN_REVIEW',
      reviewRequestedAt: new Date(),
      reviewRequestedBy: auth.session.user.email,
      pendingReviewers: assignedReviewers.map((email: string) => ({
        email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      })),
    },
  });

  // Send notifications
  await Promise.all([
    sendReviewRequestEmail(assignedReviewers, skill),
    postToSlack('#skill-reviews', {
      text: `🔍 ${auth.session.user.name} requested review for "${skill.title}"`,
      url: `/knowledge/${id}/review`,
    }),
  ]);

  return apiSuccess({
    skill: updatedSkill,
    message: `Review requested from ${assignedReviewers.length} reviewer(s)`
  });
}
```

### 4. Approve Review

```typescript
// src/app/api/skills/[id]/approve/route.ts

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const { comment } = await request.json();

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) return errors.notFound("Skill");
  if (skill.status !== 'IN_REVIEW') {
    return errors.badRequest("Skill is not in review");
  }

  // Update reviewer status
  const reviewers = (skill.pendingReviewers as any[]) || [];
  const updatedReviewers = reviewers.map(r =>
    r.email === auth.session.user.email
      ? { ...r, status: 'approved', approvedAt: new Date().toISOString() }
      : r
  );

  // Check if minimum approvals met
  const minApprovers = skill.minApprovers || 1;
  const approvalCount = updatedReviewers.filter(r => r.status === 'approved').length;
  const isFullyApproved = approvalCount >= minApprovers;

  // Add review comment
  const comments = (skill.reviewComments as any[]) || [];
  comments.push({
    userId: auth.session.user.id,
    userName: auth.session.user.name,
    comment,
    action: 'approved',
    createdAt: new Date().toISOString(),
  });

  if (isFullyApproved) {
    // Publish skill - merge draft content into main content
    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: {
        content: skill.draftContent || skill.content,
        draftContent: null,
        status: 'PUBLISHED',
        pendingReviewers: null,
        reviewComments: comments,
        updatedAt: new Date(),
      },
    });

    // NOW commit to git (after approval)
    await saveSkillAndCommit(
      updatedSkill,
      `Update skill: ${skill.title} (approved by ${auth.session.user.name})`,
      auth.session.user
    );

    // Notify requester
    await sendEmail({
      to: skill.reviewRequestedBy,
      subject: `Skill approved: ${skill.title}`,
      body: `Your skill "${skill.title}" has been approved and published.`,
    });

    return apiSuccess({
      skill: updatedSkill,
      message: "Skill approved and published"
    });
  } else {
    // Partial approval - wait for more approvers
    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: {
        pendingReviewers: updatedReviewers,
        reviewComments: comments,
      },
    });

    return apiSuccess({
      skill: updatedSkill,
      message: `Approved (${approvalCount}/${minApprovers})`
    });
  }
}
```

### 5. Publish Self-Review

```typescript
// src/app/api/skills/[id]/publish/route.ts

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) return errors.notFound("Skill");
  if (skill.status !== 'DRAFT') {
    return errors.badRequest("Skill is not a draft");
  }

  // Publish draft
  const updatedSkill = await prisma.skill.update({
    where: { id },
    data: {
      content: skill.draftContent || skill.content,
      draftContent: null,
      status: 'PUBLISHED',
      updatedAt: new Date(),
    },
  });

  // Commit to git
  await saveSkillAndCommit(
    updatedSkill,
    `Update skill: ${skill.title}`,
    auth.session.user
  );

  return apiSuccess({ skill: updatedSkill, message: "Skill published" });
}
```

---

## Configuration Helpers

```typescript
// src/lib/reviewConfig.ts

export type ReviewMode = 'none' | 'self' | 'team';

export async function getReviewMode(): Promise<ReviewMode> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: 'review_mode' },
  });

  return (setting?.value as ReviewMode) || 'none';
}

export async function getReviewRequired(skillId: string): Promise<boolean> {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!skill) return false;

  // Skill-level override
  if (skill.requiresReview !== null) {
    return skill.requiresReview;
  }

  // Category-level default
  const category = await prisma.skillCategory.findFirst({
    where: { name: { in: skill.categories } },
  });

  return category?.requiresReview || false;
}

export async function setReviewMode(mode: ReviewMode) {
  await prisma.appSetting.upsert({
    where: { key: 'review_mode' },
    update: { value: mode },
    create: { key: 'review_mode', value: mode },
  });
}
```

---

## Migration Path

### Phase 1: Add Schema (Week 1)
```bash
# Create migration
npx prisma migrate dev --name add_review_system

# Schema changes:
# - Add SkillStatus enum
# - Add status, draftContent, requiresReview fields to Skill
# - Add requiresReview, approverEmails to SkillCategory
# - Add review_mode to AppSetting
```

### Phase 2: Implement UI Toggle (Week 1)
- Admin settings page: Global toggle
- Category settings: Per-category toggles
- Default: Reviews OFF

### Phase 3: Add Save Logic (Week 2)
- Update skill save endpoints to check review mode
- Implement save-as-draft endpoint
- Keep direct save working (reviews disabled)

### Phase 4: Build Review UI (Week 2-3)
- Review dashboard
- Diff viewer
- Comment system
- Approve/reject buttons

### Phase 5: Notifications (Week 3)
- Email notifications
- Slack integration
- Dashboard indicators

---

## User Experience Examples

### Example 1: Building Knowledge Base (Current State)

**Review Mode**: `none` (default)

```
You: Edit skill
You: Click "Save"
System: ✅ Saved and committed to git
You: Continue working
```

**Fast and frictionless** ✅

### Example 2: Self-Review (Quality Check)

**Review Mode**: `self`

```
You: Edit skill
You: Click "Save as Draft"
System: ✅ Draft saved (not committed)
You: Preview changes
You: Click "Publish"
System: ✅ Published and committed to git
```

**Catch mistakes before publishing** ✅

### Example 3: Team Review (Future)

**Review Mode**: `team`
**Category**: Security (requires review)

```
You: Edit security skill
You: Click "Submit for Review"
System: ✅ Sent to Jane Smith for review
Jane: Gets email notification
Jane: Reviews in /knowledge/reviews
Jane: Adds comment: "Update SOC 2 date"
You: Get notification
You: Update draft
You: Click "Re-submit"
Jane: Reviews again
Jane: Clicks "Approve"
System: ✅ Published and committed to git
```

**Formal approval process** ✅

---

## Admin Controls

### Settings Page Layout

```
Admin > Settings > Reviews

┌─────────────────────────────────────────┐
│ Review Mode                             │
│                                         │
│ ○ Disabled                              │
│   Fast iteration - no approvals needed  │
│   (Recommended while building)          │
│                                         │
│ ○ Self-Review                           │
│   Preview changes before publishing     │
│   (Good for quality control)            │
│                                         │
│ ○ Team Review                           │
│   Require approval from reviewers       │
│   (For mature knowledge base)           │
│                                         │
│ [Save Settings]                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Category Review Settings                │
│                                         │
│ Security                                │
│   ☑ Require reviews                     │
│   Min approvers: [1 ▾]                  │
│   Reviewers: jane@mc.com, bob@mc.com    │
│                                         │
│ Customer Data                           │
│   ☐ Require reviews                     │
│                                         │
│ General                                 │
│   ☐ Require reviews                     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Create database migration
- [ ] Add review settings to admin UI
- [ ] Add global toggle (default: OFF)
- [ ] Test direct save still works

### Week 2: Draft System
- [ ] Add "Save as Draft" button
- [ ] Implement draft storage
- [ ] Add "Publish" button
- [ ] Show draft badge in UI

### Week 3: Team Review
- [ ] Add "Submit for Review" flow
- [ ] Build review dashboard
- [ ] Implement approve/reject
- [ ] Add email notifications

### Week 4: Polish
- [ ] Add comment system
- [ ] Build diff viewer
- [ ] Slack integration
- [ ] Testing and docs

---

## Benefits of Toggle Approach

### While Building (Reviews OFF)
- ✅ **Fast**: No approval delays
- ✅ **Simple**: Just click "Save"
- ✅ **Git history**: Still tracked
- ✅ **Flexible**: Change anytime

### When Mature (Reviews ON)
- ✅ **Quality control**: Second review
- ✅ **Compliance**: Audit trail
- ✅ **Team collaboration**: Multiple stakeholders
- ✅ **Gradual**: Enable per-category

### Always
- ✅ **Git-backed**: Version history
- ✅ **UI-based**: No GitHub required
- ✅ **Configurable**: Global or granular
- ✅ **Reversible**: Toggle back anytime

---

## Recommendation

**Start implementation now**:

1. **Week 1**: Add schema + toggle (reviews OFF by default)
2. **Week 2-4**: Continue building knowledge base with reviews OFF
3. **Month 2+**: When ready, enable self-review or team review

**This gives you**:
- Immediate git benefits (history, rollback)
- Fast iteration while building
- Review capability when needed
- No workflow disruption

---

Generated: 2025-12-19
Author: Claude Code
Status: Implementation Plan - Ready to Build
