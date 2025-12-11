# How to Build a Security Questionnaire Skill - Step-by-Step Guide

## What You're Building

A SKILL.md file that contains:
1. **Quick reference facts** - instant lookup for common info
2. **Proven response templates** - copy-paste ready answers
3. **Source mappings** - know where to find what
4. **Edge cases** - nuances and gotchas

**Goal:** Enable 80-90% of questions to be answered instantly without doc fetching.

---

## Quick Start Guide by Scenario

### Scenario A: You Have SOC 2 + Public Docs
✅ You're in great shape!
→ Skip to **Phase 1** below

### Scenario B: You Only Have Public Website Links (MOST COMMON)
⚠️ Start here - you'll build incrementally
→ Start with **Phase 0** below, then progress to Phase 1

**Coverage expectations:**
- Phase 0 (Public only): 50-60% High confidence coverage
- After adding SOC 2: 90-95% High confidence coverage

---

## The Skill Building Process (Exactly As Done)

### Starting Point: What Resources Do You Have?

**Scenario A: Full Resources (SOC 2 + Public Docs)**
- Public documentation URLs
- SOC 2 report (or ISO/compliance docs)
- → Follow Phase 1 below

**Scenario B: Only Public Documentation (Most Common Starting Point)**
- Only have external website/documentation links
- No SOC 2 or internal compliance docs yet
- → Follow "Phase 0: Bootstrap with Public Docs Only" first, then Phase 1

---

### Phase 0: Bootstrap with Public Docs Only (If Starting from Scratch)

**You have:** Only public website URLs (e.g., security page, docs site, trust center)

**Goal:** Build initial skill with publicly available information, create framework for future additions.

#### Step 1: Inventory Available Public Resources

Identify all public-facing security documentation:

```markdown
## Available Public Resources

**Company security documentation:**
- Main security page: [URL]
- Documentation site: [URL]
- Trust center/compliance portal: [URL]
- Status page: [URL]
- Blog posts about security: [URLs]
- Privacy policy: [URL]
- Terms of service: [URL]

**Industry-standard certifications mentioned:**
- SOC 2: [Mentioned? Available?]
- ISO 27001: [Mentioned? Available?]
- GDPR compliance: [Mentioned? Available?]
- Other: [List any mentioned standards]

**Third-party validation:**
- G2/Gartner security reviews: [Available?]
- Customer case studies mentioning security: [URLs]
- Security whitepaper: [URL if available]
```

#### Step 2: Extract All Available Facts

Read through each public resource and extract every factual security claim:

**Method:** Go page by page, extracting structured facts.

**Example extraction from public docs:**

```markdown
## Quick Reference Facts (Public Sources Only)

### Identity & Access Management
**From: Security Overview Page**
- SSO support: "Mentioned - SAML 2.0"
- MFA: "Mentioned as available"
- Access model: "Role-based access control mentioned"
- Source: https://company.com/security
- **Coverage: Basic** (lacks specifics like frequencies, SLAs)

### Data Protection
**From: Security Overview Page + Privacy Policy**
- Encryption at rest: "AES-256 mentioned"
- Encryption in transit: "TLS 1.2+ mentioned"
- Data retention: "Per customer agreement" (vague)
- Source: https://company.com/security, https://company.com/privacy
- **Coverage: Basic** (lacks key management details, rotation policies)

### Infrastructure Security
**From: Documentation Site - Architecture Page**
- Cloud provider: "AWS mentioned"
- Architecture: "Serverless/Lambda mentioned"
- Network: "VPC, segmentation mentioned"
- Source: https://docs.company.com/architecture
- **Coverage: Medium** (decent technical details)

### Compliance
**From: Trust Center / Compliance Page**
- SOC 2: "Annual SOC 2 Type 2 audit mentioned"
- ISO: "ISO 27001 certified"
- Penetration testing: "Annual third-party testing mentioned"
- Source: https://trust.company.com
- **Coverage: Basic** (mentions standards but no details on scope, findings)
```

#### Step 3: Create "Public-Only" Response Templates

**Critical distinction:** Mark templates based on source availability.

**Template format for public-only sources:**

```markdown
### IAM: SSO Implementation (Public Source)

**Question patterns:**
- "Do you support SSO?"
- "What SSO providers do you support?"

**Response:**
"Yes. SSO via SAML 2.0 supported."

**Sources:** https://company.com/security
**Confidence:** Medium
**Coverage:** Basic - lacks specifics on providers, implementation details
**Notes:** May need follow-up for: specific IdP integrations, MFA enforcement, session management details

---

### Data Protection: Encryption Standards (Public Source)

**Question patterns:**
- "What encryption standards do you use?"
- "Is data encrypted at rest and in transit?"

**Response:**
"Yes. Data at rest encrypted using AES-256. Data in transit encrypted using TLS 1.2 or higher."

**Sources:** https://company.com/security
**Confidence:** High
**Coverage:** Complete - encryption standards clearly stated
**Notes:** May need follow-up for: key management procedures, rotation policies, certificate lifecycle

---

### Vulnerability Management (Public Source - Incomplete)

**Question patterns:**
- "How often do you perform vulnerability scans?"
- "What is your remediation timeline?"

**Response:**
"Vulnerability scanning performed regularly. [NEEDS VERIFICATION: Specific frequency, SLAs not documented publicly]"

**Sources:** https://company.com/security (mentions scanning, no specifics)
**Confidence:** Low
**Coverage:** Incomplete - lacks frequencies and SLAs
**Notes:** CRITICAL GAP - need internal docs for: scan frequency, remediation SLAs, tool details
**Workaround:** Can state "Regular vulnerability scanning performed per industry standards. Specific SLAs available upon request."
```

