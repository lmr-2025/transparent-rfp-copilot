# Approval & Review Workflows: UI vs GitHub

**Date**: 2025-12-19
**Status**: Architecture Decision
**Question**: Should we mirror GitHub's approval workflows or keep UI-based approvals?

---

## Current Approval Workflow (UI-Based)

### How It Works Today

**Skill Builder (Bulk Import)**:
```
1. User adds URLs/documents
2. LLM analyzes and creates skill drafts
3. ReviewDraftsStep shows all drafts
4. User reviews each draft:
   - Preview content
   - Edit if needed
   - "Clarify" button to ask LLM questions
   - "Approve" or "Reject"
5. Click "Save All Approved"
6. Skills saved to database
```

**Skill Refresh**:
```
1. User clicks "Refresh" on skill
2. System fetches URLs and generates draft
3. Shows side-by-side diff
4. User approves or rejects
5. If approved, updates database
```

**Key Features**:
- ✅ Inline editing during review
- ✅ Clarify/question functionality
- ✅ Visual diff preview
- ✅ Batch approval
- ✅ No GitHub account needed

---

## GitHub PR Workflow

### How GitHub PRs Work

```
1. Developer creates branch
2. Makes changes
3. Opens PR
4. Reviewers comment on specific lines
5. Request changes or approve
6. CI/CD runs tests
7. After approval(s), merge to main
```

**Key Features**:
- ✅ Line-by-line comments
- ✅ Multiple reviewers
- ✅ Required approvals (1+, 2+, etc.)
- ✅ Blocking reviews
- ✅ CI/CD integration
- ✅ Thread discussions
- ❌ Requires GitHub account
- ❌ More complex workflow

---

## Option 1: Keep UI Approval, Add Git Backend

**Approach**: Current UI workflow + automatic git commits

### User Experience (No Change)

**Web UI Flow**:
```
1. User edits skill in web UI
2. Previews changes
3. Clicks "Save"
4. Behind scenes:
   - Updates database
   - Commits to git automatically
   - Done ✅
```

**For direct git edits by eng**:
```
1. Engineer edits markdown file
2. Commits to git
3. Pushes to main (or creates PR)
4. GitHub Action syncs to database
5. Shows up in web UI
```

### Pros
- ✅ **Zero workflow changes** for current users
- ✅ **No GitHub dependency** for approvals
- ✅ **Faster** - no PR overhead for simple edits
- ✅ **Inline editing** during review
- ✅ **Clarify button** for LLM questions
- ✅ **Works offline** (commit later)

### Cons
- ❌ **No blocking reviews** - anyone can save directly
- ❌ **No required approvals** - no second pair of eyes
- ❌ **No line comments** - can't comment on specific sections
- ❌ **No review history** - can't see who reviewed what

### Best For
- Small teams
- High trust environment
- Fast iteration needed
- Non-technical users

---

## Option 2: GitHub PR Required (Full Git Workflow)

**Approach**: All changes go through GitHub PRs

### User Experience (Major Change)

**Web UI Flow**:
```
1. User edits skill in web UI
2. Previews changes
3. Clicks "Submit for Review"
4. Behind scenes:
   - Creates git branch
   - Commits changes
   - Opens GitHub PR
5. Reviewer gets GitHub notification
6. Reviews PR in GitHub
7. Approves or requests changes
8. User sees PR status in web UI
9. After approval, merges automatically
10. Database syncs
```

### Pros
- ✅ **Formal review process** - required approvals
- ✅ **Audit trail** in GitHub
- ✅ **Line comments** - precise feedback
- ✅ **Multiple reviewers** possible
- ✅ **CI/CD integration** - automated tests
- ✅ **Blocking reviews** - prevent bad changes

### Cons
- ❌ **Slower** - wait for PR approval
- ❌ **GitHub account required** for all users
- ❌ **Complex** for non-technical users
- ❌ **Can't edit during review** in web UI
- ❌ **Overhead** for simple typo fixes
- ❌ **Notification noise** - lots of PRs

### Best For
- Large teams
- Compliance requirements
- Multiple stakeholders
- Technical users

---

