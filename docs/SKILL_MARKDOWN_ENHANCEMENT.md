# Skill Markdown Enhancement Plan

**Goal**: Make skills more LLM-friendly by embracing pure markdown structure (Anthropic-style) instead of structured database fields.

**Status**: `quickFacts` and `edgeCases` fields exist in schema but are NOT currently used in code - perfect for clean migration.

---

## Current State Analysis

### Database Schema
```prisma
model Skill {
  id              String   @id @default(uuid())
  title           String
  content         String   @db.Text        // ✅ PRIMARY - Keep this
  categories      String[]                  // ✅ Metadata - Keep for organization
  quickFacts      Json?                     // ❌ UNUSED - Deprecate
  edgeCases       String[]                  // ❌ UNUSED - Deprecate
  sourceUrls      Json?                     // ✅ Metadata - Keep for tracking
  // ... other fields
}
```

### Current LLM Format
```typescript
// src/app/api/knowledge-chat/route.ts:115
`=== SKILL ${idx + 1}: ${skill.title} ===\n\n${skill.content}`
```

**This is already correct!** Just need to enhance the markdown content structure.

### Current Skill Creation Prompt
- Location: [src/lib/promptBlocks.ts](../src/lib/promptBlocks.ts) lines 138-150
- Already instructs to create "## Common Questions" section WITHIN content
- Good foundation, needs enhancement for edge cases and source attribution

---

## Problems with Current Approach

1. **Incomplete structure**: Skills lack standardized sections for edge cases and limitations
2. **No source attribution**: Can't easily cite where facts come from
3. **Generic Q&A**: Common Questions are too brief, lack specifics
4. **Missing guidance**: LLM doesn't know how to properly use Common Questions (as discovery vs templates)
5. **Unused fields**: `quickFacts` and `edgeCases` exist but aren't used - create confusion

---

## Recommended Solution: Pure Markdown Skills

### Philosophy
- **Everything in `content` field** - No structured JSON fields for LLM consumption
- **Rich markdown structure** - Use headers, bullets, formatting for semantic meaning
- **Anthropic-compatible** - Skills can be exported as standalone .md files
- **Self-documenting** - Include metadata sections (sources, limitations, common questions)
- **Synthesis over templates** - LLM reads full content, doesn't copy-paste Q&A

### Ideal Skill Structure

```markdown
# [Skill Title]

## Overview
Brief introduction to what this skill covers (2-3 sentences).

## [Main Section 1]
Detailed content with ALL facts, details, and specifics.
- Concrete numbers, versions, standards (AES-256, TLS 1.3, etc.)
- Complete lists (don't say "including X, Y, and more")
- Step-by-step procedures when applicable

## [Main Section 2]
More detailed content organized by subsections.

### [Subsection A]
Specific details...

### [Subsection B]
More specific details...

## Common Questions

**Q: [Specific question]?**
A: [COMPLETE answer with concrete details, numbers, limitations]

**Q: [Another question]?**
A: [COMPLETE answer - not generic, include standards/versions/specifics]

**Q: [Third question]?**
A: [COMPLETE answer]

(Include 3-5 questions that help match this skill to incoming queries)

## Edge Cases & Limitations
- [Specific exception or limitation with context]
- [What is NOT covered or NOT available]
- [Special cases requiring different handling]
- [Known restrictions or requirements]

## Approved Sources
- https://company.com/docs/[relevant-page]
- [Document Name] (2024): [Access info if needed]
- https://company.com/another-source
```

---

## Implementation Plan

### Phase 1: Enhance Skill Creation Prompt (30 min)

**File**: [src/lib/promptBlocks.ts](../src/lib/promptBlocks.ts) lines 138-150

**Changes**:
1. Expand "## Common Questions" guidance:
   - Emphasize COMPLETE, SPECIFIC answers (include standards, versions, limitations)
   - Clarify these are for skill discovery, NOT templates
   - Add more example Q&A showing specificity

2. Add "## Edge Cases & Limitations" section requirement:
   - What is NOT covered
   - Special requirements or restrictions
   - Known limitations or exceptions
   - Examples of edge cases to include

3. Add "## Approved Sources" section (optional):
   - List URLs and document names
   - Enables citation and freshness tracking
   - Shows where facts come from

**Expected Impact**:
- New skills will have richer, more structured content
- Existing skills can be manually updated over time
- LLM will have better context for synthesis

**Code Location**:
```typescript
// src/lib/promptBlocks.ts around line 138
"INCLUDE A '## Common Questions' SECTION:",
// ... expand this section
```

---

