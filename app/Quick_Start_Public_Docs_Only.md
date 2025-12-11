# Quick Start: Building a Skill with Only Public Documentation

## Reality Check
Most people start here - you only have access to:
- Company website security page
- Public documentation
- Trust center / compliance page
- Maybe blog posts or whitepapers

**You don't have:** SOC 2, internal policies, or detailed process docs

**That's okay!** You can still build a useful skill and complete questionnaires.

---

## The "Public-Only" Workflow

### Step 1: Gather Everything Public (30 minutes)

**Find these pages:**
```
☐ Main security page (usually /security or /trust)
☐ Documentation site (usually docs.company.com)
☐ Trust center / compliance portal
☐ Privacy policy
☐ Terms of service
☐ About page (often mentions certifications)
☐ Security-related blog posts
☐ Case studies mentioning security
```

**Document what you find:**
```markdown
## Available Resources

Security Page: https://company.com/security
- Mentions: SSO, encryption, compliance certifications
- Doesn't mention: Specific frequencies, SLAs, tools

Docs Site: https://docs.company.com
- Mentions: Architecture overview, integration security
- Doesn't mention: Patch management, vulnerability scanning details

Trust Center: https://trust.company.com
- Mentions: SOC 2, ISO 27001, annual pentest
- Doesn't mention: Can download reports? No.
```

---

### Step 2: Extract Facts (1 hour)

**Go page by page, extract ONLY what's explicitly stated:**

**Example - Good Extraction:**
```markdown
## Facts from Public Sources

### From Security Page
✅ "Data encrypted at rest using AES-256" - SPECIFIC
✅ "Data in transit encrypted with TLS 1.2+" - SPECIFIC
✅ "SOC 2 Type 2 certified annually" - SPECIFIC
⚠️ "Regular vulnerability scanning" - VAGUE (no frequency)
⚠️ "Multi-factor authentication available" - UNCLEAR (required or optional?)
❌ Access review frequency - NOT MENTIONED

### From Docs Site - Architecture Page
✅ "Hosted on AWS" - SPECIFIC
✅ "Serverless Lambda functions" - SPECIFIC
✅ "VPC network segmentation" - SPECIFIC
❌ Specific monitoring tools - NOT MENTIONED
❌ Backup frequency - NOT MENTIONED
```

**Critical:** Mark each fact with:
- ✅ = Have specific detail
- ⚠️ = Mentioned but vague
- ❌ = Not mentioned at all

---

### Step 3: Create Tiered Templates (2 hours)

**For each common question type, create 3-tier response:**

**Template Example:**

```markdown
### Vulnerability Management

**Question patterns:**
- "How often do you scan for vulnerabilities?"
- "What is your vulnerability management process?"

**TIER 1 - HIGH CONFIDENCE (you have specifics):**
Use this if public docs say "Daily scans" or "Weekly scans"
"Daily automated vulnerability scans performed on all external endpoints."
Sources: [URL]
Confidence: High

**TIER 2 - MEDIUM CONFIDENCE (vague mention):**
Use this if public docs say "Regular scans" or "Continuous monitoring"
"Vulnerability scanning performed regularly in accordance with industry standards. Specific frequencies available in SOC 2 report."
Sources: [URL]
Confidence: Medium

**TIER 3 - LOW CONFIDENCE (not mentioned):**
Use this if public docs don't mention scanning at all
"Risk-based vulnerability management program aligned with NIST framework. Detailed procedures available upon request."
Sources: [Industry standard practice]
Confidence: Low
```

**Create tiers for these common topics:**
1. Vulnerability scanning/remediation
2. Access reviews
3. Training frequency
4. Backup frequency
5. Incident response timelines
6. MFA enforcement (required vs optional)
7. Account deprovisioning timeline
8. Log retention periods
9. Penetration testing frequency
10. Change management process

---

### Step 4: Document Gaps (30 minutes)

**Create a prioritized list:**