#### Step 4: Identify and Document Gaps

**Critical:** Track what's missing vs what's needed.

```markdown
## Known Gaps (Public Docs Only)

### HIGH PRIORITY (commonly asked, not publicly documented):
1. **Specific frequencies:**
   - Vulnerability scan frequency: "Regular" mentioned, need "Daily/Weekly"
   - Access review frequency: Not mentioned, commonly asked
   - Backup frequency: Not mentioned
   - Training frequency: Not mentioned

2. **SLAs and timeframes:**
   - Vulnerability remediation SLAs: Not documented
   - Incident response times: Not documented
   - Account deprovisioning timeline: Not documented
   - Support response times: Not documented

3. **Specific technical details:**
   - Exact IdP providers (Okta? Azure AD?): Not specified
   - Monitoring/SIEM tools: Not specified
   - Backup retention periods: Not specified
   - Log retention periods: Not specified

4. **Process details:**
   - Change management approval process: Not documented
   - Incident response procedures: High-level only
   - Access review process: Not documented
   - Background check procedures: Not documented

### MEDIUM PRIORITY (less common but may be asked):
[List gaps that are asked less frequently]

### LOW PRIORITY (rarely asked):
[List nice-to-have details]

### WORKAROUNDS (for common gaps):
1. **Frequency questions without specifics:**
   - "Performed per industry best practices"
   - "Regular/periodic [activity] performed in accordance with security standards"
   - "Specific frequencies available upon request"

2. **SLA questions without specifics:**
   - "Prioritized by severity in accordance with industry standards"
   - "Critical issues addressed immediately; specific SLAs available upon request"
   - "Remediation timelines align with NIST/CIS recommendations"

3. **Tool/vendor questions:**
   - Focus on capabilities, not specific tools
   - "Enterprise-grade [category] solutions implemented"
   - "Industry-standard tools for [purpose]"
```

#### Step 5: Create "Graduated Confidence" Templates

**Strategy:** Provide tiered responses based on confidence level.

```markdown
### Response Template with Confidence Tiers

**Question:** "How often do you perform access reviews?"

**Tier 1 - High Confidence (have specifics):**
"Quarterly access reviews performed across all production systems."

**Tier 2 - Medium Confidence (have general statement):**
"Regular access reviews performed in accordance with security standards. Specific frequency available upon request."

**Tier 3 - Low Confidence (nothing documented):**
"Access reviews performed per compliance requirements. Detailed process documentation available upon request."

---

**Question:** "What are your vulnerability remediation SLAs?"

**Tier 1 - High Confidence (have specifics):**
"Critical vulnerabilities remediated within 7 days. High severity within 30 days. Medium/low within 60 days."

**Tier 2 - Medium Confidence (have general statement):**
"Vulnerabilities prioritized by severity and remediated in accordance with industry timelines. Specific SLAs available in SOC 2 report."

**Tier 3 - Low Confidence (nothing documented):**
"Risk-based approach to vulnerability remediation aligned with NIST standards. Detailed SLAs available upon request."
```

#### Step 6: Build "Request List" for Future Enhancement

Track what to request from company for skill improvement:

```markdown
## Enhancement Requests (To Improve Skill Coverage)

### Critical Documents Needed:
1. **SOC 2 Type 2 Report** (or equivalent compliance report)
   - Would provide: Specific frequencies, SLAs, process details, control evidence
   - Impact: Would convert 40-50% of Medium/Low confidence to High confidence

2. **Internal Security Policies** (if shareable)
   - Access Control Policy
   - Vulnerability Management Policy
   - Incident Response Plan
   - Change Management Policy
   - Impact: Would fill most process detail gaps

3. **Most Recent Penetration Test Summary** (sanitized)
   - Would provide: Testing frequency, scope, remediation practices
   - Impact: Would strengthen vulnerability management responses

### Questions to Ask Internal Teams:
1. InfoSec team:
   - Vulnerability scan frequency?
   - Vulnerability remediation SLAs?
   - Log retention period?
   - SIEM tool in use?

2. IT team:
   - IdP provider (Okta? Azure AD? Other)?
   - Access review frequency?
   - MFA enforcement details?
   - Account deprovisioning timeline?

3. Compliance team:
   - When does SOC 2 report get updated?
   - Can we access it for questionnaire completion?
   - Training frequency and tracking?
   - Background check procedures?

### Temporary Mitigation:
- Use "industry standard" language for gaps
- Offer to provide detailed documentation upon request
- Reference available compliance certifications (SOC 2, ISO)
- Focus on capabilities documented rather than specific tools/frequencies
```

