import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/reference-urls/[id] - Get a single reference URL
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const url = await prisma.referenceUrl.findUnique({
      where: { id },
    });

    if (!url) {
      return NextResponse.json(
        { error: "Reference URL not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(url);
  } catch (error) {
    console.error("Failed to fetch reference URL:", error);
    return NextResponse.json(
      { error: "Failed to fetch reference URL" },
      { status: 500 }
    );
  }
}

// PUT /api/reference-urls/[id] - Update a reference URL
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const url = await prisma.referenceUrl.update({
      where: { id },
      data: {
        url: body.url,
        title: body.title,
        description: body.description,
        categories: body.categories,
        lastUsedAt: body.lastUsedAt,
        usageCount: body.usageCount,
      },
    });

    return NextResponse.json(url);
  } catch (error) {
    console.error("Failed to update reference URL:", error);
    return NextResponse.json(
      { error: "Failed to update reference URL" },
      { status: 500 }
    );
  }
}

// DELETE /api/reference-urls/[id] - Delete a reference URL
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    await prisma.referenceUrl.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reference URL:", error);
    return NextResponse.json(
      { error: "Failed to delete reference URL" },
      { status: 500 }
    );
  }
}