```markdown
## Known Gaps (Need Internal Docs)

### CRITICAL GAPS (asked in 80%+ of questionnaires):
1. Vulnerability remediation SLAs
   - Public: "Regular scanning" mentioned
   - Need: Critical: 7d, High: 30d, Med/Low: 60d
   - Workaround: "Prioritized by severity per industry standards"

2. Access review frequency
   - Public: Not mentioned
   - Need: "Quarterly" or "Annual"
   - Workaround: "Regular reviews per compliance requirements"

3. Security training frequency
   - Public: "Training provided" mentioned
   - Need: "Within 30 days + annually"
   - Workaround: "Upon hire and periodic refresher training"

4. Account deprovisioning timeline
   - Public: Not mentioned
   - Need: "Within 24 hours"
   - Workaround: "Promptly upon termination"

### MEDIUM GAPS (asked in 40-60% of questionnaires):
[List next priority...]

### LOW GAPS (asked in <20% of questionnaires):
[List nice-to-haves...]
```

---

### Step 5: Build Request for Internal Docs (30 minutes)

**Create business case for getting SOC 2:**

```markdown
## Request for Internal Documentation Access

**To:** Compliance/InfoSec Team
**From:** [You]
**Re:** Access to SOC 2 Report for Vendor Questionnaire Completion

**Background:**
We complete security questionnaires for [X] vendors per [month/quarter/year]. 
Current completion time: ~30-45 minutes per questionnaire.
With SOC 2 access: Estimated 5-10 minutes per questionnaire.

**Specific Gaps We're Encountering:**

Public documentation provides good coverage of:
✅ Encryption standards (AES-256, TLS 1.2+)
✅ Compliance certifications (SOC 2, ISO 27001)
✅ Architecture overview (AWS, serverless)

But questionnaires frequently ask for details not in public docs:
❌ Vulnerability remediation SLAs (Critical, High, Med/Low timelines)
❌ Access review frequency (Quarterly? Annual?)
❌ Training frequency (Upon hire? Annual refresher?)
❌ Account deprovisioning timeline (24 hours? 48 hours?)
❌ Backup frequency and retention
❌ Log retention periods
❌ Specific tools (IdP provider, SIEM, monitoring)

**Impact:**
Without access to SOC 2, we must respond with vague language like:
- "Regular vulnerability scanning" (instead of "Daily scans")
- "Per industry standards" (instead of "Critical: 7 days, High: 30 days")
- "Promptly upon termination" (instead of "Within 24 hours")

This leads to vendor follow-up questions and delays.

**Request:**
Read-only access to most recent SOC 2 Type 2 report for questionnaire completion.

**Expected Benefit:**
- 70% reduction in completion time
- 95%+ of questions answerable with high confidence
- Fewer vendor follow-up questions
- More professional responses with specific details

**Security:**
Report would be used only for questionnaire completion, not shared externally.
```

---

### Step 6: Complete First Questionnaire (With Gaps)

**Use your tiered approach:**

```markdown
WORKFLOW FOR QUESTIONNAIRE:

For each question:
1. Check skill for matching template
2. Determine which tier applies:
   - Have specifics? → Use Tier 1 (High confidence)
   - Have vague mention? → Use Tier 2 (Medium confidence)
   - Not mentioned? → Use Tier 3 (Low confidence)
3. Document which tier used
4. Track which questions needed Tier 2/3 (gaps)

After questionnaire:
- Count Tier 1 responses: ____ (High confidence)
- Count Tier 2 responses: ____ (Medium confidence - workarounds)
- Count Tier 3 responses: ____ (Low confidence - gaps)

Target with public docs only: 50-60% Tier 1, 30-40% Tier 2, 10-20% Tier 3
```

---

## Workaround Language Library

**When you don't have specifics, use these:**

### For Frequency Questions (When Not Documented):
```
"Regular [scanning/reviews/training] performed in accordance with industry standards."
"Continuous [monitoring/assessment] aligned with best practices."
"Periodic [activity] per compliance framework requirements."
"[Activity] performed at intervals consistent with risk-based approach."
```

### For Timeline Questions (When Not Documented):
```
"Prioritized by severity with timelines aligned to industry standards."
"Critical issues addressed immediately; complete SLAs available upon request."
"Risk-based remediation approach following NIST/CIS guidelines."
"Timelines vary by severity level per documented procedures."
```

