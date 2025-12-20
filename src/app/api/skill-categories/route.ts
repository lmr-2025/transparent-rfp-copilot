import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SKILL_CATEGORIES } from "@/types/skill";
import { requireAuth } from "@/lib/apiAuth";
import { createCategorySchema, validateBody } from "@/lib/validations";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

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

    return apiSuccess({ categories });
  } catch (error) {
    logger.error("Failed to fetch skill categories", error, { route: "/api/skill-categories" });
    return errors.internal("Failed to fetch skill categories");
  }
}

// POST /api/skill-categories - Create a new category
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createCategorySchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    // Get current max sortOrder
    const maxOrder = await prisma.skillCategory.aggregate({
      _max: { sortOrder: true },
    });

    const category = await prisma.skillCategory.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return apiSuccess({ category }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create skill category", error, { route: "/api/skill-categories" });
    return errors.internal("Failed to create skill category");
  }
}

// PUT /api/skill-categories - Bulk update (for reordering)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

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
      return errors.badRequest("categories array required");
    }

    // Update all categories in a single transaction for atomicity
    const updated = await prisma.$transaction(async (tx) => {
      for (const [index, cat] of categories.entries()) {
        await tx.skillCategory.update({
          where: { id: cat.id },
          data: {
            name: cat.name,
            description: cat.description,
            color: cat.color,
            sortOrder: cat.sortOrder ?? index,
          },
        });
      }

      return tx.skillCategory.findMany({
        orderBy: { sortOrder: "asc" },
      });
    });

    return apiSuccess({ categories: updated });
  } catch (error) {
    logger.error("Failed to update skill categories", error, { route: "/api/skill-categories" });
    return errors.internal("Failed to update skill categories");
  }
}