#### Step 7: Create Initial "Public-Only" Skill File

```markdown
# Security Questionnaire Skill - [Company Name]

**Last Updated:** [Date]
**Version:** 0.1 (Public Sources Only)
**Coverage:** ~40-50% with High confidence, ~30-40% Medium confidence, ~10-20% gaps

**Source Documents:**
- Security Overview: [URL]
- Documentation Site: [URL]
- Trust Center: [URL]
- Privacy Policy: [URL]

**Status:** PUBLIC SOURCES ONLY - Missing internal docs (SOC 2, policies)
**Next Steps:** Request SOC 2 report to improve coverage to 80-90%

---

## Quick Reference Facts (Public Sources)

[Organized by category with coverage notes]

---

## Response Templates

[Templates with confidence tiers based on available info]

---

## Known Gaps & Workarounds

[Document what's missing and how to handle those questions]

---

## Enhancement Roadmap

[What documents/info would improve the skill]
```

---

### Phase 1: Complete Your First Questionnaire (With Public Sources Only)

**You need:**
- Your public-only skill (from Phase 0)
- The questionnaire to complete
- Willingness to mark some answers as "Medium/Low confidence"

**Modified workflow for public-only sources:**

1. **Pre-fetch all available public documentation**
2. **Answer in tiers:**
   - Questions covered by public docs: Answer with High/Medium confidence
   - Questions not covered: Use workaround language, mark Low confidence
   - Questions requiring specifics: Note "Available upon request" or "Per SOC 2 report"
3. **Track every gap:** Log which questions you couldn't answer confidently
4. **Create "request list":** Prioritize what internal docs would be most valuable

**Expected results:**
- ~50-60% High confidence answers (from public docs)
- ~20-30% Medium confidence (workaround language)
- ~10-20% Low confidence (gaps requiring internal docs)

**Output includes:**
- Completed questionnaire (with confidence levels)
- **Gap analysis:** Exactly which questions need internal docs
- **ROI document:** "If we had SOC 2 report, we could answer X questions definitively"

---

### Phase 1.5: Request and Integrate Internal Documentation (When Available)

**When SOC 2 or internal docs become available:**

#### Step 1: Map Gaps to New Documentation

```markdown
## Gap Coverage from SOC 2 Report

### Critical Gaps Filled:
1. **Vulnerability Management (Previously Medium confidence)**
   - NEW: Daily automated scans (SOC 2 p.24)
   - NEW: Remediation SLAs: Critical 7d, High 30d, Medium/Low 60d (SOC 2 p.24)
   - Template upgraded: Medium → High confidence

2. **Access Reviews (Previously Low confidence)**
   - NEW: Quarterly reviews documented (SOC 2 Control AM-02)
   - Template upgraded: Low → High confidence

3. **Training (Previously Low confidence)**
   - NEW: Within 30 days of hire + annually (SOC 2 Control IS-02)
   - NEW: Tracked with quizzes in Vanta (SOC 2 p.21)
   - Template upgraded: Low → High confidence

[... continue for all gaps ...]

### Coverage Improvement:
- Before SOC 2: 50% High, 30% Medium, 20% Low
- After SOC 2: 95% High, 5% Medium, 0% Low
- Improvement: +45 percentage points High confidence
```

#### Step 2: Update All Templates with New Sources

Go through each Medium/Low confidence template and upgrade:

**Before (Public only):**
```markdown
### Vulnerability Management
**Response:** "Regular vulnerability scanning performed per industry standards."
**Sources:** https://company.com/security
**Confidence:** Medium
```

**After (With SOC 2):**
```markdown
### Vulnerability Management
**Response:** "Yes. Daily automated vulnerability scans of externally facing endpoints. Annual third-party penetration tests. SLAs: Critical 7 days, High 30 days, Medium/Low 60 days."
**Sources:** https://company.com/security, SOC 2 p.24, Control TV-01
**Confidence:** High
```

#### Step 3: Remove Workarounds

Delete all "Available upon request" and "Per industry standards" language when you have specifics.

---

### Phase 2: Extract Knowledge (Same as Before)

**You need:**
- 1 completed security questionnaire (with sources documented)
- All public documentation URLs
- SOC 2 report (or equivalent compliance docs)

**What you're extracting:**
- Which questions appeared
- What answers worked
- Where the information came from
- What required multiple lookups

---

### Phase 2: Initial Skill Creation (After Questionnaire 1)

#### Step 1: Create the Skill File Structure

Create `SKILL.md` with this exact structure:

