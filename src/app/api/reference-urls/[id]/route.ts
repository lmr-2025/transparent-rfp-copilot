import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logReferenceUrlChange, getUserFromSession, computeChanges } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/reference-urls/[id] - Get a single reference URL with skill count
// Categories are derived dynamically from linked skills via SkillSource
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const url = await prisma.referenceUrl.findUnique({
      where: { id },
    });

    if (!url) {
      return errors.notFound("Reference URL");
    }

    // Get linked skills with their categories via SkillSource
    const skillSources = await prisma.skillSource.findMany({
      where: {
        sourceId: id,
        sourceType: "url",
      },
      include: {
        skill: {
          select: { id: true, categories: true },
        },
      },
    });

    // Derive categories from linked skills (union of all)
    const derivedCategories = new Set<string>();
    for (const ss of skillSources) {
      for (const cat of ss.skill.categories) {
        derivedCategories.add(cat);
      }
    }

    return apiSuccess({
      url: {
        ...url,
        skillCount: skillSources.length,
        // Use derived categories if linked to skills, otherwise fall back to stored
        categories: derivedCategories.size > 0 ? Array.from(derivedCategories) : url.categories,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch reference URL", error, { route: "/api/reference-urls/[id]" });
    return errors.internal("Failed to fetch reference URL");
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

    // Get existing URL for audit log
    const existing = await prisma.referenceUrl.findUnique({ where: { id } });
    if (!existing) {
      return errors.notFound("Reference URL");
    }

    const url = await prisma.referenceUrl.update({
      where: { id },
      data: {
        url: body.url,
        title: body.title,
        description: body.description,
        categories: body.categories,
        lastUsedAt: body.lastUsedAt,
        usageCount: body.usageCount,
        ...(body.isReferenceOnly !== undefined && { isReferenceOnly: body.isReferenceOnly }),
      },
    });

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      url as unknown as Record<string, unknown>,
      ["url", "title", "description", "categories", "isReferenceOnly"]
    );

    // Audit log
    await logReferenceUrlChange(
      "UPDATED",
      url.id,
      url.title || url.url,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

    return apiSuccess({ url });
  } catch (error) {
    logger.error("Failed to update reference URL", error, { route: "/api/reference-urls/[id]" });
    return errors.internal("Failed to update reference URL");
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

    // Get URL before deleting for audit log
    const url = await prisma.referenceUrl.findUnique({ where: { id } });
    if (!url) {
      return errors.notFound("Reference URL");
    }

    await prisma.referenceUrl.delete({
      where: { id },
    });

    // Audit log
    await logReferenceUrlChange(
      "DELETED",
      id,
      url.title || url.url,
      getUserFromSession(auth.session),
      undefined,
      { deletedUrl: { title: url.title, url: url.url } }
    );

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete reference URL", error, { route: "/api/reference-urls/[id]" });
    return errors.internal("Failed to delete reference URL");
  }
}
