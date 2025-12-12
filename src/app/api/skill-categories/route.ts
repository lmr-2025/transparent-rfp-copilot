import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SKILL_CATEGORIES } from "@/types/skill";

// GET /api/skill-categories - List all categories
export async function GET() {
  try {
    let categories = await prisma.skillCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // If no categories exist, seed with defaults
    if (categories.length === 0) {
      const now = new Date();
      await prisma.skillCategory.createMany({
        data: DEFAULT_SKILL_CATEGORIES.map((name, index) => ({
          name,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
      });
      categories = await prisma.skillCategory.findMany({
        orderBy: { sortOrder: "asc" },
      });
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch skill categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch skill categories" },
      { status: 500 }
    );
  }
}

// POST /api/skill-categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get current max sortOrder
    const maxOrder = await prisma.skillCategory.aggregate({
      _max: { sortOrder: true },
    });

    const category = await prisma.skillCategory.create({
      data: {
        name: body.name,
        description: body.description,
        color: body.color,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create skill category:", error);
    return NextResponse.json(
      { error: "Failed to create skill category" },
      { status: 500 }
    );
  }
}

// PUT /api/skill-categories - Bulk update (for reordering)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const categories = body.categories as Array<{
      id: string;
      name?: string;
      description?: string;
      color?: string;
      sortOrder?: number;
    }>;

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: "categories array required" },
        { status: 400 }
      );
    }

    // Update each category
    await Promise.all(
      categories.map((cat, index) =>
        prisma.skillCategory.update({
          where: { id: cat.id },
          data: {
            name: cat.name,
            description: cat.description,
            color: cat.color,
            sortOrder: cat.sortOrder ?? index,
          },
        })
      )
    );

    const updated = await prisma.skillCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update skill categories:", error);
    return NextResponse.json(
      { error: "Failed to update skill categories" },
      { status: 500 }
    );
  }
}