```markdown
# Security Questionnaire Skill - [Company Name]

**Last Updated:** [Date]
**Source Documents:**
- Public docs: [List URLs]
- SOC 2 Report: [Date/Version]
- Other: [Any additional sources]

---

## Quick Reference Facts

[Fast lookup for common facts - organized by topic]

---

## Response Templates

[Proven answers for common question patterns]

---

## Source Mappings

[Topic → Document/Page lookup table]

---

## Edge Cases & Nuances

[Important distinctions and gotchas]

---

## Questions Encountered

[Log of all questions seen - for coverage tracking]
```

---

#### Step 2: Extract Quick Reference Facts

**Method:** Go through your completed questionnaire. For each response, ask:
- "What factual statement did I make?"
- "Could this fact answer other similar questions?"
- "What's the source?"

**Format per fact:**

```markdown
### [Topic Category]
- [Specific fact]: [Value/Detail]
- [Specific fact]: [Value/Detail]
- Source: [URL or SOC 2 reference]
```

**Real Example from Monte Carlo:**

```markdown
### Identity & Access Management

**Authentication:**
- SSO support: SAML 2.0 via Okta, Azure AD
- MFA: Required for all employees/contractors
- MFA for production: Required with VPN access
- Source: https://docs.getmontecarlo.com/docs/access-management

**Account Lifecycle:**
- Provisioning: SCIM automated provisioning/deprovisioning
- Access model: Role-Based Access Control (RBAC)
- Termination: Access revoked within 24 hours
- Access reviews: Quarterly for all production systems
- Source: https://docs.getmontecarlo.com/docs/access-management, SOC 2 Control AM-02, HR-03

**Privileged Access:**
- Model: Least-privilege
- Requirements: MFA + VPN for production access
- Monitoring: All sessions logged and monitored
- Source: https://docs.getmontecarlo.com/docs/access-management
```

**How to organize facts:**
- Group by major category (IAM, Infrastructure, Data Protection, etc.)
- Start with most commonly asked topics
- Include specific values (not vague terms like "regularly")
- Always cite source (URL + SOC 2 reference when applicable)

---

#### Step 3: Create Response Templates

**Method:** For each question in your questionnaire, identify the pattern:

**Question pattern examples:**
- "How are user accounts [onboarded/managed/offboarded]?"
- "Do you have [MFA/SSO/encryption]?"
- "How often do you [scan/test/review]?"
- "What is your [policy/process/procedure] for X?"

**For each pattern, create a template:**

```markdown
### [Category]: [Template Name]

**Question patterns:**
- "[Pattern 1]"
- "[Pattern 2]"
- "[Pattern 3]"

**Response:**
"[Your proven concise answer]"

**Sources:** [URLs, SOC 2 references]
**Confidence:** [High/Medium/Low]
**Notes:** [Any important context or variations]
```

**Real Example:**

```markdown
### IAM: User Account Lifecycle Management

**Question patterns:**
- "How are user accounts onboarded and managed and disabled?"
- "Describe your user provisioning process"
- "How do you manage user lifecycle?"
- "What is your account management procedure?"

**Response:**
"Centralized identity management with SCIM provisioning for automated lifecycle management. Role-Based Access Control (RBAC) with least-privilege principles. Accounts deprovisioned within 24 hours upon termination."

**Sources:** https://docs.getmontecarlo.com/docs/access-management, SOC 2 Control HR-03
**Confidence:** High
**Notes:** Emphasize SCIM automation and 24-hour deprovisioning SLA

---

### IAM: SSO Implementation

**Question patterns:**
- "Do you support SSO?"
- "Any SSO solution used to secure applications access?"
- "What SSO providers do you support?"
- "Describe your SSO implementation and security features"

**Response:**
"Yes. SSO via SAML 2.0 with Okta and Azure AD. Features include SCIM provisioning, MFA enforcement, session management, and audit logging."

**Sources:** https://docs.getmontecarlo.com/docs/access-management, SOC 2 p.28
**Confidence:** High
**Notes:** Can expand on specific features if asked (time-bound sessions, SCIM details)

---

### Infrastructure: Vulnerability Management

**Question patterns:**
- "Do you perform vulnerability assessments and penetration tests?"
- "How often are vulnerability scans performed?"
- "What is your vulnerability remediation process?"
- "Describe your vulnerability management program"

**Response:**
"Yes. Daily automated vulnerability scans of externally facing endpoints. Annual third-party penetration tests. SLAs: Critical 7 days, High 30 days, Medium/Low 60 days."

**Sources:** https://docs.getmontecarlo.com/docs/infrastructure-security, SOC 2 p.24, Control TV-01
**Confidence:** High
**Notes:** Emphasize daily scanning (not just periodic) and specific SLAs
```

**How many templates to create:**
- After questionnaire 1: Aim for 20-30 templates (most common patterns)
- After questionnaire 2: Add 10-15 more
- After questionnaire 3: Add 5-10 more
- Eventually: 50-100 templates covering 80-90% of questions

---

#### Step 4: Create Source Mappings

**Purpose:** Quick lookup - "Where do I find info about X?"

**Two formats:**

**Format 1: By Topic**

