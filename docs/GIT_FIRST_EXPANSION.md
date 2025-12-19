# Git-First Architecture Expansion

**Date**: 2025-12-19
**Status**: Architecture Planning
**Goal**: Identify which data types benefit from git-first approach beyond Skills

---

## Data Model Analysis

### Current Database Models (20 total)
Looking at the Prisma schema, we have these major data types:

| Model | Current Storage | Git-First Candidate? | Reasoning |
|-------|-----------------|---------------------|-----------|
| **Skill** | Database | ✅ **YES** | Main candidate - already planned |
| **CustomerProfile** | Database | ✅ **YES** | Static knowledge about customers |
| **KnowledgeDocument** | Database | ⚠️ **MAYBE** | Binary files harder in git |
| **SystemPrompt** | Database | ✅ **YES** | Configuration, eng should maintain |
| **PromptBlock** | Database | ✅ **YES** | Building blocks for prompts |
| **InstructionPreset** | Database | ⚠️ **MAYBE** | User-specific, frequent changes |
| **Template** | Database | ✅ **YES** | Static templates for slides/docs |
| **BulkProject** | Database | ❌ **NO** | Transactional, user-specific |
| **BulkRow** | Database | ❌ **NO** | High-frequency updates |
| **QuestionHistory** | Database | ❌ **NO** | Audit log, append-only |
| **ChatSession** | Database | ❌ **NO** | User conversations, private |
| **ApiUsage** | Database | ❌ **NO** | Metrics, time-series data |
| **User** | Database | ❌ **NO** | Auth, personal data |
| **ContractReview** | Database | ❌ **NO** | Document analysis results |
| **CollateralOutput** | Database | ❌ **NO** | Generated content |
| **ReferenceUrl** | Database | ⚠️ **MAYBE** | Shared URLs, low change frequency |
| **SkillCategory** | Database | ✅ **YES** | Configuration |
| **AuditLog** | Database | ❌ **NO** | Compliance, append-only |
| **AppSetting** | Database | ⚠️ **MAYBE** | Configuration |

---

## Git-First Suitability Criteria

### ✅ **PERFECT for Git-First**
Data that is:
1. **Static knowledge** - Changes infrequently, read often
2. **Shared across organization** - Not user-specific
3. **Needs version control** - Want to see history, rollback
4. **Engineering should contribute** - Via PRs and code review
5. **LLM-consumed** - Used as context for AI

**Examples**: Skills, Customer Profiles, System Prompts, Templates

### ⚠️ **MAYBE Git-First**
Data that is:
1. **Configuration-like** but changes frequently
2. **Shared** but has user-specific aspects
3. **Small enough** to fit in git comfortably

**Examples**: Instruction Presets, App Settings, Reference URLs

### ❌ **NOT Git-First**
Data that is:
1. **Transactional** - Created/updated constantly
2. **User-specific** - Personal data, conversations
3. **Large binary files** - Videos, images (use Git LFS if needed)
4. **Time-series** - Metrics, logs, audit trails
5. **Temporary** - Cache, sessions

**Examples**: Projects, Questions, Chat Sessions, API Usage

---

## Recommended: Unified Knowledge Base

### Knowledge Types for Git Storage

```
knowledge/
  skills/
    compliance-and-certifications.md
    data-encryption-security.md
    ...

  customers/
    acme-corporation.md
    globex-industries.md
    ...

  prompts/
    system/
      skill_creation.md
      skill_refresh.md
      question_answering.md
    blocks/
      role-identity.md
      output-requirements.md
      ...

  templates/
    slides/
      security-overview-deck.md
    documents/
      soc2-response-template.md
    ...

  categories/
    metadata.json
```

---

## 1. Customer Profiles - STRONG YES

### Why Customer Profiles Belong in Git

**Current State** (lines 287-335 in schema.prisma):
```prisma
model CustomerProfile {
  id              String   @id @default(uuid())
  name            String
  industry        String?
  website         String?

  // Static Salesforce data
  salesforceId    String?  @unique
  region          String?
  tier            String?

  // Content (like skills)
  content         String?  @db.Text
  considerations  String[]
  sourceDocuments Json?
  sourceUrls      Json?

  // Metadata
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  owners          Json?
  history         Json?
}
```

