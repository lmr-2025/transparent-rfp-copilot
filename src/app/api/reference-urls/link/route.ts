import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * POST /api/reference-urls/link
 *
 * Creates or updates ReferenceUrl record(s) and links them to a skill via SkillSource.
 * Supports both single URL and batch operations.
 *
 * Single URL Body:
 * - url: string (required) - The URL to link
 * - skillId: string (required) - The skill ID to link to
 * - title: string (optional) - Title for the reference URL
 *
 * Batch Body:
 * - urls: Array<{ url: string, title?: string }> (required) - URLs to link
 * - skillId: string (required) - The skill ID to link to
 *
 * Uses SkillSource join table for many-to-many skill-source relationships.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { url, urls, skillId, title } = body;

    if (!skillId) {
      return errors.validation("skillId is required");
    }

    // Verify skill exists
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return errors.notFound("Skill");
    }

    // Batch mode: multiple URLs
    if (Array.isArray(urls) && urls.length > 0) {
      const results = await prisma.$transaction(async (tx) => {
        const linkedUrls = [];

        for (const item of urls as Array<{ url: string; title?: string }>) {
          // Upsert the ReferenceUrl
          const refUrl = await tx.referenceUrl.upsert({
            where: { url: item.url },
            create: {
              url: item.url,
              title: item.title || item.url,
              ownerId: auth.session.user.id,
              createdBy: auth.session.user.email || undefined,
            },
            update: {
              title: item.title || undefined,
            },
          });

          // Create SkillSource link (upsert to avoid duplicates)
          await tx.skillSource.upsert({
            where: {
              skillId_sourceId_sourceType: {
                skillId,
                sourceId: refUrl.id,
                sourceType: "url",
              },
            },
            create: {
              skillId,
              sourceId: refUrl.id,
              sourceType: "url",
              addedAt: new Date(),
              isPrimary: false,
            },
            update: {}, // No-op if exists
          });

          linkedUrls.push(refUrl);
        }

        return linkedUrls;
      });

      return apiSuccess({ linked: results.length, urls: results }, { status: 201 });
    }

    // Single URL mode (backwards compatible)
    if (!url) {
      return errors.validation("url or urls array is required");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Upsert the ReferenceUrl
      const refUrl = await tx.referenceUrl.upsert({
        where: { url },
        create: {
          url,
          title: title || url,
          ownerId: auth.session.user.id,
          createdBy: auth.session.user.email || undefined,
        },
        update: {
          title: title || undefined,
        },
      });

      // Create SkillSource link (upsert to avoid duplicates)
      await tx.skillSource.upsert({
        where: {
          skillId_sourceId_sourceType: {
            skillId,
            sourceId: refUrl.id,
            sourceType: "url",
          },
        },
        create: {
          skillId,
          sourceId: refUrl.id,
          sourceType: "url",
          addedAt: new Date(),
          isPrimary: false,
        },
        update: {},
      });

      return refUrl;
    });

    return apiSuccess(result, { status: 201 });
  } catch (error) {
    logger.error("Failed to link reference URL", error, { route: "/api/reference-urls/link" });
    return errors.internal("Failed to link reference URL");
  }
}