### Phase 2: Add LLM Guidance Preamble (20 min)

**File**: [src/app/api/knowledge-chat/route.ts](../src/app/api/knowledge-chat/route.ts) around line 225

**Changes**:
Add guidance before skills explaining how to use them properly.

**Code to Add**:
```typescript
// Around line 225, before building combinedKnowledgeContext
if (knowledgeContext) {
  // Extract unique categories for summary
  const uniqueCategories = [...new Set(skills.flatMap(s => s.categories || []))];

  const skillGuidance = `
=== KNOWLEDGE BASE GUIDANCE ===

You have access to ${skills.length} verified skills covering: ${uniqueCategories.join(", ")}

**How to use skills effectively:**
- Read the FULL skill content - don't just look at "Common Questions"
- SYNTHESIZE answers from all relevant sections, don't copy-paste
- CITE specific skills: "According to the [Skill Name] skill..."
- Check "Edge Cases & Limitations" sections for exceptions
- If information isn't in skills, say "This isn't covered in my knowledge base"
- Reference "Approved Sources" when available for citation

**Do NOT:**
- Copy-paste Common Questions answers verbatim
- Infer information not present in skills
- Ignore edge cases or limitations
- Combine information from different skills without noting it

---

`.trim();

  combinedKnowledgeContext += `${skillGuidance}\n\n=== SKILLS (Primary Knowledge Sources) ===\n\n${knowledgeContext}`;
}
```

**Expected Impact**:
- LLM understands to synthesize, not template-fill
- Better awareness of edge cases
- More accurate source attribution
- Reduced hallucination

---

### Phase 3: Deprecate Unused Fields (45 min)

**Option A: Soft Deprecation (Recommended)**

Keep fields for backwards compatibility, just don't use them.

**Steps**:
1. Add comment to schema (no migration needed):
   ```prisma
   // src/prisma/schema.prisma line 379-380
   quickFacts      Json?    // DEPRECATED: Use markdown in content instead
   edgeCases       String[] // DEPRECATED: Use ## Edge Cases section in content
   ```

2. Add migration script (optional - for existing skills):
   ```typescript
   // scripts/migrate-skills-to-markdown.ts
   // Read quickFacts/edgeCases → append to content as markdown
   // Mark skills as migrated with a flag
   ```

**Option B: Hard Removal (More work)**

Remove fields entirely after migrating existing data.

**Steps**:
1. Create migration script to move data from fields → markdown in content
2. Create Prisma migration to drop columns:
   ```bash
   # After data migration
   npx prisma migrate dev --name remove_unused_skill_fields
   ```
3. Update TypeScript types

**Recommendation**: Start with Option A (soft deprecation). Remove fields later if needed.

---

### Phase 4: Update Question-Answering Prompt (30 min)

**File**: [src/lib/promptBlocks.ts](../src/lib/promptBlocks.ts) lines 104-109 (questions variant)

**Current**:
```typescript
questions: [
  "You are a questionnaire specialist designed to complete assessments and questionnaires with accurate, professional responses.",
  "Your goal is to provide fast, traceable answers based on documented knowledge while maintaining accuracy and source attribution.",
  "Skills contain authoritative, pre-verified knowledge that should always be referenced first before consulting other sources.",
].join("\n"),
```

**Enhanced**:
```typescript
questions: [
  "You are a questionnaire specialist designed to complete assessments and questionnaires with accurate, professional responses.",
  "Your goal is to provide fast, traceable answers based on documented knowledge while maintaining accuracy and source attribution.",
  "",
  "USING SKILLS CORRECTLY:",
  "- Skills contain authoritative, pre-verified knowledge - always reference them first",
  "- Read the FULL skill content - don't just look at \"Common Questions\" sections",
  "- SYNTHESIZE answers from all relevant details in the skill",
  "- CITE which skill(s) you're using: \"According to the [Skill Name] skill...\"",
  "- Check \"Edge Cases & Limitations\" sections - they contain critical exceptions",
  "- If a limitation applies, mention it: \"Note: SOC 2 covers platform only, not customer deployments\"",
  "",
  "ANSWER QUALITY:",
  "- Be SPECIFIC: Use exact numbers, names, standards (\"AES-256 encryption\", not \"encrypted\")",
  "- Be COMPLETE: If multiple options exist (regions, plans), list them all",
  "- Be ACCURATE: If something isn't in skills, say \"This isn't covered in my knowledge base\"",
  "- Cite edge cases when relevant",
].join("\n"),
```