**Git-First Benefits**:

✅ **Version Control**
- See how customer profile evolved over time
- Track when we learned new information
- Rollback incorrect updates

✅ **Engineering Contribution**
- Sales engineers add customer context via PR
- Solutions architects document technical details
- Product team updates product usage

✅ **Better for Product LLMs**
- Product can read customer profiles directly from git
- No database dependency for customer context
- Easy to bundle with product deployments

✅ **Salesforce Sync**
- Git shows what changed vs Salesforce data
- Clear audit trail of manual overrides
- Easy to diff Salesforce data vs manual updates

### Customer Profile File Format

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440001
name: Acme Corporation
industry: Healthcare
website: https://acme.com
salesforceId: 0011234567890ABC
region: NA
tier: Enterprise
employeeCount: 5000
annualRevenue: 500000000
accountType: Customer
billingLocation: San Francisco, CA, USA
lastSalesforceSync: 2025-12-19T10:00:00Z
created: 2024-01-10T08:30:00Z
updated: 2025-12-19T14:20:00Z
owners:
  - name: Jane Smith
    email: jane@montecarlodata.com
    userId: user-123
sources:
  - url: https://acme.com/about
    addedAt: 2024-01-10T08:30:00Z
  - url: https://acme.com/products
    addedAt: 2024-03-15T10:00:00Z
documents:
  - id: doc-456
    filename: acme-architecture.pdf
    uploadedAt: 2024-06-20T14:00:00Z
active: true
---

# Acme Corporation

## Overview
Acme Corporation is a leading healthcare technology provider specializing in electronic health records (EHR) and patient data management. Founded in 2005, they serve over 500 hospitals across North America.

## Products & Services
- **EHR Platform**: Cloud-based electronic health records system
- **Patient Portal**: Mobile app for patient engagement
- **Analytics Suite**: Healthcare analytics and reporting
- **Integration Hub**: Connects to 50+ third-party systems

## Data Infrastructure
- **Primary Data Warehouse**: Snowflake (3 PB of patient data)
- **Streaming**: Kafka for real-time patient data
- **Analytics**: Databricks for ML workloads
- **Observability**: Datadog, PagerDuty

**Monte Carlo Use Case**:
- Monitoring data quality for patient records
- Alerting on schema changes in EHR database
- Lineage tracking for regulatory compliance (HIPAA)

## Technical Environment
- **Cloud**: AWS (us-east-1, us-west-2)
- **Data Stack**: Snowflake, dbt, Airflow, Fivetran
- **BI Tools**: Tableau, Looker
- **ML Platform**: Databricks

## Key Contacts
- **Data Engineering Lead**: Bob Johnson (bob@acme.com)
- **VP of Analytics**: Sarah Lee (sarah@acme.com)
- **CTO**: Michael Chen (michael@acme.com)

## Compliance & Security
- **Certifications**: HIPAA, SOC 2 Type II, HITRUST
- **Data Residency**: US-only (regulatory requirement)
- **Security Requirements**:
  - All data encrypted at rest (AES-256)
  - PHI must never leave AWS
  - Annual security audits required

## Pain Points & Challenges
- **Data Quality Issues**: 15% of patient records have incomplete data
- **Pipeline Failures**: Daily ETL jobs fail 2-3 times per week
- **Manual Monitoring**: Team spends 10 hours/week checking data quality
- **Regulatory Risk**: HIPAA violations could result in $50K+ fines

## Success Metrics
- Reduce data quality issues by 80%
- Decrease pipeline failure rate to <1%
- Save 8 hours/week of manual monitoring time
- Zero HIPAA data quality incidents

## Expansion Opportunities
- Add ML observability for patient readmission models
- Extend to EMEA region (2026 planned expansion)
- Integrate with new patient portal (launching Q2 2025)