### For Tool/Vendor Questions (When Not Documented):
```
"Enterprise-grade [category] solutions implemented."
"Industry-standard tools for [purpose] deployed."
"Best-in-class [technology] leveraged for [function]."
"Commercial-off-the-shelf solutions meeting security requirements."
```

### For Process Questions (When Not Documented):
```
"Formal [process] documented and reviewed annually."
"Structured approach to [activity] aligned with frameworks."
"Defined procedures for [process] per compliance requirements."
"Process documentation available in SOC 2 report."
```

**Key phrases to include:**
- "per industry standards"
- "in accordance with best practices"  
- "aligned with [NIST/CIS/ISO] framework"
- "detailed procedures available upon request"
- "documented in SOC 2 report"

---

## Expected Coverage Levels

### With Public Docs Only (Typical):
```
High Confidence (Tier 1): 50-60%
- Encryption standards: ✅
- Compliance certs: ✅
- Architecture basics: ✅
- Some tools/technologies: ✅

Medium Confidence (Tier 2): 30-40%
- Frequencies (vague): ⚠️
- Processes (mentioned, not detailed): ⚠️
- Some SLAs (if mentioned publicly): ⚠️

Low Confidence (Tier 3): 10-20%
- Specific SLAs: ❌
- Internal processes: ❌
- Frequencies not mentioned: ❌
- Specific tools not disclosed: ❌
```

### After Adding SOC 2 Report:
```
High Confidence (Tier 1): 90-95%
- Everything from public docs: ✅
- Plus all SOC 2 control details: ✅
- Plus specific frequencies/SLAs: ✅
- Plus process documentation: ✅

Medium Confidence (Tier 2): 5-10%
- Edge cases: ⚠️
- Vendor-specific nuances: ⚠️

Low Confidence (Tier 3): 0-5%
- Rare/unique questions only: ❌
```

---

## Sample "Public-Only" Skill Template

```markdown
# Security Questionnaire Skill - [Company Name]

**Version:** 0.1 (PUBLIC SOURCES ONLY)
**Coverage:** ~50% High Confidence
**Status:** Awaiting internal documentation access

**Available Sources:**
- Security Page: [URL]
- Docs Site: [URL]
- Trust Center: [URL]

**Missing Sources:**
- SOC 2 Report: Requested [date], pending access
- Internal Policies: Not available
- Detailed Process Docs: Not available

---

## Quick Reference (Public Sources Only)

### What We HAVE:
✅ Encryption standards (AES-256, TLS 1.2+)
✅ Compliance certs (SOC 2, ISO 27001)
✅ Cloud provider (AWS)
✅ Architecture type (Serverless)
✅ SSO support (SAML 2.0)

### What We'RE MISSING:
❌ Vulnerability remediation SLAs
❌ Access review frequency
❌ Training frequency
❌ Backup frequency
❌ Log retention period
❌ Specific IdP provider

---

## Response Templates (With Tiers)

[30-40 templates with 3-tier responses]

---

## Workaround Language

[Library of responses for gaps]

---

## Gap Priority List

[Ranked list of most-needed internal info]
```

---

## Timeline to Maturity

**Week 1:** Public docs only (50% coverage)
- Build initial skill
- Complete first questionnaire
- Document gaps

**Week 2-3:** Waiting for SOC 2
- Use skill for additional questionnaires
- Refine workarounds
- Build case for internal access

**Week 4:** SOC 2 received (90% coverage)
- Update all Tier 2/3 templates
- Convert workarounds to specifics
- Dramatic improvement in completion time

**Week 5+:** Mature skill (95% coverage)
- Add templates from new questionnaires
- Maintenance mode
- 3-5 minute completion time

---

## Key Takeaway

**Don't wait for perfect information to start!**

- 50% coverage with public docs is better than 0%
- Workaround language is professional and acceptable
- Track gaps to justify getting internal docs
- Build incrementally as documents become available

**Start with what you have. Improve as you go.**
