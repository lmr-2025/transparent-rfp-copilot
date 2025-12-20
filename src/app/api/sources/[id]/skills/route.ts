import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/sources/[id]/skills
 *
 * Get all skills that use a specific source (URL or document).
 *
 * Query params:
 * - type: "url" | "document" (defaults to "url")
 *
 * Returns skills linked via SkillSource join table.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get("type") || "url";

    // Validate source type
    if (sourceType !== "url" && sourceType !== "document") {
      return errors.validation("type must be 'url' or 'document'");
    }

    // Verify source exists
    if (sourceType === "url") {
      const url = await prisma.referenceUrl.findUnique({ where: { id } });
      if (!url) {
        return errors.notFound("Source URL");
      }
    } else {
      const doc = await prisma.knowledgeDocument.findUnique({ where: { id } });
      if (!doc) {
        return errors.notFound("Source document");
      }
    }

    // Get all SkillSource links for this source
    const skillSources = await prisma.skillSource.findMany({
      where: {
        sourceId: id,
        sourceType,
      },
      include: {
        skill: {
          select: {
            id: true,
            title: true,
            categories: true,
            isActive: true,
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        addedAt: "desc",
      },
    });

    // Transform to return skills with link metadata
    const skills = skillSources.map((link) => ({
      ...link.skill,
      linkedAt: link.addedAt,
      isPrimary: link.isPrimary,
    }));

    return apiSuccess({
      sourceId: id,
      sourceType,
      skillCount: skills.length,
      skills,
    });
  } catch (error) {
    logger.error("Failed to fetch skills for source", error, { route: "/api/sources/[id]/skills" });
    return errors.internal("Failed to fetch skills for source");
  }
}
