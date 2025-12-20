# Prompt Builder V5 Migration Plan

## Overview
Migrate from multiple prompt builder versions to a single V5 version with git-backed storage.

## Current State

### Prompt Builder Versions to Remove
- `/src/app/admin/prompt-blocks/page.tsx` - Original prompt blocks editor
- `/src/app/admin/prompt-library-v2/page.tsx` - Library view
- `/src/app/admin/prompt-builder-v3/page.tsx` - V3 builder
- `/src/app/admin/prompt-builder-v4/page.tsx` - V4 builder

### Keep
- `/src/app/admin/prompt-builder-v5/page.tsx` → Rename to `/src/app/admin/prompts/page.tsx`

### Storage Architecture
**Current:** Code defaults in `promptBlocks.ts` → DB overrides → Git sync
**Target:** Git as source of truth → DB as cache → Code defaults as fallback only

## Migration Steps

### Phase 1: V5 Integration with API ✅ (Infrastructure exists)

The API at `/api/prompt-blocks` already:
- Loads blocks from DB (merged with code defaults)
- Saves to DB
- Commits to git (`prompts/blocks/*.md`, `prompts/modifiers/*.md`)
- Tracks sync with `PromptSyncLog`

**V5 needs to:**
1. Load blocks/modifiers from `/api/prompt-blocks` on mount
2. Call PUT `/api/prompt-blocks` on save
3. Remove local `initialBlocks` and `initialPrompts` state initialization from code

### Phase 2: Update V5 to Use API

```typescript
// Current (wrong): Initialize from code
const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

// Target: Load from API
const [blocks, setBlocks] = useState<Block[]>([]);
useEffect(() => {
  fetch('/api/prompt-blocks')
    .then(res => res.json())
    .then(data => {
      setBlocks(transformBlocks(data.data.blocks));
      // Also load modifiers if needed
    });
}, []);
```

### Phase 3: Delete Old Versions

```bash
# Remove old prompt builder directories
rm -rf src/app/admin/prompt-blocks/
rm -rf src/app/admin/prompt-library-v2/
rm -rf src/app/admin/prompt-builder-v3/
rm -rf src/app/admin/prompt-builder-v4/

# Rename V5 to final location
mv src/app/admin/prompt-builder-v5/ src/app/admin/prompts/
```

### Phase 4: Update Navigation

Update any links pointing to old routes:
- Search for `prompt-builder` in codebase
- Update admin nav/sidebar
- Update any internal links

### Phase 5: Git Repository Setup

Ensure prompts directory exists in git:
```
.trustedanswers/
├── skills/           # Already exists
└── prompts/
    ├── blocks/
    │   ├── role_mission.md
    │   ├── output_format.md
    │   ├── source_priority.md
    │   ├── quality_rules.md
    │   ├── confidence_levels.md
    │   ├── error_handling.md
    │   └── processing_guidelines.md
    └── modifiers/
        ├── mode_single.md
        ├── mode_bulk.md
        ├── mode_call.md
        ├── domain_technical.md
        ├── domain_legal.md
        └── domain_security.md
```

### Phase 6: Initial Git Commit

Run a one-time script to commit current code defaults to git:
```typescript
// scripts/seed-prompts-to-git.ts
import { defaultBlocks, defaultModifiers } from '@/lib/promptBlocks';
import { saveBlockAndCommit, saveModifierAndCommit } from '@/lib/promptGitSync';

async function seedPromptsToGit() {
  for (const block of defaultBlocks) {
    await saveBlockAndCommit(block.id, {
      id: block.id,
      name: block.name,
      description: block.description,
      tier: block.tier,
      variants: block.variants,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      updatedBy: 'system@migration',
    }, 'Initial prompt block migration', { name: 'Migration', email: 'system@migration' });
  }

  for (const modifier of defaultModifiers) {
    await saveModifierAndCommit(modifier.id, {
      id: modifier.id,
      name: modifier.name,
      type: modifier.type,
      tier: modifier.tier,
      content: modifier.content,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      updatedBy: 'system@migration',
    }, 'Initial prompt modifier migration', { name: 'Migration', email: 'system@migration' });
  }
}
```

## File Changes Summary

### Delete
- `src/app/admin/prompt-blocks/` (entire directory)
- `src/app/admin/prompt-library-v2/` (entire directory)
- `src/app/admin/prompt-builder-v3/` (entire directory)
- `src/app/admin/prompt-builder-v4/` (entire directory)

### Rename
- `src/app/admin/prompt-builder-v5/page.tsx` → `src/app/admin/prompts/page.tsx`

### Modify
- `src/app/admin/prompts/page.tsx`:
  - Add API loading on mount
  - Add API saving on save button
  - Remove hardcoded `initialBlocks`/`initialPrompts` from code

### Keep (no changes)
- `src/lib/promptBlocks.ts` - Keep as fallback/reference
- `src/lib/promptFiles.ts` - Git file utilities
- `src/lib/promptGitSync.ts` - Git commit utilities
- `src/lib/promptSyncLog.ts` - Sync logging
- `src/app/api/prompt-blocks/route.ts` - API endpoint

## Testing Checklist

- [ ] Load prompts from API on page mount
- [ ] Edit a block variant
- [ ] Save changes (verify DB update)
- [ ] Verify git commit created in `prompts/blocks/`
- [ ] Check PromptSyncLog entry created
- [ ] Verify old routes return 404
- [ ] Test prompt composition still works in chat/questions

## Rollback Plan

If issues arise:
1. Restore deleted directories from git history
2. Revert navigation changes
3. Keep V5 in place (won't break anything)