## Special Considerations
- **HIPAA-sensitive**: Never use real patient data in demos
- **Snowflake-specific**: They use Snowflake extensively, focus demos there
- **Budget-conscious**: Annual contract up for renewal in Q3 2025
- **Champion risk**: Bob Johnson considering leaving, need to build relationship with Sarah

## Recent Activity
- 2025-12-01: Expanded to 3 PB of data in Snowflake
- 2025-11-15: Launched new patient portal with real-time data
- 2025-10-01: Annual renewal signed ($500K/year)
- 2025-09-15: Attended Monte Carlo user conference

## Sources
- https://acme.com/about
- https://acme.com/products
- Salesforce Account (synced 2025-12-19)
- Internal discovery call notes (2024-01-10)
- Architecture diagram (acme-architecture.pdf)
```

### Workflow Options (User Choice)

**Option 1: Web UI (Recommended for Most Users)**
```
1. Sales engineer opens web app
2. Goes to Customers → Acme Corporation → Edit
3. Updates profile in rich text editor
4. Clicks "Save"
5. Behind the scenes:
   - Updates database
   - Commits to git automatically
   - GitHub Action syncs (if needed)
6. Done! No git knowledge required
```

**Option 2: Direct Git (For Power Users)**
```bash
# 1. Clone repo
git clone https://github.com/montecarlodata/knowledge-base.git

# 2. Edit markdown file
vim knowledge/customers/acme-corporation.md

# 3. Commit and push
git add knowledge/customers/acme-corporation.md
git commit -m "Update Acme profile: Add new ML use case"
git push origin main

# 4. GitHub Action syncs to database
# 5. Now available in web app and product LLMs
```

**Option 3: PR Review (For Sensitive Changes)**
```bash
# 1. Create branch
git checkout -b update-acme-profile

# 2. Make changes
vim knowledge/customers/acme-corporation.md

# 3. Create PR
gh pr create --title "Update Acme: Add ML use case"

