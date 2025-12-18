import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { fillPresentation, hasGoogleSlidesAccess, PlaceholderReplacement } from "@/lib/googleSlides";

export const maxDuration = 60;

type FillRequest = {
  presentationId: string;
  replacements: PlaceholderReplacement[];
  copyFirst?: boolean;
  copyTitle?: string;
};

/**
 * POST /api/google/slides/fill
 * Fill placeholders in a Google Slides presentation
 *
 * Body:
 * - presentationId: The ID of the presentation to fill
 * - replacements: Array of { placeholder, value } pairs
 * - copyFirst: If true, create a copy before filling (default: true)
 * - copyTitle: Title for the copied presentation
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Rate limit
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "standard");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const body = (await request.json()) as FillRequest;
    const { presentationId, replacements, copyFirst = true, copyTitle } = body;

    if (!presentationId) {
      return errors.badRequest("presentationId is required");
    }

    if (!replacements || !Array.isArray(replacements) || replacements.length === 0) {
      return errors.badRequest("replacements array is required");
    }

    // Validate replacements
    for (const r of replacements) {
      if (!r.placeholder || r.value === undefined) {
        return errors.badRequest("Each replacement must have placeholder and value");
      }
    }

    // Check if user has Google Slides access
    const userId = auth.session.user.id;
    const hasAccess = await hasGoogleSlidesAccess(userId);
    if (!hasAccess) {
      return errors.forbidden(
        "Google Slides access not configured. Please sign out and sign in again to grant Slides permissions."
      );
    }

    // Fill the presentation
    const result = await fillPresentation(userId, presentationId, replacements, {
      copyFirst,
      copyTitle,
    });

    logger.info("Filled Google Slides presentation", {
      userId,
      sourcePresentationId: presentationId,
      targetPresentationId: result.presentationId,
      replacementCount: replacements.length,
      copied: copyFirst,
    });

    return apiSuccess({
      presentationId: result.presentationId,
      webViewLink: result.webViewLink,
      replacementCount: replacements.length,
      copied: copyFirst,
    });
  } catch (error) {
    logger.error("Failed to fill Google Slides", error, {
      route: "/api/google/slides/fill",
      userId: auth.session.user.id,
    });

    if (error instanceof Error) {
      if (error.message.includes("No valid Google access token")) {
        return errors.forbidden(
          "Google access token expired. Please sign out and sign in again."
        );
      }
      if (error.message.includes("404")) {
        return errors.notFound("Presentation not found or you don't have access");
      }
    }

    return errors.internal("Failed to fill presentation");
  }
}
