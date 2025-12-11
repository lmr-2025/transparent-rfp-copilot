# Security Questionnaire Automation - Complete Workflow Summary

## Overview
Through iterative optimization, we developed a system that reduces security questionnaire completion time from 20-30 minutes to 6-8 minutes (70-75% faster) while maintaining high accuracy and comprehensive source attribution.

---

## Key Performance Metrics

**Speed Evolution:**
- Initial approach: 20-30 minutes for 64 questions
- First optimization: 12-15 minutes
- Second optimization: 8-12 minutes
- **Final optimized: 6-8 minutes** (with pre-fetch)

**Quality Metrics:**
- Response conciseness: 60% reduction in word count (85 words → 35 words avg)
- Confidence: 100% High confidence responses (64/64)
- Source attribution: Full URLs + SOC 2 page numbers/control IDs

---

## Core Workflow: The "Skill" Build Process

### What is a "Skill"?
A skill is a curated knowledge file (SKILL.md) containing:
1. Quick reference facts (from public docs/SOC 2)
2. Proven response templates for common questions
3. Source mappings (which doc/page has what info)
4. Edge cases and nuances

**Goal:** Enable instant answers without fetching docs every time.

---

## Step-by-Step Skill Building Workflow

### Phase 1: Initial Questionnaire Completion (Setup)

**Input:** New security questionnaire (any format: Excel, Word, PDF, text)

**Process:**
1. **Pre-fetch all public documentation** (9 URLs for Monte Carlo):
   - Trust Center
   - Access Management
   - Security Overview
   - Data Protection & Encryption
   - Infrastructure Security
   - Application Security
   - Common Security Questions
   - Compliance
   - AI Privacy

2. **First pass:** Batch answer questions (5-10 at a time) by topic
   - Use pre-fetched docs as primary source
   - Search Project Knowledge (SOC 2) for specifics

3. **Second pass:** Verify Medium/Low confidence responses
   - Use MCP servers for additional verification
   - Never finalize without verification

4. **Output:** Excel with vendor responses + internal tracking columns:
   - Confidence Level (High/Medium/Low)
   - Sources (full URLs, SOC 2 page numbers/control IDs)
   - Remarks (internal notes)

**Deliverables:**
- Completed questionnaire
- List of common questions encountered
- List of facts that required multiple lookups

---

### Phase 2: Skill Extraction (After 1st Questionnaire)

**Goal:** Extract reusable knowledge to speed up future questionnaires.

**What to Extract:**

1. **Quick Reference Facts:**
   ```markdown
   ## Identity & Access Management
   - SSO: SAML 2.0 via Okta, Azure AD
   - MFA: Required for all employees/contractors
   - Account deprovisioning: Within 24 hours
   - Access reviews: Quarterly
   - Source: https://docs.getmontecarlo.com/docs/access-management, SOC 2 Control AM-02
   ```

2. **Response Templates for Common Questions:**
   ```markdown
   ## Template: "How are user accounts onboarded/managed/disabled?"
   Response: "Centralized identity management with SCIM provisioning for automated lifecycle management. Role-Based Access Control (RBAC) with least-privilege principles. Accounts deprovisioned within 24 hours upon termination."
   Sources: https://docs.getmontecarlo.com/docs/access-management, SOC 2 Control HR-03
   Confidence: High
   ```

3. **Topic → Source Mappings:**
   ```markdown
   ## Quick Lookup by Topic
   - MFA/SSO/Authentication → Access Management doc
   - Encryption/Key Management → Data Protection doc
   - Vulnerability scanning/Patching → Infrastructure Security doc, SOC 2 p.24
   - Training/Awareness → SOC 2 Controls IS-02, p.21
   - Incident Response → SOC 2 Control OM-05, p.24-25
   ```

4. **Edge Cases & Nuances:**
   ```markdown
   ## Important Distinctions
   - "Endpoint security for customer data" → NOT APPLICABLE (customer data not on endpoints)
   - "Penetration testing" → Annual (third-party), separate from daily vulnerability scans
   - "Email security for customer data" → N/A (customer data not transmitted via email)
   ```

---

### Phase 3: Skill Iteration (After Each Questionnaire)

**After completing each new questionnaire:**

1. **Identify gaps:** What questions took longest? What required MCP verification?
2. **Add new templates:** Any new question patterns encountered
3. **Update facts:** Any new details from recent SOC 2 reports or doc updates
4. **Consolidate:** Merge similar response templates

**Skill Growth Pattern:**
- Questionnaire 1: Extract ~20-30 response templates, build initial skill
- Questionnaire 2: Add ~10-15 new templates, refine existing ones
- Questionnaire 3: Add ~5-10 new templates
- Questionnaire 4+: Mostly using existing templates, minor additions

**Eventually:** Skill covers 80-90% of common security questions across all vendors.