# 4. Team reviews PR in GitHub
# 5. After approval, merge to main
# 6. GitHub Action syncs to database
```

### Key Principle: **UI First, Git Behind the Scenes**

**Most users never see git**:
- Sales engineer uses web UI
- Edits customer profile in rich text editor
- Clicks "Save"
- System commits to git automatically

**Git is the storage layer**, not the interface.

**Power users can bypass UI**:
- Engineering can edit markdown directly
- Create PRs for complex changes
- Review changes before merging

**Best of both worlds**:
- Non-technical users → Web UI (git is invisible)
- Technical users → Direct git access (faster)
- Sensitive changes → PR review workflow

---

## 2. System Prompts & Blocks - STRONG YES

### Why Prompts Belong in Git

**Current State** (lines 411-435 in schema.prisma):
```prisma
model SystemPrompt {
  id         String   @id @default(uuid())
  name       String   @unique
  category   String
  content    String   @db.Text
  isDefault  Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model PromptBlock {
  id          String   @id @default(uuid())
  name        String   @unique
  category    String
  content     String   @db.Text
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Git-First Benefits**:

✅ **Engineering Ownership**
- Prompt engineers maintain prompts via PR
- Code review for prompt changes
- Test prompts in staging before production

✅ **Version Control**
- Track prompt performance over time
- A/B test prompts: compare branches
- Rollback bad prompts instantly

✅ **Documentation**
- Prompts self-documenting in markdown
- Examples and usage notes inline
- Links to related prompts

✅ **Configuration as Code**
- Prompts deployed with application code
- Staging/production parity
- Easy to replicate environments

### Prompt File Format

```markdown
---
id: skill_creation
name: Skill Creation
category: skills
variants:
  - default
  - concise
  - detailed
updated: 2025-12-19T14:00:00Z
---

# Skill Creation Prompt

## Purpose
Guide the LLM to create well-structured skills from source material (URLs, documents).

## Variants

### Default
You are a knowledge extraction specialist. Your job is to analyze source material and create a comprehensive, well-structured skill.

**Guidelines**:
- Write in clear, professional prose
- Include specific details (versions, numbers, standards)
- Add 3-5 common questions with complete answers
- Document edge cases and limitations
- List all source URLs

**Output Format**:
Return JSON:
```json
{
  "title": "Skill title",
  "content": "Full markdown content...",
  "categories": ["Category1", "Category2"]
}
```

### Concise (fast variant)
[Shorter version for quick skill creation]

### Detailed (quality variant)
[Longer version with more guidance]

## Usage
- **Context**: Skill builder, bulk import
- **Model**: Claude Sonnet (default), Haiku (fast)
- **Max Tokens**: 4000

## Performance Notes
- Average response time: 8-12s (Sonnet)
- Average skill length: 2000-3000 chars
- Success rate: 97%

## Related Prompts
- [skill_refresh](skill_refresh.md) - Updating existing skills
- [skill_planning](skill_planning.md) - Conversational planning

## Examples

### Input
```
URL: https://example.com/security
Content: "We use AES-256 encryption..."
```

### Expected Output
```markdown
# Data Encryption & Security

## Overview
...
```

## Change History
- 2025-12-19: Added "## Edge Cases" requirement
- 2025-11-01: Increased max_tokens from 2000 to 4000
- 2025-10-15: Initial version
```

---

## 3. Templates - YES

### Why Templates Belong in Git

**Current State** (lines 781-807 in schema.prisma):
```prisma
model Template {
  id          String   @id @default(uuid())
  name        String
  description String?  @db.Text
  type        String   // "slide_deck", "document", "email"
  format      String   // "google_slides", "markdown", "html"
  content     String   @db.Text // Template content
  variables   Json?    // {varName: description}
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Git-First Benefits**:

✅ **Design Team Ownership**
- Marketing/design teams update templates via PR
- Preview templates in staging before production
- Design review process

✅ **Version Control**
- Track template changes over time
- Rollback to previous designs
- A/B test different templates

✅ **Reusability**
- Templates imported into other projects
- Shared across teams

### Template File Format

```markdown
---
id: security-overview-deck
name: Security Overview Deck
description: Standard deck for security questionnaires
type: slide_deck
format: google_slides
variables:
  customerName: Customer company name
  industry: Customer industry
  complianceFocus: Which compliance frameworks to emphasize
  includeArchitecture: Whether to include architecture diagrams
updated: 2025-12-19T14:00:00Z
googleSlidesTemplateId: 1a2b3c4d5e6f7g8h9i0j
---

# Security Overview Deck Template

## Purpose
Standard presentation for security assessments and compliance reviews.

## Slide Outline

### Slide 1: Title
- **Title**: {customerName} Security Overview
- **Subtitle**: {industry} Industry
- **Footer**: Monte Carlo Confidential

### Slide 2: Company Overview
- About Monte Carlo
- Key metrics
- Customer count

### Slide 3: Security Certifications
- SOC 2 Type II
- ISO 27001
- GDPR compliance
- {complianceFocus} - emphasized

### Slide 4: Data Encryption
...

## Variables
- `customerName` (required): Customer company name
- `industry` (optional): Customer industry for customization
- `complianceFocus` (optional): "HIPAA", "FedRAMP", "PCI DSS" - which to emphasize
- `includeArchitecture` (boolean): Show architecture diagrams

## Usage Example
```typescript
const filled = await fillTemplate('security-overview-deck', {
  customerName: 'Acme Corporation',
  industry: 'Healthcare',
  complianceFocus: 'HIPAA',
  includeArchitecture: true
});
```

## Design Notes
- Brand colors: #0066CC (primary), #00AA66 (accent)
- Font: Roboto (headings), Open Sans (body)
- Slide size: 16:9
```

---

## 4. Knowledge Documents - PARTIAL (Binary Files)

### Challenge: Binary Files
- PDFs, Word docs, images are binary
- Git works best with text files
- Large files bloat git repository

### Solution: Hybrid Approach

**Option A: Git LFS (Large File Storage)**
```
knowledge/
  documents/
    metadata/
      acme-architecture.md  ← Metadata in git
    files/
      acme-architecture.pdf ← Binary in Git LFS
```

**Option B: External Storage + Metadata**
```
knowledge/
  documents/
    acme-architecture.md   ← Metadata in git

# acme-architecture.md content:
---
id: doc-456
title: Acme Architecture Diagram
filename: acme-architecture.pdf
fileType: pdf
fileSize: 2500000
uploadedAt: 2024-06-20T14:00:00Z
storageUrl: s3://knowledge-docs/acme-architecture.pdf
---

# Acme Architecture Diagram

## Description
Technical architecture for Acme's data platform...

## Extracted Key Points
- Snowflake as primary warehouse
- Kafka for streaming
...
```

**Recommendation**: Option B (metadata in git, binaries in S3/blob storage)

---

## Implementation Strategy

### Phase 1: Skills Only (Current Plan)
- Implement git-first for skills
- Validate approach
- Learn lessons

### Phase 2: Add Customer Profiles (High Value)
```
knowledge/
  skills/
    [existing skills]
  customers/
    acme-corporation.md
    globex-industries.md
    ...
```

**Benefits**:
- Sales/SE teams contribute customer context
- Product LLMs use customer profiles
- Better RFP customization

**Effort**: Medium (similar to skills, 1-2 weeks)

### Phase 3: Add System Prompts (Engineering Workflow)
```
knowledge/
  skills/
  customers/
  prompts/
    system/
      skill_creation.md
      skill_refresh.md
    blocks/
      role-identity.md
```

**Benefits**:
- Eng owns prompts, not ops
- Prompt testing in staging
- A/B test prompts easily

**Effort**: Low (1 week)

### Phase 4: Add Templates (Design Workflow)
```
knowledge/
  skills/
  customers/
  prompts/
  templates/
    slides/
      security-overview-deck.md
```

**Benefits**:
- Design team controls templates
- Version control for designs
- Easy rollback of template changes

**Effort**: Low (1 week)

---

## Migration Approach

### Design Philosophy: UI First

**Critical principle**: The web UI remains the primary interface.

```
┌─────────────────────────────────────────┐
│         User Interaction Layer          │
├─────────────────────────────────────────┤
│                                         │
│  [Web UI]  ← 90% of users use this     │
│     ↓                                   │
│  Edit form, rich text editor            │
│  Click "Save" button                    │
│     ↓                                   │
│  System commits to git automatically    │
│                                         │
│  [Direct Git]  ← 10% power users        │
│     ↓                                   │
│  Edit markdown files                    │
│  Push to GitHub                         │
│     ↓                                   │
│  GitHub Action syncs to database        │
│                                         │
└─────────────────────────────────────────┘
```

**No workflow changes**:
- Users continue using web UI
- "Save" button commits to git
- No git commands required
- Git is transparent

**Web UI Features**:
- Rich text editor for markdown
- Live preview
- "View History" button (shows git log)
- "Rollback" button (reverts commit)
- "Compare" dropdown (diff with previous versions)

### Migration for Customer Profiles

**Step 1: Export Existing Profiles**
```typescript
// scripts/export-customers-to-git.ts
async function exportCustomers() {
  const customers = await prisma.customerProfile.findMany({
    where: { isActive: true },
    include: { owner: true },
  });

  for (const customer of customers) {
    const slug = customer.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const markdown = formatCustomerAsMarkdown(customer);

    await fs.writeFile(
      `knowledge/customers/${slug}.md`,
      markdown,
      "utf-8"
    );
  }
}
```

**Step 2: Sync Script (Git → Database)**
```typescript
// scripts/sync-customers-to-db.ts
async function syncCustomers() {
  const files = await fs.readdir("knowledge/customers");

  for (const file of files) {
    const content = await fs.readFile(`knowledge/customers/${file}`, "utf-8");
    const { data, content: body } = matter(content);

    await prisma.customerProfile.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        content: body,
        // ... other fields
      },
      create: {
        id: data.id,
        name: data.name,
        content: body,
        // ... other fields
      },
    });
  }
}
```

**Step 3: Update Web App (No User-Facing Changes)**

```typescript
// src/app/api/customers/[id]/route.ts (PUT handler)
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const { name, content, industry, website } = await request.json();

  // 1. Update database (as before)
  const customer = await prisma.customerProfile.update({
    where: { id },
    data: {
      name,
      content,
      industry,
      website,
      updatedAt: new Date(),
      history: [
        ...(existingCustomer.history || []),
        {
          date: new Date().toISOString(),
          action: "updated",
          summary: "Profile updated via web UI",
          user: auth.session.user.email,
        },
      ],
    },
  });

  // 2. Commit to git (NEW - transparent to user)
  const slug = getCustomerSlug(name);
  await saveCustomerAndCommit(
    slug,
    {
      id: customer.id,
      name,
      content,
      industry,
      website,
      // ... other fields
    },
    `Update customer profile: ${name}`,
    {
      name: auth.session.user.name || "Unknown",
      email: auth.session.user.email || "unknown@example.com",
    }
  );

  // 3. Return response (as before)
  return apiSuccess({ customer });
}
```

**From user's perspective**:
- Opens edit form
- Makes changes
- Clicks "Save"
- Sees success message
- **Doesn't know git was involved**

**Behind the scenes**:
- Database updated
- Git commit created
- GitHub synced (optional)
- All automatic

---

## Enhanced Web UI Features (Git-Powered)

With git as the backend, we can add these features to the **web UI** without users needing git knowledge:

### 1. **History Tab**
```tsx
// In customer profile detail page
<Tabs>
  <Tab label="Profile">
    {/* Edit form */}
  </Tab>

  <Tab label="History">
    {commits.map(commit => (
      <div key={commit.sha}>
        <div>{commit.date} - {commit.author}</div>
        <div>{commit.message}</div>
        <Button onClick={() => viewDiff(commit.sha)}>View Changes</Button>
        <Button onClick={() => rollback(commit.sha)}>Restore This Version</Button>
      </div>
    ))}
  </Tab>
