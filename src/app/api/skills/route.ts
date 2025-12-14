import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createSkillSchema, validateBody } from "@/lib/validations";
import { logSkillChange, getUserFromSession } from "@/lib/auditLog";

// GET /api/skills - List all skills (requires authentication)
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";
    const category = searchParams.get("category");

    const where: {
      isActive?: boolean;
      categories?: { has: string };
    } = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (category && category !== "all") {
      where.categories = { has: category };
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(skills);
  } catch (error) {
    console.error("Failed to fetch skills:", error);
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}

// POST /api/skills - Create a new skill
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createSkillSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;
    const skill = await prisma.skill.create({
      data: {
        title: data.title,
        content: data.content,
        categories: data.categories,
        tags: data.tags,
        quickFacts: data.quickFacts,
        edgeCases: data.edgeCases,
        sourceUrls: data.sourceUrls,
        isActive: data.isActive,
        createdBy: data.createdBy || auth.session.user.email,
        ownerId: auth.session.user.id,
        owners: data.owners,
        history: data.history || [
          {
            date: new Date().toISOString(),
            action: "created",
            summary: "Skill created",
            user: auth.session.user.email,
          },
        ],
      },
    });

    // Audit log
    await logSkillChange(
      "CREATED",
      skill.id,
      skill.title,
      getUserFromSession(auth.session),
      undefined,
      { categories: data.categories, tags: data.tags }
    );

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error("Failed to create skill:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}