---

## Technical Implementation Details

### Response Style Rules (Critical for Quality)

**Conciseness (1-3 sentences default):**
- Binary (Yes/No): Lead with answer + 1 key detail
- "How" questions: 1-2 sentences max
- "What" questions: List items, no explanations
- "Describe" questions: 2-3 sentences, essentials only
- Remove: context, preambles, "Company does X because Y"

**Examples:**

❌ TOO WORDY (85 words):
"Yes. Monte Carlo supports SSO via SAML 2.0 integrated with enterprise identity providers including Okta and Azure AD. Security features include centralized authentication, automated provisioning/deprovisioning via SCIM, MFA enforcement, session management with time-bound tokens, and comprehensive audit logging of all authentication events."

✅ GOOD (23 words):
"Yes. SSO via SAML 2.0 with Okta and Azure AD. Features include SCIM provisioning, MFA enforcement, session management, and audit logging."

---

### Source Attribution Format

**Critical for traceability and updates:**

**Web documentation:**
- Full URLs: `https://docs.getmontecarlo.com/docs/access-management`

**SOC 2 Report:**
- Page numbers: `SOC 2 p.24`
- Control IDs: `SOC 2 Control AM-01`
- Both: `SOC 2 Control TV-01, p.24`

**Multiple sources:**
- Comma-separated: `https://docs.getmontecarlo.com/docs/infrastructure-security, SOC 2 p.25, Control SC-01`

---

### Excel Output Format (Critical for Usability)

**Column Placement Rules:**
1. **NEVER overwrite customer's blank columns** (check existing headers first)
2. **Add internal tracking columns AFTER all customer columns**
3. **Always check row structure before writing**

**Standard Internal Columns:**
- Confidence Level: High / Medium / Low
- Sources: Full URLs, page numbers, control IDs
- Remarks: Internal notes, key details

**Before sending to vendor:**
- Hide internal tracking columns
- Only show vendor-ready response column

---

## Optimization Techniques Applied

### 1. Pre-fetch Documentation (Saves 2-3 minutes)
**Before:** Fetch docs as needed while answering (context switching)
**After:** Fetch all 9 docs upfront, have everything loaded
**Impact:** No interruptions during answering phase

### 2. Batch Processing by Topic (Saves 2-3 minutes)
**Before:** Answer questions sequentially one-by-one
**After:** Group 5-10 related questions, answer together using same doc section
**Impact:** Fewer doc lookups, better context retention

### 3. Concise Responses (Saves 1-2 minutes)
**Before:** Average 85 words per response
**After:** Average 35 words per response (60% reduction)
**Impact:** Less writing time, easier to review

### 4. Two-Pass Verification (Improves accuracy)
**Pass 1:** Answer all questions with docs loaded
**Pass 2:** Verify only Medium/Low confidence items
**Impact:** Don't waste time verifying obvious answers

---

## Resource Priority Order (Critical)

**1. Skill (fastest):** Check skill first for proven templates
**2. Pre-fetched Public Docs:** Use already-loaded documentation
**3. Project Knowledge:** Search SOC 2 for specific controls/pages
**4. MCP Servers:** Only for edge cases requiring additional verification

**Rule:** Never finalize Medium/Low confidence without verification.

---

## Common Question Categories (For Skill Organization)

Organize skill by these major sections:

1. **Identity & Access Management (IAM)**
   - User onboarding/offboarding
   - MFA/SSO
   - Privileged access
   - Access reviews

2. **Infrastructure Security**
   - Vulnerability scanning/patching
   - Network segmentation
   - Firewall/WAF
   - Cloud architecture

3. **Application Security**
   - SDLC/DevSecOps
   - Code scanning
   - Penetration testing
   - Change management

4. **Data Protection**
   - Encryption (at rest/in transit)
   - Key management
   - Data classification
   - Backup/retention

5. **Endpoint Security**
   - Device management
   - Encryption
   - Anti-malware
   - Remote access

6. **Logging & Monitoring**
   - SIEM integration
   - Audit logs
   - Alerting
   - Incident detection

7. **Business Continuity**
   - DR plan
   - BC testing
   - RTO/RPO
   - Failover

8. **Compliance & Governance**
   - SOC 2 / ISO certifications
   - Risk assessments
   - Policy reviews
   - Third-party audits

9. **Training & Awareness**
   - Security training
   - Phishing awareness
   - Onboarding
   - Annual requirements

10. **Incident Response**
    - IRP documentation
    - Severity levels/SLAs
    - Post-mortems
    - Communication

---

## Productization Roadmap

### MVP (Minimum Viable Product)

**Input:** Security questionnaire file (Excel/Word/PDF/text)
**Output:** Completed questionnaire with responses + internal tracking