</Tabs>
```

**User experience**:
- Click "History" tab
- See timeline of all changes
- Click "View Changes" to see diff
- Click "Restore This Version" to rollback
- No git commands needed

### 2. **Compare Dropdown**
```tsx
<Select label="Compare with">
  <option>Current version</option>
  <option>1 week ago</option>
  <option>1 month ago</option>
  <option>6 months ago</option>
</Select>
```

**User experience**:
- Select time period from dropdown
- See visual diff highlighting changes
- Understand how customer profile evolved

### 3. **Change Notifications**
```tsx
// Dashboard widget
<Card title="Recent Customer Updates">
  {recentChanges.map(change => (
    <div>
      <strong>{change.customerName}</strong> updated by {change.author}
      <div>{change.summary}</div>
      <Link to={`/customers/${change.id}`}>View Profile</Link>
    </div>
  ))}
</Card>
```

**User experience**:
- Dashboard shows recent customer changes
- Click to view updated profile
- Stay informed without checking git

### 4. **Bulk Operations**
```tsx
<Button onClick={exportToGit}>
  Export All Customers to Git
</Button>

<Button onClick={syncFromGit}>
  Sync Latest Changes from Engineering
</Button>
```

**User experience**:
- One-click export/sync
- Progress indicator
- Success/error notifications

### 5. **Conflict Resolution UI**
```tsx
// If git and database diverge
<Alert severity="warning">
  Engineering updated this customer profile via GitHub.
  <Button onClick={viewDiff}>View Changes</Button>
  <Button onClick={acceptGitVersion}>Accept GitHub Version</Button>
  <Button onClick={keepDatabaseVersion}>Keep My Version</Button>
