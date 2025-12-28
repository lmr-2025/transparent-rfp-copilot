# Three-Tier Skill Loading System - Implementation Plan

## Overview

Implement a three-tier skill loading system to reduce context window usage while maintaining flexibility. Skills will be loaded progressively based on their tier assignment and relevance to the question.

## Goals

1. **Reduce baseline context usage** - Only load "core" skills by default
2. **Maintain answer quality** - Search additional skills when needed
3. **Scale gracefully** - Library can grow without impacting common queries
4. **Keep it simple** - Manual tier curation, leverage existing category system

## Three-Tier Model

| Tier | Name | When Loaded | Selection Scope |
|------|------|-------------|-----------------|
| **Tier 1** | Core | Always included in initial prompt | Selected categories only |
| **Tier 2** | Extended | Retrieved if Tier 1 can't answer | Selected categories only |
| **Tier 3** | Library | Retrieved as last resort | All skills (ignore category filters) |

### Flow Diagram

```
User asks question + selects categories
              ↓
Load Tier 1 skills (matching selected categories)
              ↓
       LLM attempts answer
              ↓
    Can answer confidently?
         ↓ YES → Return answer (done)
         ↓ NO
Search Tier 2 skills (matching selected categories)
              ↓
    Found relevant skills?
         ↓ YES → Re-prompt with Tier 1 + Tier 2 → Return answer
         ↓ NO
Search Tier 3 skills (entire library, all categories)
              ↓
    Found relevant skills?
         ↓ YES → Re-prompt with Tier 1 + Tier 2 + Tier 3 → Return answer
         ↓ NO
    Return best-effort answer or "insufficient knowledge" response
```

## Technical Design

### 1. Database Schema Changes

**Add `tier` field to Skill model:**

```prisma
model Skill {
  // ... existing fields
  tier String @default("library") // "core" | "extended" | "library"

  @@index([tier, isActive])
  @@index([tier, categories])
}
```

**Migration strategy:**
- Default all existing skills to `"library"` tier
- Users manually promote important skills to `"core"` or `"extended"`
- Add index for efficient tier-based queries

### 2. Type Updates

**Update `/src/types/skill.ts`:**

```typescript
export type SkillTier = "core" | "extended" | "library";

export type Skill = {
  // ... existing fields
  tier: SkillTier;
}
```

### 3. API Changes

**Update `/src/app/api/skills/route.ts` (GET endpoint):**

Add `tier` query parameter support:

```typescript
const tier = searchParams.get("tier"); // "core" | "extended" | "library"

if (tier) {
  where.tier = tier;
}
```

**New endpoint: `/src/app/api/skills/search/route.ts` (POST):**

Purpose: Search for relevant skills across specified tiers

```typescript
POST /api/skills/search
Body: {
  query: string;              // The question text
  categories?: string[];      // Restrict to these categories (empty = all)
  tiers: SkillTier[];        // Which tiers to search ["extended", "library"]
  limit?: number;             // Max skills to return (default 5)
  excludeIds?: string[];      // Don't return these IDs (already loaded)
}

Response: {
  skills: Skill[];
  searchMethod: "keyword" | "embedding"; // For future
}
```

**Search implementation (Phase 1 - Keyword-based):**

Use existing keyword scorer from `/src/lib/questionHelpers.ts`:

```typescript
import { selectRelevantSkills } from '@/lib/questionHelpers';

// Build where clause for tier + category filtering
const where = {
  isActive: true,
  tier: { in: tiers },
  ...(categories?.length ? { categories: { hasSome: categories } } : {}),
  ...(excludeIds?.length ? { id: { notIn: excludeIds } } : {}),
};

const candidateSkills = await prisma.skill.findMany({ where });

// Score and rank using keyword matching
const rankedSkills = selectRelevantSkills(query, candidateSkills);

return rankedSkills.slice(0, limit);
```

**Search implementation (Phase 2 - Future embeddings):**

Design interface to be pluggable:

