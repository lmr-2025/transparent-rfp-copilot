import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/skill-categories/[id] - Get a single category
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const category = await prisma.skillCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to fetch skill category:", error);
    return NextResponse.json(
      { error: "Failed to fetch skill category" },
      { status: 500 }
    );
  }
}

// PUT /api/skill-categories/[id] - Update a category
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const category = await prisma.skillCategory.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        color: body.color,
        sortOrder: body.sortOrder,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update skill category:", error);
    return NextResponse.json(
      { error: "Failed to update skill category" },
      { status: 500 }
    );
  }
}

// DELETE /api/skill-categories/[id] - Delete a category
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.skillCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete skill category:", error);
    return NextResponse.json(
      { error: "Failed to delete skill category" },
      { status: 500 }
    );
  }
}