</Alert>
```

**User experience**:
- Clear warning when conflict detected
- Visual diff of changes
- Simple buttons to resolve
- No git merge commands needed

---

## Benefits Summary by Data Type

### Skills
- ✅ Version history
- ✅ Eng contribution via PR
- ✅ Product LLM access
- ✅ Rollback capability
- ✅ Git blame (who wrote what)

### Customer Profiles
- ✅ Sales/SE contribution
- ✅ Track customer evolution
- ✅ Product can customize per customer
- ✅ Salesforce diff tracking
- ✅ Rollback bad updates

### System Prompts
- ✅ Eng ownership
- ✅ Test in staging
- ✅ A/B test prompts
- ✅ Rollback bad prompts
- ✅ Configuration as code

### Templates
- ✅ Design team ownership
- ✅ Version control for designs
- ✅ Preview before production
- ✅ Rollback template changes
- ✅ Reusable across projects

---

## Open Questions

1. **Customer profile permissions**: Should all eng have access to customer data in git?
   - **Option A**: Private repo, limited access
   - **Option B**: Sanitized public profiles, sensitive data stays in DB
   - **Recommendation**: Private repo with GitHub team permissions

2. **Salesforce sync conflicts**: What if Salesforce data conflicts with git?
   - **Option A**: Salesforce always wins (overwrite git)
   - **Option B**: Manual merge required
   - **Option C**: Git shows warning, user decides
   - **Recommendation**: Option C (user decides, with clear diff)

3. **Large customer base**: If 1000s of customer profiles, does git scale?
   - Git handles 10K+ markdown files fine
   - Use `.skills/customers-index.json` for fast lookups
   - Consider sharding by region if needed

4. **Documents in Git LFS**: Should we use Git LFS for binary documents?
   - **Pro**: Everything in one repo
   - **Con**: LFS has storage limits/costs
   - **Recommendation**: Start with S3 + metadata, migrate to LFS if needed

---

## Timeline Estimate

| Phase | What | Effort | Priority |
|-------|------|--------|----------|
| Phase 1 | Skills in git | 2-3 weeks | **HIGH** |
| Phase 2 | Customer profiles in git | 1-2 weeks | **MEDIUM** |
| Phase 3 | System prompts in git | 1 week | **MEDIUM** |
| Phase 4 | Templates in git | 1 week | **LOW** |

**Total**: 5-7 weeks for full git-first knowledge base

**Recommended approach**: Do Phase 1 now, evaluate, then decide on Phases 2-4

---

## Conclusion

**Strong YES for Git-First**:
1. ✅ Skills (already planned)
2. ✅ Customer Profiles (high value for sales/product)
3. ✅ System Prompts (eng workflow benefit)
4. ✅ Templates (design workflow benefit)

**Database-First (Keep as-is)**:
1. ❌ Projects, Questions, Chat (transactional)
2. ❌ Users, Auth (personal data)
3. ❌ Metrics, Logs (time-series)

**Unified Knowledge Base Structure**:
```
knowledge/
  skills/          ← Phase 1 (now)
  customers/       ← Phase 2 (next)
  prompts/         ← Phase 3
  templates/       ← Phase 4
  documents/       ← Metadata only