```markdown
## Source Mappings

### By Topic

**Authentication/Access:**
- SSO/SAML/Okta → Access Management doc
- MFA requirements → Access Management doc
- Account lifecycle → Access Management doc, SOC 2 Control HR-03
- Access reviews → Access Management doc, SOC 2 Control AM-02

**Encryption/Data Protection:**
- Encryption standards → Data Protection doc
- Key management → Data Protection doc, SOC 2 Controls CR-01, CR-02
- Data at rest → Data Protection doc (AES-256)
- Data in transit → Data Protection doc, SOC 2 p.25 (TLS 1.2+)

**Vulnerability Management:**
- Scanning frequency → Infrastructure Security doc, SOC 2 p.24
- Penetration testing → Infrastructure Security doc, Compliance doc
- Remediation SLAs → SOC 2 p.24 (severity table)
- Patch management → Infrastructure Security doc, SOC 2 Control CM-05

**Training/Awareness:**
- Security training → SOC 2 Control IS-02, p.21
- Onboarding training → SOC 2 Control IS-02, HR-02
- Frequency → SOC 2 p.21 (within 30 days, annually)
- Tracking → SOC 2 (Vanta quizzes)

**Business Continuity:**
- BC/DR plan → Data Protection doc, SOC 2 Control BC-01
- DR testing → Data Protection doc, SOC 2 (annual minimum)
- Backup frequency → SOC 2 Control BC-03 (daily)
- Data replication → Data Protection doc (multi-AZ)

**Compliance/Audits:**
- SOC 2 → Compliance doc
- ISO certifications → Compliance doc (27001, 27017, 27018)
- Penetration tests → Compliance doc (annual)
- Risk assessment → SOC 2 Control RC-01, p.21
```

**Format 2: By Document**

```markdown
### By Document

**Access Management**
- URL: https://docs.getmontecarlo.com/docs/access-management
- Covers: SSO, SAML, MFA, RBAC, SCIM, access reviews, privileged access, account lifecycle, VPN
- Key facts: Okta/Azure AD, quarterly reviews, 24hr deprovisioning, MFA mandatory

**Data Protection & Encryption**
- URL: https://docs.getmontecarlo.com/docs/data-protection-and-encryption
- Covers: Encryption (rest/transit), key management, data classification, BC/DR, backups, data retention
- Key facts: AES-256, TLS 1.2+, annual DR testing, multi-AZ replication

**Infrastructure Security**
- URL: https://docs.getmontecarlo.com/docs/infrastructure-security
- Covers: AWS architecture, serverless, WAF, vulnerability scanning, network segmentation, monitoring
- Key facts: Lambda serverless, daily scans, AWS WAF, 24/7 monitoring, SIEM

**Application Security**
- URL: https://docs.getmontecarlo.com/docs/application-security
- Covers: SDLC, CI/CD, code scanning, penetration testing, change management, IaC
- Key facts: OWASP Top 10, peer review, immutable builds, signed code

**Compliance**
- URL: https://docs.getmontecarlo.com/docs/compliance
- Covers: SOC 2, ISO certifications, penetration testing, compliance docs
- Key facts: SOC 2 Type 2, ISO 27001/27017/27018, annual pentests

**SOC 2 Report Key Pages:**
- p.20-21: Organizational structure, training, risk assessment
- p.24-25: Incident response, vulnerability management, SLAs, monitoring
- p.25-26: Infrastructure controls, endpoint security, change management
- p.26-27: Endpoint policies, anti-malware, disposal
```

---

#### Step 5: Document Edge Cases

**Purpose:** Capture nuances that prevent wrong answers.

**Method:** Look for questions where:
- The answer is "Not applicable" (but needs explanation)
- There's an important distinction (e.g., "endpoints" vs "infrastructure")
- The question could be misinterpreted
- There's a common misconception

**Format:**

```markdown
## Edge Cases & Nuances

### [Category]: [Topic]
**Issue:** [What's the potential confusion]
**Key distinction:** [What's actually true]
**Response pattern:** [How to answer]
**Example question:** [Real question that triggered this]
```

**Real Examples:**