**Expected Impact**:
- Answers cite full skill content, not just Common Questions
- Better handling of edge cases and limitations
- More specific, detailed answers
- Reduced generic/vague responses

---

### Phase 5: Add Skill Export Feature (1-2 hours, optional)

**Goal**: Export skills as Anthropic-compatible SKILL.md files

**Files to Create**:
1. `src/lib/skillExport.ts` - Export utilities
2. `src/app/api/skills/[id]/export/route.ts` - API endpoint
3. Add "Export as .md" button to skill detail page

**Export Format**:
```markdown
# [Skill Title]

## Purpose
[Content from skill.content field]

## Approved Sources
- [URLs from skill.sourceUrls]

## Categories
[skill.categories.join(", ")]

---
Last updated: [skill.updatedAt]
Owner: [skill.owner?.name]
```

**API Endpoint**:
```typescript
// src/app/api/skills/[id]/export/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const skill = await prisma.skill.findUnique({ where: { id: params.id } });
  const markdown = exportSkillAsMarkdown(skill);

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${skill.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md"`
    }
  });
}
```

**UI Update**:
```tsx
// In skill detail page
<Button onClick={() => window.open(`/api/skills/${skill.id}/export`)}>
  Download as .md
</Button>
```

**Expected Impact**:
- Skills can be used in Claude Code or other tools
- Easy backup and version control
- Shareable across teams/organizations

---

## Testing Plan

### 1. Test Skill Creation
1. Create a new skill from a URL
2. Verify it includes:
   - ## Common Questions with specific answers
   - ## Edge Cases & Limitations section
   - ## Approved Sources section
3. Check character count (should be 1500-3000+ characters)

### 2. Test Question Answering
1. Ask a question covered by a Common Question
   - Verify answer is synthesized from full content, not copy-pasted
2. Ask a question with an edge case
   - Verify edge case is mentioned
3. Ask a question not in skills
   - Verify LLM says "not covered" instead of guessing

### 3. Test Chat Interface
1. Load skills in chat
2. Verify guidance preamble appears
3. Ask questions and check:
   - Proper skill citations
   - Edge case handling
   - Source attribution

### 4. Test Bulk RFP
1. Upload questionnaire
2. Generate answers
3. Verify:
   - Answers are specific and detailed
   - Edge cases are noted when relevant
   - Skills are cited properly

---

## Migration Strategy for Existing Skills

### Option 1: Gradual (Recommended)
- New skills automatically use enhanced format
- Existing skills remain as-is
- Update old skills opportunistically when refreshed or edited
- No breaking changes

### Option 2: Bulk Update
- Create migration script to enhance existing skills:
  ```typescript
  // For each skill:
  // 1. Check if it has "## Common Questions" section
  // 2. If not, use LLM to generate it from content
  // 3. Add "## Edge Cases" section if missing
  // 4. Add "## Approved Sources" from sourceUrls field
  ```
- Run during low-traffic period
- Keep backups

### Option 3: Manual (Safest)
- Add "Enhance Skill" button to UI
- Admin reviews and approves enhancements
- Full control over quality
- Takes longer

---

## Success Metrics

### Quality Metrics
- **Skill completeness**: 90%+ of new skills have all required sections
- **Answer accuracy**: Reduced "I don't know" false negatives
- **Edge case coverage**: Limitations mentioned when relevant (track feedback)
- **Source citations**: 80%+ of answers cite specific skills

### User Feedback
- Survey users after 2 weeks: "Are answers more accurate?"
- Track answer approval rates in review workflow
- Monitor skill refresh frequency (shows trust in content)

---

## Rollback Plan

If issues arise:

1. **Phase 1-2 (Prompt changes)**: Simply revert commits to promptBlocks.ts
2. **Phase 3 (Field deprecation)**: Fields still exist, no database changes
3. **Phase 4 (Question answering)**: Revert prompt changes
4. **Phase 5 (Export)**: Delete export endpoint, no impact on core functionality

No destructive changes, easy to roll back.

---

## Timeline Estimate

| Phase | Time | Priority |
|-------|------|----------|
| Phase 1: Enhance Skill Creation Prompt | 30 min | HIGH |
| Phase 2: Add LLM Guidance Preamble | 20 min | HIGH |
| Phase 3: Deprecate Unused Fields | 45 min | MEDIUM |
| Phase 4: Update Question-Answering Prompt | 30 min | HIGH |
| Phase 5: Add Export Feature | 1-2 hours | LOW |
| Testing | 1-2 hours | HIGH |
| **Total** | **3.5-5 hours** | - |

**Recommended Day 1**: Phases 1, 2, 4 + Testing (2-3 hours)
**Recommended Day 2**: Phase 3 (deprecation) + Phase 5 (export) if desired

---

## File Checklist

Files to modify:
- [ ] [src/lib/promptBlocks.ts](../src/lib/promptBlocks.ts) - Lines 138-150 (Phase 1)
- [ ] [src/lib/promptBlocks.ts](../src/lib/promptBlocks.ts) - Lines 104-109 (Phase 4)
- [ ] [src/app/api/knowledge-chat/route.ts](../src/app/api/knowledge-chat/route.ts) - Line ~225 (Phase 2)
- [ ] [prisma/schema.prisma](../prisma/schema.prisma) - Lines 379-380 (Phase 3 - comments only)

Files to create (optional):
- [ ] `src/lib/skillExport.ts` - Export utilities (Phase 5)
- [ ] `src/app/api/skills/[id]/export/route.ts` - Export API (Phase 5)
- [ ] `scripts/migrate-skills-to-markdown.ts` - Migration script (Phase 3, optional)

---

## Example: Before and After

### Before (Current)
```
=== SKILL 1: Compliance & Certifications ===