## Option 3: Hybrid (Recommended)

**Approach**: UI approval for most, GitHub PRs for sensitive/major changes

### User Experience (Flexible)

**Most Changes (90%)** - UI Approval:
```
1. User edits skill
2. Clicks "Save"
3. Commits directly to git
4. Optional: Notify team in Slack
```

**Sensitive Changes (10%)** - GitHub PR:
```
1. User edits skill
2. Clicks "Submit for Review" (optional)
3. Creates GitHub PR
4. Team reviews in GitHub
5. After approval, merges
```

### Configuration

**Admin Settings**:
```typescript
// Per skill or per category
{
  requiresReview: boolean,
  minApprovers: 1 | 2,
  approvers: ["jane@mc.com", "bob@mc.com"], // Optional whitelist
  autoCommit: boolean, // True = direct commit, False = create PR
}
```

**Example Rules**:
- **Customer profiles** → Requires review by sales ops
- **Security skills** → Requires review by security team
- **All other skills** → Auto-commit, no review

### UI Indicators

```tsx
// In skill edit form
{skill.requiresReview && (
  <Alert severity="info">
    Changes to this skill require review by: {skill.approvers.join(", ")}
    <Button onClick={submitForReview}>Submit for Review</Button>
  </Alert>
)}

{!skill.requiresReview && (
  <Button onClick={save}>Save</Button>
)}
```

### Pros
- ✅ **Flexible** - right tool for each use case
- ✅ **Fast for simple changes** - direct commit
- ✅ **Rigorous for sensitive** - PR review
- ✅ **Gradual adoption** - start with auto-commit, add reviews later
- ✅ **Works for non-technical** - UI is primary
- ✅ **Works for technical** - GitHub PRs available

### Cons
- ⚠️ **More complex** to implement
- ⚠️ **Configuration overhead** - set up rules
- ⚠️ **Two workflows** to maintain

---

## Recommendation: Start with Option 1, Enable Option 3 Later

### Phase 1: UI Approval + Auto Git (Now)

**Immediate implementation**:
```typescript
// Every skill save commits to git automatically
await saveSkillAndCommit(skill, message, author);
```

**Benefits**:
- Zero workflow changes
- Get git benefits immediately (history, rollback, blame)
- No GitHub dependency

**Limitations**:
- No formal review process
- Anyone can commit directly

### Phase 2: Add Optional PR Workflow (Later)

**When needed** (3-6 months):
```typescript
// Add setting to skill/category
requiresReview: boolean

// If true, create PR instead of direct commit
if (skill.requiresReview) {
  await createPRForSkill(skill);
} else {
  await saveSkillAndCommit(skill);
}
```

**Triggers for Phase 2**:
- Team grows beyond 10 people
- Compliance requirements emerge
- Quality issues from direct commits
- Request from stakeholders

---

## UI-Based Review Features (No GitHub Required)

### Option: Build GitHub-Style Review in Web UI

Instead of GitHub PRs, build review functionality directly in the web app.

**Features to Add**:

#### 1. **Draft/Published States**
```typescript
model Skill {
  status: "draft" | "in_review" | "published"
  reviewers: Json? // [{userId, status: "pending"|"approved"|"rejected"}]
  reviewComments: Json? // [{lineNumber, comment, author}]
}
```

#### 2. **Request Review Button**
```tsx
<Button onClick={requestReview}>
  Request Review from:
  <UserSelect options={skillReviewers} />
</Button>
```

#### 3. **Review UI**
```tsx
// /knowledge/[id]/review

<div>
  <h2>Skill Pending Review</h2>

  <DiffViewer
    original={skill.previousVersion}
    updated={skill.content}
  />

  <CommentSection
    comments={skill.reviewComments}
    onAddComment={(lineNumber, text) => addComment(lineNumber, text)}
  />

  <ReviewActions>
    <Button onClick={approve}>Approve</Button>
    <Button onClick={requestChanges}>Request Changes</Button>
    <Button onClick={reject}>Reject</Button>
  </ReviewActions>
</div>
```

