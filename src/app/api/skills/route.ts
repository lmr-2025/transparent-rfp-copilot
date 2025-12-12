import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/skills - List all skills
export async function GET(request: NextRequest) {
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
  try {
    const body = await request.json();

    const skill = await prisma.skill.create({
      data: {
        title: body.title,
        content: body.content,
        categories: body.categories || [],
        tags: body.tags || [],
        quickFacts: body.quickFacts || [],
        edgeCases: body.edgeCases || [],
        sourceUrls: body.sourceUrls || [],
        isActive: body.isActive ?? true,
        createdBy: body.createdBy,
        owners: body.owners,
        history: body.history || [
          {
            date: new Date().toISOString(),
            action: "created",
            summary: "Skill created",
          },
        ],
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error("Failed to create skill:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}
