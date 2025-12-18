import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  listPresentations,
  getPresentation,
  extractPlaceholders,
  hasGoogleSlidesAccess,
} from "@/lib/googleSlides";

/**
 * GET /api/google/slides
 * List user's Google Slides presentations or get details of one
 *
 * Query params:
 * - presentationId: Get specific presentation details
 * - placeholders: If true, extract placeholders from the presentation
 * - q: Search query for presentation name
 * - limit: Max number of results (default 20)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const presentationId = searchParams.get("presentationId");
  const extractPlaceholdersFlag = searchParams.get("placeholders") === "true";
  const query = searchParams.get("q") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const userId = auth.session.user.id;

  try {
    // Check if user has Google Slides access
    const hasAccess = await hasGoogleSlidesAccess(userId);
    if (!hasAccess) {
      return errors.forbidden(
        "Google Slides access not configured. Please sign out and sign in again to grant Slides permissions."
      );
    }

    // Get specific presentation
    if (presentationId) {
      if (extractPlaceholdersFlag) {
        const placeholders = await extractPlaceholders(userId, presentationId);
        return apiSuccess({ placeholders });
      }

      const presentation = await getPresentation(userId, presentationId);
      return apiSuccess({
        presentation: {
          presentationId: presentation.presentationId,
          title: presentation.title,
          slideCount: presentation.slides?.length || 0,
        },
      });
    }

    // List presentations
    const presentations = await listPresentations(userId, {
      maxResults: limit,
      query,
    });

    return apiSuccess({
      presentations: presentations.map((p) => ({
        id: p.id,
        name: p.name,
        modifiedTime: p.modifiedTime,
        webViewLink: p.webViewLink,
        thumbnailLink: p.thumbnailLink,
      })),
    });
  } catch (error) {
    logger.error("Failed to access Google Slides", error, {
      route: "/api/google/slides",
      userId,
    });

    if (error instanceof Error && error.message.includes("No valid Google access token")) {
      return errors.forbidden(
        "Google access token expired. Please sign out and sign in again."
      );
    }

    return errors.internal("Failed to access Google Slides");
  }
}
