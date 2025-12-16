import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * POST /api/reference-urls/link
 *
 * Creates or updates a ReferenceUrl record and links it to a skill.
 * Uses upsert to handle cases where the URL already exists.
 *
 * Body:
 * - url: string (required) - The URL to link
 * - skillId: string (required) - The skill ID to link to
 * - title: string (optional) - Title for the reference URL
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { url, skillId, title } = body;

    if (!url || !skillId) {
      return errors.validation("url and skillId are required");
    }

    // Upsert the ReferenceUrl - create if doesn't exist, update skillId if it does
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
        // Only update title if not already set
        title: title || undefined,
      },
    });

    return apiSuccess(referenceUrl, { status: 201 });
  } catch (error) {
    logger.error("Failed to link reference URL", error, { route: "/api/reference-urls/link" });
    return errors.internal("Failed to link reference URL");
  }
}