```markdown
## Edge Cases & Nuances

### Endpoint Security: Customer Data on Endpoints
**Issue:** Questions about endpoint security may seem to apply to customer data
**Key distinction:** Customer observability data is NOT stored/processed on employee endpoints
**Response pattern:** "Not applicable for customer data. Customer data not stored on endpoints. [Then describe endpoint security policies that DO exist]"
**Example questions:**
- "Any DLP agents deployed in endpoint machines?"
- "How is internet traffic controlled from user machine in WFH cases?"
- "Are end-user devices used to transmit or process customer data?"

### Email Security: Customer Data Transmission
**Issue:** Questions about email security may seem to apply to customer data
**Key distinction:** Customer data is NOT transmitted via email
**Response pattern:** "Customer data not transmitted via email - all exchange occurs through platform with TLS 1.2+ and AES-256 encryption. [Then describe corporate email security if relevant]"
**Example questions:**
- "How do you secure email communication?"
- "Can email be restricted to certain whitelisted domains?"
- "Any ATP and content inspections for email?"

### Patching: Serverless Architecture
**Issue:** Traditional patching questions don't apply to serverless
**Key distinction:** Lambda functions use immutable, short-lived containers - no persistent servers to patch
**Response pattern:** "Serverless Lambda architecture uses immutable containers - no persistent servers to patch. Dependencies scanned in CI/CD. Automated update tools maintain current versions."
**Example questions:**
- "How often are servers patched?"
- "What is your patching cycle?"
- "Are all systems patched within 30 days?"

### Penetration Testing vs Vulnerability Scanning
**Issue:** Questions may conflate these two different activities
**Key distinction:** 
- Vulnerability scanning: Daily automated scans
- Penetration testing: Annual third-party manual testing
**Response pattern:** Address BOTH if question is ambiguous. "Daily automated vulnerability scans of external endpoints. Annual third-party penetration tests."
**Example questions:**
- "Do you perform vulnerability assessments and penetration tests?"
- "How often are security assessments performed?"

### Access Reviews: Frequency Matters
**Issue:** Questions about "access reviews" without specifying frequency
**Key distinction:** Monte Carlo performs quarterly reviews (not annual)
**Response pattern:** Always specify "quarterly" - this is more frequent than many vendors
**Source:** SOC 2 Control AM-02

### Data Disposal: Cloud vs Physical
**Issue:** Questions about "secure disposal" may assume physical media
**Key distinction:** Cloud data disposal = cryptographic destruction via key rotation/deletion
**Response pattern:** "Cloud data cryptographically destroyed through key rotation and deletion. Customer data disposed within 90 days with confirmation. Physical media disposal follows industry standards when applicable."
**Source:** SOC 2 Control OM-04
```

---

#### Step 6: Log Questions Encountered

**Purpose:** Track coverage over time, identify gaps.

**Format:**

```markdown
## Questions Encountered

### Questionnaire 1: [Customer Name] - [Date]

**Category: Identity & Access Management (8 questions)**
1. How user accounts are onboarded and managed and disabled? ✓
2. How privileged access and accounts are managed? ✓
3. Any SSO solution used to secure applications access? ✓
4. What are the password policies enforced? ✓
5. Do you manage shared/group credentials? ✓
6. Is conditional-based access enabled? ✓
7. Are separate OUs created for different clients? ✓
8. Local system accounts on end-user machines? ✓

**Category: Logging & Monitoring (3 questions)**
9. How logs are captured and monitored? ✓
10. Which events and log sources are collected? ✓
11. Any alerts configured for security events? ✓

[... continue for all categories ...]

**Coverage stats:**
- Total questions: 64
- Covered by skill: 0 (first questionnaire)
- New templates added: 30
- New facts added: 50

---

### Questionnaire 2: [Next Customer] - [Date]

[... repeat format ...]

**Coverage stats:**
- Total questions: 72
- Covered by skill: 58 (81%)
- New templates added: 12
- New facts added: 15
```

---

### Phase 3: Skill Iteration (After Each Questionnaire)

#### After completing questionnaire 2, 3, 4+:

**Step 1: Identify gaps**

```
Questions from this questionnaire that took >30 seconds to answer:
1. [Question text]
   - Why it took time: [Reason - not in skill? Had to search?]
   - Answer found: [Source]
   - Add to skill: Yes/No

2. [Question text]
   ...
```

**Step 2: Add to skill**

For each gap identified:
1. **Update Quick Reference Facts** if new fact discovered
2. **Add Response Template** if new question pattern
3. **Update Source Mappings** if found info in new place
4. **Add Edge Case** if encountered nuance

**Step 3: Refine existing templates**

Look for:
- Templates that needed modification during questionnaire
- Templates that are too wordy (aim for 1-3 sentences)
- Templates missing key details
- Templates with outdated sources

**Step 4: Track coverage**

```markdown
## Skill Coverage Over Time

| Questionnaire | Total Qs | Covered | New Templates | Coverage % |
|---------------|----------|---------|---------------|------------|
| Q1            | 64       | 0       | 30            | 0%         |
| Q2            | 72       | 58      | 12            | 81%        |
| Q3            | 68       | 63      | 5             | 93%        |
| Q4            | 75       | 71      | 4             | 95%        |
```

---

## Writing Style Rules (Critical for Quality)

### Conciseness Guidelines

**Default length: 1-3 sentences**

Only go longer if question explicitly requires it (e.g., "Describe in detail...")

**By question type:**