**Core Features:**
1. Auto-detect question format
2. Pre-fetch all documentation
3. Batch answer by topic using skill
4. Add internal tracking columns (don't overwrite customer columns)
5. Generate completion summary

### V2 (Skill Builder)

**After each questionnaire:**
1. Auto-identify questions not in skill
2. Suggest additions to skill
3. One-click skill update
4. Track skill coverage % over time

### V3 (Multi-Tenant)

**Features:**
1. Company-specific skills (one per customer/client)
2. Shared common skill (cross-company reusable templates)
3. Skill versioning (track changes over time)
4. Skill analytics (most-used templates, gaps)

---

## Example Skill File Structure

```markdown
# Security Questionnaire Skill - Monte Carlo

## Quick Reference

### Identity & Access Management
- SSO: SAML 2.0 via Okta, Azure AD
- MFA: Required for all employees/contractors, production systems
- SCIM: Automated provisioning/deprovisioning
- Account termination: Within 24 hours
- Access reviews: Quarterly for all production systems
- Privileged access: Least-privilege model, MFA + VPN required
- Sources: https://docs.getmontecarlo.com/docs/access-management, SOC 2 AM-02, HR-03

### Vulnerability Management
- Scanning: Daily automated scans of external endpoints
- Penetration testing: Annual by third-party
- Remediation SLAs: Critical 7 days, High 30 days, Medium/Low 60 days
- Sources: https://docs.getmontecarlo.com/docs/infrastructure-security, SOC 2 p.24, TV-01

[... continue for all 10 categories ...]

## Response Templates

### IAM: User Account Management
**Question patterns:**
- "How are user accounts onboarded/managed/disabled?"
- "Describe your user provisioning process"
- "How do you manage user lifecycle?"

**Response:**
"Centralized identity management with SCIM provisioning for automated lifecycle management. Role-Based Access Control (RBAC) with least-privilege principles. Accounts deprovisioned within 24 hours upon termination."

**Sources:** https://docs.getmontecarlo.com/docs/access-management, SOC 2 Control HR-03
**Confidence:** High

[... continue with 50-100 templates ...]

## Edge Cases

### Endpoint Security
**Important:** Customer data is NOT stored/processed on employee endpoints.
**Response pattern:** "Not applicable for customer data. Customer data not stored on endpoints. [Then describe endpoint security policies if asked]"

### Email Security
**Important:** Customer data is NOT transmitted via email.
**Response pattern:** "Customer data not transmitted via email - all exchange occurs through platform with TLS 1.2+ and AES-256 encryption."

[... continue with all edge cases ...]

## Source Mappings

### By Topic
- Authentication/SSO/MFA → Access Management doc
- Encryption/Keys → Data Protection doc
- Vulnerability/Patching → Infrastructure Security doc, SOC 2 p.24
- Training → SOC 2 IS-02, p.21
- BC/DR → Data Protection doc, SOC 2 BC-01
- Incident Response → SOC 2 OM-05, p.24-25

### By Document
- Access Management: https://docs.getmontecarlo.com/docs/access-management
  * Covers: IAM, SSO, MFA, access reviews, privileged access
- Data Protection: https://docs.getmontecarlo.com/docs/data-protection-and-encryption
  * Covers: Encryption, key management, data classification, BC/DR
[... continue for all docs ...]
```

---

## Key Success Factors

1. **Pre-fetch everything:** Load all docs before answering (biggest time saver)
2. **Batch by topic:** Answer related questions together (reduces context switching)
3. **Be concise:** 1-3 sentences default (60% word reduction)
4. **Build the skill iteratively:** Each questionnaire improves the skill
5. **Never overwrite customer columns:** Check existing structure first
6. **Full source attribution:** URLs + page numbers for traceability
7. **Two-pass verification:** Don't waste time verifying High confidence answers

---

## Next Steps for Productization

1. **Claude Code:** Build CLI tool for questionnaire automation
2. **Skill management:** Version control, diff tracking, coverage analytics
3. **Template library:** Shared templates across companies/industries
4. **Excel intelligence:** Auto-detect column structure, smart column placement
5. **PDF/Word support:** Extract questions from any format
6. **Batch processing:** Process multiple questionnaires simultaneously
7. **Feedback loop:** Track which responses get vendor follow-ups (improve templates)

---

## Estimated ROI

**Manual completion:** 2-4 hours per questionnaire (64 questions)
**Current optimized:** 6-8 minutes per questionnaire
**Time savings:** ~95% reduction

**With mature skill (80% coverage):**
- Skill-based answers: Instant (0 time)
- New questions requiring lookup: 2-3 minutes
- Total time: ~3-5 minutes per questionnaire

**Annual volume assumption:** 50 questionnaires/year
- Manual: 100-200 hours/year
- Optimized: 2.5-4 hours/year
- **Savings: 96-98 hours/year per company**