#### 4. **Review History Tab**
```tsx
<Tab label="Review History">
  {skill.reviewHistory.map(review => (
    <div>
      <div>{review.date} - {review.reviewer}</div>
      <div>Status: {review.status}</div>
      <div>Comments: {review.comments}</div>
    </div>
  ))}
</Tab>
```

#### 5. **Email Notifications**
```typescript
// When review requested
sendEmail({
  to: reviewers,
  subject: `Review requested: ${skill.title}`,
  body: `${author} requested your review. View: ${url}`,
});
```

#### 6. **Slack Integration**
```typescript
// Post to #skill-reviews channel
slackWebhook({
  text: `🔍 ${author} requested review for "${skill.title}"`,
  actions: [
    { text: "Review Now", url: reviewUrl },
    { text: "Approve", action: "approve" },
  ],
});
```

### Pros of UI-Based Review
- ✅ **No GitHub required** - stays in web app
- ✅ **Familiar UI** - matches existing workflow
- ✅ **Inline editing** - fix issues during review
- ✅ **Email/Slack** - no GitHub notifications needed
- ✅ **Works offline** - review locally

### Cons of UI-Based Review
- ❌ **No git PR benefits** - lose GitHub ecosystem
- ❌ **Custom code** - have to build/maintain
- ❌ **No CI/CD** - can't run automated tests
- ❌ **Locked to web app** - can't review in IDE

---

## Comparison Matrix

| Feature | Option 1: UI Only | Option 2: GitHub PR | Option 3: Hybrid | UI-Based Review |
|---------|-------------------|---------------------|------------------|-----------------|
| **Fast for simple edits** | ✅ Instant | ❌ Wait for PR | ✅ Configurable | ⚠️ If auto-approve |
| **Formal review process** | ❌ No | ✅ Yes | ✅ When needed | ✅ Yes |
| **Non-technical friendly** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **GitHub account required** | ❌ No | ✅ Yes | ⚠️ For some | ❌ No |
| **Line-level comments** | ❌ No | ✅ Yes | ✅ In PRs | ✅ Yes |
| **CI/CD integration** | ❌ No | ✅ Yes | ✅ In PRs | ❌ No |
| **Inline editing** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Works offline** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Implementation effort** | Low | Medium | High | Very High |
| **Maintenance burden** | Low | Low | Medium | High |

---

## Recommendation for Monte Carlo

### Immediate (Phase 1): Option 1 - UI Approval + Auto Git

**Why**:
- Fast to implement (1-2 weeks)
- Zero workflow changes
- Get git benefits immediately
- Proven UI workflow

**Implementation**:
```typescript
// Add to every skill save
await saveSkillAndCommit(skill, message, author);
```

### Short-Term (3-6 months): Evaluate Need for Reviews

**Metrics to track**:
- How many "bad" commits happen?
- Do users want formal review?
- Team size growing?
- Compliance requirements?

**If yes to any** → Proceed to Phase 2

### Mid-Term (Phase 2): Option 3 - Add Hybrid PR Workflow

**Why**:
- Configurable per skill/category
- GitHub PRs for sensitive changes only
- Maintains fast workflow for most edits

**Implementation**:
```typescript
// Add configuration
model Skill {
  requiresReview: boolean
  minApprovers: number
  approvers: string[]
}

// Branch logic
if (skill.requiresReview) {
  await createPRForSkill(skill);
} else {
  await saveSkillAndCommit(skill);
}
```

### Long-Term (1+ year): Consider UI-Based Review

**Only if**:
- GitHub PRs too complex for users
- Want to keep everything in-app
- Have engineering capacity to build

**Alternative**: Keep GitHub PRs but improve integration
- Embed GitHub PR UI in web app (iframe)
- Show PR status inline
- One-click approve from web UI

---

## Decision Points

### Question 1: How large is the team?
- **<5 people** → Option 1 (UI only)
- **5-20 people** → Option 3 (Hybrid)
- **20+ people** → Option 2 (GitHub PRs) or UI-Based Review

### Question 2: What's the error rate?
- **Low (<1% bad commits)** → Option 1
- **Medium (1-5%)** → Option 3
- **High (>5%)** → Option 2 or UI-Based Review