```markdown
### Yes/No Questions
Format: "[Yes/No]. [1 key detail sentence]"

Example:
Q: "Do you have MFA?"
A: "Yes. MFA required for all employees/contractors accessing internal systems."

### "How" Questions (1-2 sentences)
Focus on method/process only.

Example:
Q: "How are logs captured?"
A: "Centralized logging with SIEM integration. All privileged sessions, authentication events, and administrative actions logged."

### "What" Questions (list format)
List items, avoid explanations.

Example:
Q: "What security controls are in place?"
A: "AWS WAF, network segmentation, daily vulnerability scanning, SIEM integration, 24/7 monitoring."

### "Describe" Questions (2-3 sentences)
Cover essentials only.

Example:
Q: "Describe your vulnerability management process"
A: "Daily automated vulnerability scans of external endpoints. Triaged by severity with SLAs: Critical 7 days, High 30 days, Medium/Low 60 days. All issues tracked to completion and re-tested post-remediation."

### Multi-part Questions
Address each part clearly, use numbering if helpful.

Example:
Q: "Do you perform penetration tests? If yes, (1) how often (2) who conducts (3) provide reports"
A: "Yes. (1) Annual third-party penetration tests. (2) Independent security firms. (3) Reports available at Trust Center: https://trust.montecarlodata.com"
```

**What to remove:**
- ❌ Background context ("Monte Carlo is committed to...")
- ❌ Preambles ("In order to ensure security...")
- ❌ Explanations ("Monte Carlo does X because Y...")
- ❌ Fluff ("comprehensive", "robust", "enterprise-grade")

**What to keep:**
- ✅ Specific values (frequencies, timelines, technologies)
- ✅ Technical details (protocols, standards, tools)
- ✅ Sources/evidence (when internal notes, not in response)

---

## Source Attribution Rules

**In response templates, document sources separately:**

```markdown
**Response:**
"[Answer without source citations]"

**Sources:** [Full attribution here]
```

**Source format:**

```markdown
**Web documentation:**
https://docs.company.com/docs/page-name

**SOC 2 Report:**
SOC 2 p.24
SOC 2 Control AM-01
SOC 2 Control TV-01, p.24

**Multiple sources:**
https://docs.company.com/docs/access-management, SOC 2 Control AM-02, p.21
```

---

## Complete Skill File Template

```markdown
# Security Questionnaire Skill - [Company Name]

**Last Updated:** [Date]
**Version:** 1.0
**Coverage:** [X]% of common questions

**Source Documents:**
- Trust Center: [URL]
- Access Management: [URL]
- Security Overview: [URL]
- Data Protection: [URL]
- Infrastructure Security: [URL]
- Application Security: [URL]
- Compliance: [URL]
- SOC 2 Type 2 Report: [Date/Version]

---

## Quick Reference Facts

### Identity & Access Management

[Facts organized by sub-topic]

### Infrastructure Security

[Facts organized by sub-topic]

### Application Security

[Facts organized by sub-topic]

### Data Protection

[Facts organized by sub-topic]

### Endpoint Security

[Facts organized by sub-topic]

### Logging & Monitoring

[Facts organized by sub-topic]

### Business Continuity

[Facts organized by sub-topic]

### Compliance & Governance

[Facts organized by sub-topic]

### Training & Awareness

[Facts organized by sub-topic]

### Incident Response

[Facts organized by sub-topic]

---

## Response Templates

### IAM: [Topic]

**Question patterns:**
- "[Pattern]"

**Response:**
"[Answer]"

**Sources:** [References]
**Confidence:** [High/Medium/Low]
**Notes:** [Context]

[Repeat for 50-100 templates across all categories]

---

## Source Mappings

### By Topic

[Topic → Document/Page mappings]

### By Document

[Document → Topics covered]

---

## Edge Cases & Nuances

### [Category]: [Topic]
**Issue:** [Confusion point]
**Key distinction:** [Truth]
**Response pattern:** [How to answer]
**Example question:** [Real example]

[Repeat for all edge cases]

---

## Questions Encountered

### Questionnaire 1: [Customer] - [Date]
[Full question log with coverage tracking]

### Questionnaire 2: [Customer] - [Date]
[Full question log with coverage tracking]

---

## Skill Coverage Over Time

| Questionnaire | Total Qs | Covered | New Templates | Coverage % |
|---------------|----------|---------|---------------|------------|
| Q1            | 64       | 0       | 30            | 0%         |
| Q2            | 72       | 58      | 12            | 81%        |

---

## Maintenance Log

**[Date]:** Initial skill creation after Q1
**[Date]:** Added 12 templates after Q2, updated IAM section
**[Date]:** Added edge case for endpoint security after Q3
**[Date]:** Updated SOC 2 references to new report version
```

---

## Prompting Strategy for Skill-Based Answering

**When using the skill to answer questionnaires:**

```markdown
WORKFLOW:
1. Pre-fetch all public documentation (have available as backup)
2. For each question:
   a. Check skill for matching template
   b. If High confidence match → Use template response
   c. If no match → Search pre-fetched docs
   d. If still unclear → Search Project Knowledge (SOC 2)
   e. If still uncertain → Mark Medium/Low for verification
3. Never finalize Medium/Low confidence without verification
4. After questionnaire, identify gaps and update skill

RESPONSE RULES:
- Use skill templates when confidence is High
- Adapt templates slightly if question wording requires it
- Always cite sources (URLs, SOC 2 references)
- Default to 1-3 sentences unless question requires more detail
- Check for edge cases before answering

OUTPUT:
- Vendor-ready response (no internal notes in response text)
- Confidence Level: High/Medium/Low
- Sources: Full URLs + SOC 2 page numbers/control IDs
- Remarks: Internal notes for tracking
```

