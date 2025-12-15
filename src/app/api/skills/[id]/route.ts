import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { updateSkillSchema, validateBody } from "@/lib/validations";
import { logSkillChange, getUserFromSession, computeChanges } from "@/lib/auditLog";

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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const validation = validateBody(updateSkillSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;

    // Get existing skill
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Use client-provided history if present, otherwise add a generic update entry
    let finalHistory;
    if (data.history !== undefined) {
      // Client provided history - use it directly
      finalHistory = data.history;
    } else {
      // No history provided - add generic update entry
      const existingHistory = (existing.history as Array<{
        date: string;
        action: string;
        summary: string;
        user?: string;
      }>) || [];
      finalHistory = [
        ...existingHistory,
        {
          date: new Date().toISOString(),
          action: "updated",
          summary: "Skill updated",
          user: auth.session.user.email,
        },
      ];
    }

    // Build update data - only include fields that were provided
    // This prevents accidentally clearing fields that weren't in the update
    const updateData: Record<string, unknown> = {
      history: finalHistory,
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.categories !== undefined) updateData.categories = data.categories;
    if (data.quickFacts !== undefined) updateData.quickFacts = data.quickFacts;
    if (data.edgeCases !== undefined) updateData.edgeCases = data.edgeCases;
    if (data.sourceUrls !== undefined) updateData.sourceUrls = data.sourceUrls;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.owners !== undefined) updateData.owners = data.owners;

    const skill = await prisma.skill.update({
      where: { id },
      data: updateData,
    });

    // Determine the action type for audit log
    let auditAction: "UPDATED" | "OWNER_ADDED" | "OWNER_REMOVED" | "REFRESHED" = "UPDATED";
    if (data.owners !== undefined) {
      const existingOwners = (existing.owners as Array<{ userId?: string; name: string }>) || [];
      const newOwners = data.owners || [];
      if (newOwners.length > existingOwners.length) {
        auditAction = "OWNER_ADDED";
      } else if (newOwners.length < existingOwners.length) {
        auditAction = "OWNER_REMOVED";
      }
    }

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      skill as unknown as Record<string, unknown>,
      ["title", "content", "categories", "quickFacts", "edgeCases", "sourceUrls", "isActive", "owners"]
    );

    // Audit log
    await logSkillChange(
      auditAction,
      skill.id,
      skill.title,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    // Get skill before deleting for audit log
    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    await prisma.skill.delete({
      where: { id },
    });

    // Audit log
    await logSkillChange(
      "DELETED",
      id,
      skill.title,
      getUserFromSession(auth.session),
      undefined,
      { deletedSkill: { title: skill.title, categories: skill.categories } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete skill:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 }
    );
  }
}
