import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * POST /api/reference-urls/link
 *
 * Creates or updates ReferenceUrl record(s) and links them to a skill.
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

    // Batch mode: multiple URLs
    if (Array.isArray(urls) && urls.length > 0) {
      const results = await Promise.all(
        urls.map((item: { url: string; title?: string }) =>
          prisma.referenceUrl.upsert({
            where: { url: item.url },
            create: {
              url: item.url,
              title: item.title || item.url,
              skillId,
              isReferenceOnly: false,
              ownerId: auth.session.user.id,
              createdBy: auth.session.user.email || undefined,
            },
            update: {
              skillId,
              isReferenceOnly: false,
              title: item.title || undefined,
            },
          })
        )
      );
      return apiSuccess({ linked: results.length, urls: results }, { status: 201 });
    }

    // Single URL mode (backwards compatible)
    if (!url) {
      return errors.validation("url or urls array is required");
    }

    const referenceUrl = await prisma.referenceUrl.upsert({
      where: { url },
      create: {
        url,
        title: title || url,
        skillId,
        isReferenceOnly: false,
        ownerId: auth.session.user.id,
        createdBy: auth.session.user.email || undefined,
      },
      update: {
        skillId,
        isReferenceOnly: false,
        title: title || undefined,
      },
    });

    return apiSuccess(referenceUrl, { status: 201 });
  } catch (error) {
    logger.error("Failed to link reference URL", error, { route: "/api/reference-urls/link" });
    return errors.internal("Failed to link reference URL");
  }
}