We hold SOC 2 Type II, ISO 27001, and are GDPR compliant.
Our compliance program includes regular audits.

Certifications:
- SOC 2 Type II
- ISO 27001
- GDPR

## Common Questions
Q: What certifications do you have?
A: SOC 2, ISO 27001, GDPR.
```

### After (Enhanced)
```
=== SKILL 1: Compliance & Certifications ===

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
A: Yes, SOC 2 Type II reports are available to customers under NDA. Contact security@company.com with your request. Report covers platform and infrastructure, updated annually.

**Q: Are you HIPAA compliant?**
A: HIPAA compliance is available for Enterprise plan customers and requires signing a Business Associate Agreement (BAA). Contact sales@company.com to discuss requirements.

## Edge Cases & Limitations
- SOC 2 report covers the platform and cloud infrastructure only, not customer-deployed components or third-party integrations
- HIPAA compliance requires Enterprise plan + signed Business Associate Agreement (BAA) - contact sales team
- Compliance reports are provided under NDA and cannot be shared publicly
- Custom compliance frameworks (FedRAMP, PCI DSS Level 1) are not currently supported - contact sales for Enterprise compliance needs

## Approved Sources
- https://company.com/security/compliance
- https://company.com/docs/data-processing-addendum
- SOC 2 Type II Report (2024): Available under NDA
```

**Key Improvements**:
1. Much more detailed and specific
2. Includes concrete details (auditor, dates, process)
3. Complete answers in Common Questions (not generic)
4. Clear edge cases and limitations
5. Source attribution for verification

---

## Questions to Resolve

1. **Field removal timing**: When should we actually drop `quickFacts` and `edgeCases` columns? (Recommend: never, just ignore them)

2. **Export feature priority**: Is Anthropic-compatible export important now or later? (Recommend: Phase 5, optional)

3. **Existing skill migration**: Manual, bulk, or gradual? (Recommend: Gradual - update on refresh)

4. **Testing scope**: Full regression testing or focused on new features? (Recommend: Focused + smoke tests)

---

## Next Steps Tomorrow

**Morning (1-2 hours):**
1. Review this plan
2. Make any adjustments
3. Implement Phase 1 (Skill Creation Prompt enhancement)
4. Implement Phase 2 (LLM Guidance Preamble)

**Afternoon (1-2 hours):**
5. Implement Phase 4 (Question Answering Prompt)
6. Test with a few questions
7. Create a test skill with new format
8. Verify answers improve

**Optional (if time):**
9. Phase 3 (deprecation comments)
10. Phase 5 (export feature)

---

## Resources

- Anthropic Skill Format: https://agentskills.io/
- Current skill prompt: [src/lib/promptBlocks.ts](../src/lib/promptBlocks.ts) lines 110-151
- Current LLM integration: [src/app/api/knowledge-chat/route.ts](../src/app/api/knowledge-chat/route.ts)
- Database schema: [prisma/schema.prisma](../prisma/schema.prisma) lines 374-395

---

## Success Criteria

✅ New skills have standardized markdown structure
✅ Common Questions section includes complete, specific answers
✅ Edge Cases & Limitations section present in new skills
✅ LLM synthesizes from full content, not just Q&A
✅ Answers cite specific skills by name
✅ Edge cases mentioned when relevant
✅ No regression in answer quality
✅ Existing skills continue to work

---

Generated: 2025-12-19
Author: Claude Code
Status: Ready for Implementation