```typescript
interface SkillSearchStrategy {
  search(query: string, candidates: Skill[], limit: number): Promise<Skill[]>;
}

class KeywordSearchStrategy implements SkillSearchStrategy {
  async search(query: string, candidates: Skill[], limit: number) {
    return selectRelevantSkills(query, candidates).slice(0, limit);
  }
}

class EmbeddingSearchStrategy implements SkillSearchStrategy {
  async search(query: string, candidates: Skill[], limit: number) {
    // Future: Use embeddings for semantic search
    // 1. Embed the query
    // 2. Compare with pre-computed skill embeddings
    // 3. Return top K by cosine similarity
  }
}
```

### 4. LLM Integration Changes

**Update `/src/lib/llm.ts`:**

Add new function for progressive skill loading:

```typescript
export type ProgressiveAnswerOptions = {
  question: string;
  promptText?: string;
  tier1Skills: Skill[];          // Core skills (pre-loaded)
  selectedCategories?: string[]; // For Tier 2 search scope
  enableTier2: boolean;          // Search extended skills?
  enableTier3: boolean;          // Search library skills?
  modelSpeed?: ModelSpeed;
  tracingOptions?: TracingOptions;
};

export async function answerQuestionProgressive(
  options: ProgressiveAnswerOptions
): Promise<AnswerResult & { tier: 1 | 2 | 3 }> {

  // Try with Tier 1 skills first
  const tier1Result = await answerQuestionWithPrompt(
    options.question,
    options.promptText,
    options.tier1Skills,
    undefined, // no fallback yet
    options.modelSpeed,
    options.tracingOptions
  );

  // Check if answer is confident (heuristic: length > 100 chars, no "I don't know" phrases)
  if (isConfidentAnswer(tier1Result.answer)) {
    return { ...tier1Result, tier: 1 };
  }

  // Try Tier 2: Search extended skills in selected categories
  if (options.enableTier2) {
    const tier2Skills = await searchSkills({
      query: options.question,
      categories: options.selectedCategories,
      tiers: ["extended"],
      limit: 5,
      excludeIds: options.tier1Skills.map(s => s.id!),
    });

    if (tier2Skills.length > 0) {
      const tier2Result = await answerQuestionWithPrompt(
        options.question,
        options.promptText,
        [...options.tier1Skills, ...tier2Skills],
        undefined,
        options.modelSpeed,
        options.tracingOptions
      );

      if (isConfidentAnswer(tier2Result.answer)) {
        return { ...tier2Result, tier: 2 };
      }
    }
  }

  // Try Tier 3: Search entire library (all categories)
  if (options.enableTier3) {
    const tier3Skills = await searchSkills({
      query: options.question,
      categories: [], // search ALL categories
      tiers: ["library"],
      limit: 5,
      excludeIds: [
        ...options.tier1Skills.map(s => s.id!),
        ...(tier2Skills?.map(s => s.id!) || [])
      ],
    });

    if (tier3Skills.length > 0) {
      const allSkills = [
        ...options.tier1Skills,
        ...(tier2Skills || []),
        ...tier3Skills
      ];

      const tier3Result = await answerQuestionWithPrompt(
        options.question,
        options.promptText,
        allSkills,
        undefined,
        options.modelSpeed,
        options.tracingOptions
      );

      return { ...tier3Result, tier: 3 };
    }
  }

  // No additional skills found, return Tier 1 result
  return { ...tier1Result, tier: 1 };
}

// Helper to detect confident answers
function isConfidentAnswer(answer: string): boolean {
  const lowConfidencePhrases = [
    "i don't know",
    "i'm not sure",
    "insufficient information",
    "i don't have",
    "cannot answer",
    "unable to determine"
  ];

  const normalized = answer.toLowerCase();
  const hasLowConfidence = lowConfidencePhrases.some(phrase =>
    normalized.includes(phrase)
  );

  return !hasLowConfidence && answer.length > 100;
}

// Helper to call search API
async function searchSkills(params: {
  query: string;
  categories?: string[];
  tiers: SkillTier[];
  limit: number;
  excludeIds: string[];
}): Promise<Skill[]> {
  const response = await fetch('/api/skills/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.skills || [];
}
```

