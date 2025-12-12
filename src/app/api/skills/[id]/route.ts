import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/skills/[id] - Get a single skill
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const skill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(skill);
  } catch (error) {
    console.error("Failed to fetch skill:", error);
    return NextResponse.json(
      { error: "Failed to fetch skill" },
      { status: 500 }
    );
  }
}

// PUT /api/skills/[id] - Update a skill
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Get existing skill to merge history
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Add history entry for the update
    const existingHistory = (existing.history as Array<{
      date: string;
      action: string;
      summary: string;
      user?: string;
    }>) || [];
    const newHistory = [
      ...existingHistory,
      {
        date: new Date().toISOString(),
        action: "updated",
        summary: body.historyNote || "Skill updated",
        user: body.updatedBy,
      },
    ];

    const skill = await prisma.skill.update({
      where: { id },
      data: {
        title: body.title,
        content: body.content,
        categories: body.categories,
        tags: body.tags,
        quickFacts: body.quickFacts,
        edgeCases: body.edgeCases,
        sourceUrls: body.sourceUrls,
        isActive: body.isActive,
        lastRefreshedAt: body.lastRefreshedAt,
        owners: body.owners,
        history: newHistory,
      },
    });

    return NextResponse.json(skill);
  } catch (error) {
    console.error("Failed to update skill:", error);
    return NextResponse.json(
      { error: "Failed to update skill" },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/[id] - Delete a skill
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.skill.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete skill:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 }
    );
  }
}