---

## Success Metrics

Track these over time to measure skill effectiveness:

```markdown
## Skill Performance Metrics

**Coverage:**
- % of questions answered from skill (target: 80-90%)
- % requiring doc lookup (target: 10-20%)
- % requiring deep research (target: 0-5%)

**Speed:**
- Avg time per question (target: 5-10 seconds with skill)
- Total questionnaire time (target: 3-5 minutes)

**Quality:**
- % High confidence responses (target: 95%+)
- % Medium/Low requiring verification (target: <5%)
- Vendor follow-up questions (target: minimize)

**Maintenance:**
- New templates per questionnaire (should decrease over time)
- Last skill update date (should be recent)
- Coverage improvement per iteration
```

---

## Common Mistakes to Avoid

1. **Too verbose responses**
   - ❌ Aim for 1-3 sentences, not paragraphs
   - ❌ Remove all fluff and context

2. **Missing sources**
   - ❌ Every template needs source attribution
   - ❌ URLs must be complete, SOC 2 refs must include page/control

3. **Vague facts**
   - ❌ "Regular reviews" → ✅ "Quarterly reviews"
   - ❌ "Strong encryption" → ✅ "AES-256 encryption"
   - ❌ "Quickly remediated" → ✅ "Critical: 7 days, High: 30 days"

4. **Not documenting edge cases**
   - ❌ Assuming questions are straightforward
   - ❌ Missing "Not applicable" scenarios

5. **Not updating skill**
   - ❌ Building skill once and never updating
   - ❌ Not tracking coverage metrics

6. **Templates too specific**
   - ❌ Templates should match patterns, not exact wording
   - ❌ "Question patterns" section should list variations

---

## Practical Example: Building a Skill from Scratch

### Week 1: Public Docs Only

**Day 1: Gather Resources**
- Find company's security page: https://company.com/security
- Find docs site: https://docs.company.com
- Find trust center: https://trust.company.com
- Find compliance mentions: Check about page, privacy policy

**Day 2: Extract Facts**
- Read through all pages, extract structured facts
- Document exactly what's stated (no assumptions)
- Note coverage level: Complete, Partial, or Missing
- Create Quick Reference section with ~30-50 facts

**Day 3: Create Initial Templates**
- Identify 10 most common question types
- Write response for each using only available public info
- Mark confidence: High (have specifics), Medium (vague), Low (missing)
- Document gaps for each template

**Day 4: First Questionnaire**
- Use skill for what you have
- Use workaround language for gaps ("per industry standards", "available upon request")
- Track which questions were hardest (need internal docs most)

**Day 5: Gap Analysis**
- List all Low/Medium confidence responses
- Prioritize: Which internal doc would help most?
- Create request list for internal team
- Result: 40-60% coverage, but questionnaire completed

---

### Week 2-3: Waiting for Internal Docs

**Meanwhile:**
- Use skill for additional questionnaires
- Refine workaround language
- Track which gaps appear most frequently
- Build case for why SOC 2 access would save time

---

### Week 4: SOC 2 Report Received

**Day 1: Quick Scan**
- Skim SOC 2 for key sections (access management, vulnerability management, training)
- Note page numbers for common topics
- Create page index: "Access reviews = p.21, Vulnerability SLAs = p.24", etc.

**Day 2-3: Fill Gaps**
- Go through each Low/Medium template
- Search SOC 2 for specifics (frequencies, SLAs, timelines)
- Upgrade templates with new information
- Update confidence levels: Medium → High

**Day 4: Validate**
- Re-answer hardest questions from Week 1 questionnaire
- Compare old (workaround) vs new (specific) responses
- Measure improvement: 50% → 90% High confidence

**Day 5: Next Questionnaire**
- Time improvement: 20 minutes → 8 minutes
- Confidence improvement: 60% → 95% High
- New templates needed: ~5 (down from ~15)

---

### Weeks 5+: Maintenance

**After each questionnaire:**
- Add 2-5 new templates (decreasing over time)
- Update any changed facts (new cert dates, tool changes)
- Track coverage: Should reach 85-90% by questionnaire 5

**Quarterly:**
- Update SOC 2 references when new report issued
- Review public docs for changes
- Archive old versions, track changes

**Result:** 
- Questionnaire time: 3-5 minutes
- Coverage: 90%+
- Confidence: 95%+ High
- Maintenance: 15 minutes per questionnaire

---

## Next Steps

1. **Complete your first questionnaire** (following optimized workflow)
2. **Immediately extract knowledge** using this guide
3. **Create initial SKILL.md** with 20-30 templates
4. **Use skill for questionnaire 2**, track what's missing
5. **Iterate and improve** after each questionnaire
6. **Aim for 80%+ coverage** by questionnaire 4-5

**Time investment:**
- First skill creation: 1-2 hours after Q1
- Updates after each questionnaire: 15-30 minutes
- Payoff: 95% time reduction on future questionnaires