### 5. Frontend Changes

**Update `/src/app/chat-v2/page.tsx`:**

Add progressive loading support:

```typescript
// When sending a message, load only Tier 1 skills
const tier1Skills = skills.filter(s =>
  selectedSkillIds.includes(s.id) && s.tier === "core"
);

// Pass configuration for progressive loading
const response = await sendMessage({
  // ... existing params
  skills: tier1Skills,
  enableProgressiveLoading: true, // Enable Tier 2/3 search
  selectedCategories: getSelectedCategories(), // For Tier 2 scope
});

// Response includes which tier was used
if (response.tier === 2) {
  // Show toast: "Retrieved additional extended skills to answer"
} else if (response.tier === 3) {
  // Show toast: "Searched entire library to answer"
}
```

**Update `/src/stores/selection-store.ts`:**

Add tier-aware selection methods:

```typescript
// Get selected skills by tier
getSelectedSkillsByTier(tier: SkillTier): string[] {
  return this.skillIds
    .filter(id => this.skills.get(id))
    .filter(id => {
      const skill = this.skills.get(id)!;
      return skill.tier === tier && this.selections.get(id) === true;
    });
}
```

### 6. UI Changes

**Update skill management UI (`/src/app/knowledge/page.tsx`):**

Add tier column/badge to skill list:

```typescript
<Badge variant={getTierVariant(skill.tier)}>
  {skill.tier === "core" ? "Core" : skill.tier === "extended" ? "Extended" : "Library"}
</Badge>
```

Add tier filter dropdown:

```typescript
<Select onValueChange={setSelectedTier}>
  <SelectTrigger>Tier: {selectedTier || "All"}</SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Tiers</SelectItem>
    <SelectItem value="core">Core</SelectItem>
    <SelectItem value="extended">Extended</SelectItem>
    <SelectItem value="library">Library</SelectItem>
  </SelectContent>
</Select>
```

**Update skill edit/create form:**

Add tier selection:

```typescript
<Label>Tier</Label>
<Select value={tier} onValueChange={setTier}>
  <SelectItem value="core">
    Core - Always loaded for this category
  </SelectItem>
  <SelectItem value="extended">
    Extended - Searched when core skills insufficient
  </SelectItem>
  <SelectItem value="library">
    Library - Searched as last resort (all categories)
  </SelectItem>
</Select>
```

### 7. Git Sync Updates

**Update skill markdown frontmatter format:**

```yaml
---
id: uuid
title: Skill Title
categories: [Security & Compliance]
tier: core
created: 2025-01-15T10:00:00Z
updated: 2025-01-15T10:00:00Z
active: true
---
# Skill content here
```

**Update `/src/lib/skillFiles.ts` and `/src/lib/skillGitSync.ts`:**

Parse and write `tier` field in frontmatter.

## Implementation Steps

### Phase 1: Foundation (Database + Types)

1. **Create migration** to add `tier` column to Skill table
2. **Update Prisma schema** with tier field and indexes
3. **Run migration** on dev database
4. **Update TypeScript types** in `/src/types/skill.ts`
5. **Update normalization functions** to handle tier field

### Phase 2: API Layer

1. **Update GET `/api/skills`** to support `tier` query param
2. **Create POST `/api/skills/search`** endpoint with keyword-based search
3. **Update skill creation/update APIs** to accept tier field
4. **Update git sync** to read/write tier in frontmatter

### Phase 3: LLM Integration

1. **Add `answerQuestionProgressive()`** function to `llm.ts`
2. **Add confidence detection** heuristic
3. **Add tracing support** for tier progression (which tier answered)
4. **Test with sample questions** to validate tier progression

### Phase 4: Frontend UI

1. **Update knowledge library page**:
   - Add tier badge to skill cards
   - Add tier filter dropdown
   - Add tier field to skill form