### Question 3: Are users technical?
- **Mostly non-technical** → Option 1 or UI-Based Review
- **Mixed** → Option 3
- **Mostly technical** → Option 2

### Question 4: Compliance requirements?
- **No formal requirements** → Option 1
- **Some requirements** → Option 3
- **Strict requirements** → Option 2 or UI-Based Review

### Question 5: Budget for custom development?
- **Low** → Option 1
- **Medium** → Option 2 or 3
- **High** → UI-Based Review (custom solution)

---

## Recommended Path Forward

### Week 1-2: Implement Option 1
- Add git commits on every skill save
- Test with existing workflows
- No UI changes

### Month 2-3: Collect Data
- Track commit frequency
- Monitor quality issues
- User feedback surveys

### Month 4-6: Decision Point
- **If working well** → Stay with Option 1
- **If issues arise** → Implement Option 3 (Hybrid)
- **If major problems** → Consider UI-Based Review

### Year 1+: Mature the System
- Refine review rules based on usage
- Add automation (auto-approve safe changes)
- Consider GitHub PR integration if team grows

---

## Implementation Examples

### Option 1 (Current Recommendation)

```typescript
// src/app/api/skills/[id]/route.ts
export async function PUT(request: NextRequest) {
  // ... auth and validation

  // 1. Update database
  const skill = await prisma.skill.update({...});

  // 2. Commit to git (NEW)
  await saveSkillAndCommit(
    slug,
    skill,
    `Update skill: ${skill.title}`,
    { name: user.name, email: user.email }
  );

  return apiSuccess({ skill });
}
```

### Option 3 (Future Enhancement)

```typescript
// src/app/api/skills/[id]/route.ts
export async function PUT(request: NextRequest) {
  // ... auth and validation

  // Check if review required
  const category = await prisma.skillCategory.findFirst({
    where: { name: { in: skill.categories } }
  });

  if (category?.requiresReview) {
    // Create PR instead of direct commit
    const pr = await createGitHubPR({
      branch: `update-skill-${skill.id}`,
      title: `Update skill: ${skill.title}`,
      body: generatePRDescription(skill, changes),
      reviewers: category.approvers,
    });

    // Update skill status
    await prisma.skill.update({
      where: { id: skill.id },
      data: {
        status: "in_review",
        pendingPRUrl: pr.url,
      },
    });

    return apiSuccess({
      skill,
      requiresReview: true,
      prUrl: pr.url,
    });
  } else {
    // Direct commit (Option 1 behavior)
    await saveSkillAndCommit(slug, skill, message, author);
    return apiSuccess({ skill });
  }
}
```

### UI-Based Review (Future Custom Solution)

```typescript
// src/app/api/skills/[id]/request-review/route.ts
export async function POST(request: NextRequest) {
  const { id, reviewers } = await request.json();

  // Update skill status
  const skill = await prisma.skill.update({
    where: { id },
    data: {
      status: "in_review",
      reviewers: reviewers.map(r => ({
        userId: r.id,
        email: r.email,
        status: "pending",
        requestedAt: new Date(),
      })),
    },
  });

  // Send notifications
  await Promise.all([
    sendReviewRequestEmail(reviewers, skill),
    postToSlack(`#skill-reviews`, {
      text: `🔍 Review requested: ${skill.title}`,
      url: `/knowledge/${id}/review`,
    }),
  ]);

  return apiSuccess({ skill });
}
```

---

## Conclusion

**Recommendation**: Start with **Option 1** (UI Approval + Auto Git)

**Rationale**:
1. **Fast to implement** - 1-2 weeks
2. **Zero disruption** - users don't notice
3. **Get git benefits** - history, rollback, blame
4. **Proven workflow** - current UI already works
5. **Future-proof** - can add reviews later if needed

**When to reconsider**:
- Team grows beyond 10 people
- Quality issues emerge
- Compliance requirements
- User feedback requests reviews

**Then evaluate**: Option 3 (Hybrid) or UI-Based Review

---

Generated: 2025-12-19
Author: Claude Code
Status: Architecture Recommendation - Ready for Decision
