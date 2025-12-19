import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { defaultBlocks, defaultModifiers, type PromptTier } from "@/lib/promptBlocks";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { invalidatePromptCache } from "@/lib/cache";
import { updateBlockAndCommit, updateModifierAndCommit } from "@/lib/promptGitSync";
import { withBlockSyncLogging, withModifierSyncLogging } from "@/lib/promptSyncLog";
import type { PromptBlockFile, PromptModifierFile } from "@/lib/promptFiles";

type BlockInput = {
  id: string;
  name: string;
  description?: string;
  tier?: number;
  variants: Record<string, string>;
};

type ModifierInput = {
  id: string;
  name: string;
  type: "mode" | "domain";
  tier?: number;
  content: string;
};

// GET /api/prompt-blocks - Load all blocks and modifiers
export async function GET() {
  try {
    // Load blocks from DB
    let dbBlocks, dbModifiers;
    try {
      dbBlocks = await prisma.promptBlock.findMany();
      dbModifiers = await prisma.promptModifier.findMany();
    } catch (dbError) {
      logger.error("DB query failed for prompt blocks", dbError, { route: "/api/prompt-blocks" });
      // Return defaults if DB fails
      return apiSuccess({ blocks: defaultBlocks, modifiers: defaultModifiers });
    }

    // Merge with defaults (DB overrides defaults, but code defaults are the base)
    const blocks = defaultBlocks.map(defaultBlock => {
      const dbBlock = dbBlocks.find(b => b.blockId === defaultBlock.id);
      if (dbBlock) {
        return {
          ...defaultBlock,
          name: dbBlock.name || defaultBlock.name,
          description: dbBlock.description || defaultBlock.description,
          variants: {
            ...defaultBlock.variants, // Start with code defaults
            ...(dbBlock.variants as Record<string, string>), // DB overrides
          },
        };
      }
      return defaultBlock;
    });

    const modifiers = defaultModifiers.map(defaultMod => {
      const dbMod = dbModifiers.find(m => m.modifierId === defaultMod.id);
      if (dbMod) {
        return {
          id: defaultMod.id,
          name: dbMod.name || defaultMod.name,
          type: dbMod.type as "mode" | "domain",
          content: dbMod.content,
        };
      }
      return defaultMod;
    });

    return apiSuccess({ blocks, modifiers });
  } catch (error) {
    logger.error("Failed to load prompt blocks", error, { route: "/api/prompt-blocks" });
    return errors.internal("Failed to load prompt blocks");
  }
}

// PUT /api/prompt-blocks - Save all blocks and modifiers
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { blocks, modifiers } = body as {
      blocks: BlockInput[];
      modifiers: ModifierInput[];
    };

    if (!blocks || !Array.isArray(blocks)) {
      logger.error("Invalid blocks data", new Error("Validation failed"), { route: "/api/prompt-blocks" });
      return errors.badRequest("Invalid blocks data");
    }

    if (!modifiers || !Array.isArray(modifiers)) {
      logger.error("Invalid modifiers data", new Error("Validation failed"), { route: "/api/prompt-blocks" });
      return errors.badRequest("Invalid modifiers data");
    }

    const userEmail = auth.session.user?.email || "unknown";
    const userName = auth.session.user?.name || userEmail;
    const userId = auth.session.user?.id;

    // Upsert blocks
    for (const block of blocks) {
      const dbBlock = await prisma.promptBlock.upsert({
        where: { blockId: block.id },
        create: {
          blockId: block.id,
          name: block.name,
          description: block.description,
          tier: block.tier ?? 3,
          variants: block.variants,
          updatedBy: userEmail,
        },
        update: {
          name: block.name,
          description: block.description,
          tier: block.tier ?? undefined,
          variants: block.variants,
          updatedBy: userEmail,
        },
      });

      // Commit to git
      try {
        const defaultBlock = defaultBlocks.find((b) => b.id === block.id);
        const blockFile: PromptBlockFile = {
          id: block.id,
          name: block.name,
          description: block.description || "",
          tier: (block.tier as PromptTier) || defaultBlock?.tier || 3,
          variants: block.variants as Record<string, string> & { default: string },
          created: dbBlock.createdAt.toISOString(),
          updated: dbBlock.updatedAt.toISOString(),
          updatedBy: userEmail,
        };

        await withBlockSyncLogging(
          {
            entityId: block.id,
            entityUuid: dbBlock.id,
            operation: "update",
            direction: "db-to-git",
            syncedBy: userId,
          },
          async () => {
            const commitSha = await updateBlockAndCommit(
              block.id,
              blockFile,
              `Update prompt block: ${block.name}`,
              { name: userName, email: userEmail }
            );
            logger.info("Block update committed to git", { blockId: block.id, commitSha });
            return commitSha;
          }
        );
      } catch (gitError) {
        // Log git error but don't fail the request
        logger.error("Failed to commit block update to git", gitError, {
          blockId: block.id,
          name: block.name,
        });
      }
    }

    // Upsert modifiers
    for (const mod of modifiers) {
      const dbModifier = await prisma.promptModifier.upsert({
        where: { modifierId: mod.id },
        create: {
          modifierId: mod.id,
          name: mod.name,
          type: mod.type,
          tier: mod.tier ?? 3,
          content: mod.content,
          updatedBy: userEmail,
        },
        update: {
          name: mod.name,
          type: mod.type,
          tier: mod.tier ?? undefined,
          content: mod.content,
          updatedBy: userEmail,
        },
      });

      // Commit to git
      try {
        const defaultModifier = defaultModifiers.find((m) => m.id === mod.id);
        const modifierFile: PromptModifierFile = {
          id: mod.id,
          name: mod.name,
          type: mod.type,
          tier: (mod.tier as PromptTier) || defaultModifier?.tier || 3,
          content: mod.content,
          created: dbModifier.createdAt.toISOString(),
          updated: dbModifier.updatedAt.toISOString(),
          updatedBy: userEmail,
        };

        await withModifierSyncLogging(
          {
            entityId: mod.id,
            entityUuid: dbModifier.id,
            operation: "update",
            direction: "db-to-git",
            syncedBy: userId,
          },
          async () => {
            const commitSha = await updateModifierAndCommit(
              mod.id,
              modifierFile,
              `Update prompt modifier: ${mod.name}`,
              { name: userName, email: userEmail }
            );
            logger.info("Modifier update committed to git", { modifierId: mod.id, commitSha });
            return commitSha;
          }
        );
      } catch (gitError) {
        // Log git error but don't fail the request
        logger.error("Failed to commit modifier update to git", gitError, {
          modifierId: mod.id,
          name: mod.name,
        });
      }
    }

    // Invalidate the prompt cache so next request gets fresh data
    await invalidatePromptCache();

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to save prompt blocks", error, { route: "/api/prompt-blocks" });
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    return errors.internal(`Failed to save prompt blocks: ${errorMessage}`);
  }
}