2. **Update chat-v2 page**:
   - Filter Tier 1 skills on message send
   - Show tier progression in UI (toast/badge)
3. **Update selection store**:
   - Add `getSelectedSkillsByTier()` method

### Phase 5: Migration & Rollout

1. **Backfill existing skills**: Default all to "library" tier
2. **Document tier system** in README or admin docs
3. **Curate core skills**: Manually promote 10-15 essential skills to "core"
4. **Monitor token usage**: Compare before/after context window size
5. **Gather feedback**: Do Tier 2/3 searches trigger appropriately?

## Success Metrics

- **Context window reduction**: Baseline context should be 40-60% smaller (only core skills loaded)
- **Answer quality maintained**: <5% increase in "don't know" responses
- **Search triggered appropriately**: Tier 2/3 searches happen 10-20% of the time
- **Latency acceptable**: Progressive loading adds <3s when triggered

## Future Enhancements

### Phase 6: Embeddings (Future)

1. **Add embedding column** to Skill table (vector type)
2. **Pre-compute embeddings** for all skill content (Anthropic embeddings API)
3. **Implement `EmbeddingSearchStrategy`** class
4. **Add embedding refresh** on skill update
5. **Switch search endpoint** to use embeddings (drop-in replacement)

### Phase 7: Auto-Tiering (Future)

Use analytics to auto-suggest tier assignments:

- Skills used in >50% of chats → suggest "core"
- Skills with high feedback scores → suggest "extended"
- Rarely accessed skills → suggest "library"

### Phase 8: Learning from Feedback (Future)

Use answer feedback to improve tier 2/3 search:

- Track which skills were in context when answer was rated highly
- Boost relevance score for skills that led to good answers
- Train a custom ranking model

## Rollback Plan

If tier system causes issues:

1. **Database rollback**: Tier defaults to "library", system treats all as Tier 1
2. **Feature flag**: Add `ENABLE_TIERED_SKILLS=false` env var to disable progressive loading
3. **Fallback mode**: If search fails, revert to loading all selected skills (existing behavior)

## Open Questions

1. **Should Tier 1 loading be opt-out?** (Always progressive vs. user toggle)
   - Recommendation: Always progressive, but allow "Load All" button for power users

2. **What's the threshold for "confident answer"?**
   - Start with heuristic (length + negative phrase detection)
   - Later: Add explicit confidence score from LLM

3. **Should tier be category-specific?** (e.g., "core for Security, extended for Sales")
   - Recommendation: No, keep it simple. Tier is global per skill.

## Files to Modify

### New Files
- `/src/app/api/skills/search/route.ts` - Skill search endpoint

### Modified Files
- `/prisma/schema.prisma` - Add tier field and indexes
- `/src/types/skill.ts` - Add SkillTier type
- `/src/app/api/skills/route.ts` - Add tier filtering
- `/src/lib/llm.ts` - Add answerQuestionProgressive()
- `/src/lib/questionHelpers.ts` - Potentially refactor keyword scorer
- `/src/lib/skillFiles.ts` - Parse tier from frontmatter
- `/src/lib/skillGitSync.ts` - Write tier to frontmatter
- `/src/app/knowledge/page.tsx` - Add tier UI
- `/src/app/knowledge/add/page.tsx` - Add tier field to form
- `/src/app/chat-v2/page.tsx` - Filter by tier, show progression
- `/src/stores/selection-store.ts` - Add tier-aware methods
- `/src/components/ui/badge.tsx` - Maybe add tier variant styles

## Estimated Effort

- **Phase 1-2 (Backend)**: 1-2 days
- **Phase 3 (LLM integration)**: 1 day
- **Phase 4 (Frontend UI)**: 1-2 days
- **Phase 5 (Rollout & testing)**: 1 day

**Total**: ~4-6 days of development + testing

## Notes

- Keep backward compatibility: If `tier` is missing, treat as "library"
- Don't break existing skill selection flow - progressive loading is additive
- Categories remain primary filter, tier is secondary optimization
- Design search interface to be pluggable for future embeddings
