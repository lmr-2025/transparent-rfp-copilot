import { prisma } from "@/lib/prisma";
import {
  PromptBlock,
  PromptModifier,
  PromptContext,
  defaultBlocks,
  defaultModifiers,
  defaultCompositions,
  buildPromptFromBlocks,
} from "@/lib/promptBlocks";
import { cacheGetOrSet, CacheKeys, CacheTTL } from "@/lib/cache";

/**
 * Options for dynamic prompt building
 */
export type PromptOptions = {
  /** Mode: "single" for individual questions, "bulk" for questionnaires */
  mode?: "single" | "bulk";
  /** Domains to include: "technical", "legal", "security" */
  domains?: Array<"technical" | "legal" | "security">;
};

// Map old keys to new contexts
const keyToContext: Record<string, PromptContext> = {
  questions: "questions",
  skill_builder: "skills",
  skills: "skills",
  chat: "chat",
  knowledge_chat: "chat",
  analysis: "analysis",
  library_analysis: "analysis",
  contract_analysis: "contracts",
  contracts: "contracts",
  skill_organize: "skill_organize",
  skill_analyze: "skill_analyze",
  skill_refresh: "skill_refresh",
  skill_analyze_rfp: "skill_analyze_rfp",
  customer_profile: "customer_profile",
  prompt_optimize: "prompt_optimize",
  instruction_builder: "instruction_builder",
};

// Type for cached DB data
type CachedPromptData = {
  dbBlocks: Array<{ blockId: string; name: string | null; description: string | null; variants: unknown }>;
  dbModifiers: Array<{ modifierId: string; name: string | null; content: string }>;
};

/**
 * Fetch raw prompt data from DB (for caching)
 */
async function fetchPromptDataFromDB(): Promise<CachedPromptData> {
  const [dbBlocks, dbModifiers] = await Promise.all([
    prisma.promptBlock.findMany(),
    prisma.promptModifier.findMany(),
  ]);
  return { dbBlocks, dbModifiers };
}

/**
 * Load blocks and modifiers from cache or DB, falling back to defaults
 * Uses Redis cache with 1 hour TTL to avoid repeated DB queries
 */
async function loadBlocksAndModifiers(): Promise<{
  blocks: PromptBlock[];
  modifiers: PromptModifier[];
}> {
  try {
    // Get cached or fetch fresh from DB
    const cached = await cacheGetOrSet<CachedPromptData>(
      CacheKeys.PROMPT_BLOCKS,
      CacheTTL.PROMPT_BLOCKS,
      fetchPromptDataFromDB
    );

    const { dbBlocks, dbModifiers } = cached;

    // Merge DB with defaults
    const blocks = defaultBlocks.map(defaultBlock => {
      const dbBlock = dbBlocks.find(b => b.blockId === defaultBlock.id);
      if (dbBlock) {
        return {
          ...defaultBlock,
          name: dbBlock.name || defaultBlock.name,
          description: dbBlock.description || defaultBlock.description,
          variants: {
            ...defaultBlock.variants,
            ...(dbBlock.variants as Record<string, string>),
          },
        };
      }
      return defaultBlock;
    });

    const modifiers = defaultModifiers.map(defaultMod => {
      const dbMod = dbModifiers.find(m => m.modifierId === defaultMod.id);
      if (dbMod) {
        return {
          ...defaultMod,
          name: dbMod.name || defaultMod.name,
          content: dbMod.content,
        };
      }
      return defaultMod;
    });

    return { blocks, modifiers };
  } catch {
    // Fall back to defaults
    return { blocks: defaultBlocks, modifiers: defaultModifiers };
  }
}

/**
 * Load a system prompt composed from blocks.
 *
 * @param key - The prompt context key (e.g., "questions", "skills", "chat")
 * @param defaultPrompt - Fallback prompt if blocks fail to load
 * @param options - Optional mode/domain filtering
 * @returns The composed prompt string
 */
export async function loadSystemPrompt(
  key: string,
  defaultPrompt: string,
  options?: PromptOptions
): Promise<string> {
  try {
    const context = keyToContext[key];
    if (!context) {
      // Unknown key, return default
      return defaultPrompt;
    }

    const composition = defaultCompositions.find(c => c.context === context);
    if (!composition) {
      return defaultPrompt;
    }

    const { blocks, modifiers } = await loadBlocksAndModifiers();

    const prompt = buildPromptFromBlocks(blocks, composition, {
      mode: options?.mode,
      domains: options?.domains,
      modifiers,
    });

    return prompt.trim() || defaultPrompt;
  } catch {
    return defaultPrompt;
  }
}
