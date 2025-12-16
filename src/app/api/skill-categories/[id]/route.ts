import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

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
      return errors.notFound("Category");
    }

    return apiSuccess({ category });
  } catch (error) {
    logger.error("Failed to fetch skill category", error, { route: "/api/skill-categories/[id]" });
    return errors.internal("Failed to fetch skill category");
  }
}

// PUT /api/skill-categories/[id] - Update a category
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

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

    return apiSuccess({ category });
  } catch (error) {
    logger.error("Failed to update skill category", error, { route: "/api/skill-categories/[id]" });
    return errors.internal("Failed to update skill category");
  }
}

// DELETE /api/skill-categories/[id] - Delete a category
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    await prisma.skillCategory.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete skill category", error, { route: "/api/skill-categories/[id]" });
    return errors.internal("Failed to delete skill category");
  }
}