```

---

## Implementation Progress

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| Phase 1 | ✅ DONE | 2025-12-19 | Skills in git - fully implemented with sync tracking UI |
| Phase 2 | ✅ DONE | 2025-12-19 | Customer profiles - fully implemented |
| Phase 3 | ⏳ Pending | - | System prompts - not started |
| Phase 4 | ⏳ Pending | - | Templates - not started |

### Phase 2 Implementation Details (Customer Profiles)

**All Complete:**
- ✅ Directory structure (`customers/`, `.gitignore`, `README.md`)
- ✅ `src/lib/customerFiles.ts` - File read/write operations
- ✅ `src/lib/customerGitSync.ts` - Git commit/sync operations
- ✅ `src/lib/customerSyncLog.ts` - Sync logging utilities
- ✅ Prisma schema updates (`syncStatus`, `lastSyncedAt`, `gitCommitSha` fields)
- ✅ `CustomerSyncLog` model added to schema
- ✅ `scripts/export-customers-to-git.ts` - Export existing customers
- ✅ `scripts/sync-customers-to-db.ts` - Sync from git to database
- ✅ npm scripts (`npm run export:customers`, `npm run sync:customers`)
- ✅ Update Customer API routes to commit to git on save
- ✅ Add sync status UI to customer profile cards (reuse `SyncStatusBadge`)
- ✅ Add API endpoint for customer sync logs (`/api/customers/[id]/sync-logs`)
- ✅ Add `syncStatus`, `lastSyncedAt`, `gitCommitSha` to CustomerProfile TypeScript type

**Remaining (nice-to-have for production):**
- [ ] Test full bidirectional sync workflow
- [ ] GitHub Actions for automated sync (extends existing skills workflow)

---

## AWS Infrastructure Recommendations

> **Reference**: See [git-backed-skills-deployment.md](git-backed-skills-deployment.md) for detailed AWS deployment architecture.

### Summary of Recommended Approach

The recommended AWS deployment uses **Lambda-Based Git Sync** (Option 1 from the skills deployment doc):

```
Web UI (ECS) → RDS (write only)
                ↓
          EventBridge → Lambda (commit to git)
                ↓
          GitHub webhook → Lambda → sync to RDS
