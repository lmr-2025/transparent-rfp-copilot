import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { defaultBlocks, defaultModifiers } from "@/lib/promptBlocks";

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
      console.error("DB query failed:", dbError);
      // Return defaults if DB fails
      return NextResponse.json({ blocks: defaultBlocks, modifiers: defaultModifiers });
    }

    // Merge with defaults (DB overrides defaults)
    const blocks = defaultBlocks.map(defaultBlock => {
      const dbBlock = dbBlocks.find(b => b.blockId === defaultBlock.id);
      if (dbBlock) {
        return {
          id: defaultBlock.id,
          name: dbBlock.name || defaultBlock.name,
          description: dbBlock.description || defaultBlock.description,
          variants: {
            default: "",
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
          id: defaultMod.id,
          name: dbMod.name || defaultMod.name,
          type: dbMod.type as "mode" | "domain",
          content: dbMod.content,
        };
      }
      return defaultMod;
    });

    return NextResponse.json({ blocks, modifiers });
  } catch (error) {
    console.error("Failed to load prompt blocks:", error);
    return NextResponse.json(
      { error: "Failed to load prompt blocks" },
      { status: 500 }
    );
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
      console.error("Invalid blocks data:", blocks);
      return NextResponse.json({ error: "Invalid blocks data" }, { status: 400 });
    }

    if (!modifiers || !Array.isArray(modifiers)) {
      console.error("Invalid modifiers data:", modifiers);
      return NextResponse.json({ error: "Invalid modifiers data" }, { status: 400 });
    }

    const userEmail = auth.session.user?.email || "unknown";

    // Upsert blocks
    for (const block of blocks) {
      await prisma.promptBlock.upsert({
        where: { blockId: block.id },
        create: {
          blockId: block.id,
          name: block.name,
          description: block.description,
          variants: block.variants,
          updatedBy: userEmail,
        },
        update: {
          name: block.name,
          description: block.description,
          variants: block.variants,
          updatedBy: userEmail,
        },
      });
    }

    // Upsert modifiers
    for (const mod of modifiers) {
      await prisma.promptModifier.upsert({
        where: { modifierId: mod.id },
        create: {
          modifierId: mod.id,
          name: mod.name,
          type: mod.type,
          content: mod.content,
          updatedBy: userEmail,
        },
        update: {
          name: mod.name,
          type: mod.type,
          content: mod.content,
          updatedBy: userEmail,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save prompt blocks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json(
      { error: `Failed to save prompt blocks: ${errorMessage}` },
      { status: 500 }
    );
  }
}