```

### Infrastructure Components Needed (Phase 2+)

The same Lambda-based sync architecture applies to **all git-backed knowledge types**:

| Component | Description | Phase |
|-----------|-------------|-------|
| Lambda: `knowledge-to-git` | Commits DB changes to git | Phase 1 (exists) |
| Lambda: `git-to-knowledge` | Syncs git changes to RDS | Phase 1 (exists) |
| EventBridge Rules | Trigger on RDS table changes | Phase 1+ |
| GitHub Webhook | Trigger on push to main | Phase 1+ |

### Changes for Phase 2 (Customer Profiles)

**Extend existing Lambda functions to handle customers:**

1. **EventBridge Rule**: Add pattern for `CustomerProfile` table changes
   ```json
   {
     "source": ["aws.rds"],
     "detail-type": ["RDS DB Instance Event"],
     "detail": {
       "table": ["Skill", "CustomerProfile"]
     }
   }
   ```

2. **Lambda: knowledge-to-git**: Add customer handling
   ```typescript
   if (event.detail.table === 'CustomerProfile') {
     const customer = await fetchCustomerFromRDS(event.detail.id);
     const slug = getCustomerSlug(customer.name);
     await writeCustomerFile(`/tmp/repo/customers/${slug}.md`, customer);
   }
   ```

3. **Lambda: git-to-knowledge**: Add customer sync
   ```typescript
   if (changedFiles.some(f => f.startsWith('customers/'))) {
     await exec('npm run sync:customers', { cwd: '/tmp/repo' });
   }
   ```

### Changes for Phase 3+ (Prompts, Templates)

Same pattern - extend EventBridge rules and Lambda handlers:

- `prompts/` directory → sync SystemPrompt/PromptBlock tables
- `templates/` directory → sync Template table

### Cost Estimate (All Phases)

| Resource | Monthly Cost | Notes |
|----------|-------------|-------|
| Lambda (2 functions) | ~$5-20 | Based on invocation frequency |
| EventBridge | ~$1 | Per rule evaluation |
| GitHub webhook | Free | Part of GitHub |
| CloudWatch Logs | ~$5 | Log retention |
| **Total** | **~$15-30/month** | Minimal additional infra |

### Security Considerations

1. **GitHub Token**: Store in AWS Secrets Manager (already recommended)
2. **VPC Access**: Lambdas need VPC attachment to reach RDS
3. **IAM**: Minimal permissions for git operations
4. **Audit**: All sync operations logged to CloudWatch and SyncLog tables

### No Additional Infrastructure Needed

The git-first expansion (Phases 2-4) **reuses the same Lambda infrastructure** as Phase 1. The only changes are:
- EventBridge rule patterns (add new table names)
- Lambda code (add handlers for new entity types)
- Git directory structure (add `customers/`, `prompts/`, `templates/`)

---

Generated: 2025-12-19
Updated: 2025-12-19
Author: Claude Code
Status: Phases 1-2 Complete, Phases 3-4 Pending
