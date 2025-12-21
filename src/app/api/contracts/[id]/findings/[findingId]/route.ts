import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ id: string; findingId: string }>;
};

// GET /api/contracts/[id]/findings/[findingId] - Get a single finding
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, findingId } = await params;

    const finding = await prisma.contractFinding.findFirst({
      where: {
        id: findingId,
        contractReviewId: id,
      },
    });

    if (!finding) {
      return errors.notFound("Finding");
    }

    return apiSuccess({
      finding: {
        ...finding,
        createdAt: finding.createdAt.toISOString(),
        updatedAt: finding.updatedAt.toISOString(),
        flaggedAt: finding.flaggedAt?.toISOString(),
        flagResolvedAt: finding.flagResolvedAt?.toISOString(),
        reviewRequestedAt: finding.reviewRequestedAt?.toISOString(),
        reviewedAt: finding.reviewedAt?.toISOString(),
        assignedToSecurityAt: finding.assignedToSecurityAt?.toISOString(),
        securityReviewedAt: finding.securityReviewedAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch finding", error, { route: "/api/contracts/[id]/findings/[findingId]" });
    return errors.internal("Failed to fetch finding");
  }
}

// PATCH /api/contracts/[id]/findings/[findingId] - Update a finding (flagging, review, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id, findingId } = await params;
    const body = await request.json();
    const userName = auth.session?.user?.name || auth.session?.user?.email || "Unknown";

    // Check finding exists and belongs to this contract
    const existing = await prisma.contractFinding.findFirst({
      where: {
        id: findingId,
        contractReviewId: id,
      },
    });

    if (!existing) {
      return errors.notFound("Finding");
    }

    const updateData: Record<string, unknown> = {};

    // Flagging workflow
    if (body.flaggedForReview !== undefined) {
      updateData.flaggedForReview = body.flaggedForReview;
      if (body.flaggedForReview) {
        updateData.flaggedAt = new Date();
        updateData.flaggedBy = userName;
        updateData.flagNote = body.flagNote || null;
      }
    }

    if (body.flagNote !== undefined) {
      updateData.flagNote = body.flagNote;
    }

    // Flag resolution
    if (body.flagResolved !== undefined) {
      updateData.flagResolved = body.flagResolved;
      if (body.flagResolved) {
        updateData.flagResolvedAt = new Date();
        updateData.flagResolvedBy = userName;
        updateData.flagResolutionNote = body.flagResolutionNote || null;
        // Optionally clear the flag when resolved
        if (body.clearFlagOnResolve) {
          updateData.flaggedForReview = false;
        }
      }
    }

    if (body.flagResolutionNote !== undefined) {
      updateData.flagResolutionNote = body.flagResolutionNote;
    }

    // Review workflow
    if (body.reviewStatus !== undefined) {
      updateData.reviewStatus = body.reviewStatus;

      if (body.reviewStatus === "REQUESTED") {
        updateData.reviewRequestedAt = new Date();
        updateData.reviewRequestedBy = userName;
        updateData.reviewNote = body.reviewNote || null;
      } else if (body.reviewStatus === "APPROVED" || body.reviewStatus === "CORRECTED") {
        updateData.reviewedAt = new Date();
        updateData.reviewedBy = userName;
      }
    }

    if (body.reviewNote !== undefined) {
      updateData.reviewNote = body.reviewNote;
    }

    // User edited response
    if (body.userEditedResponse !== undefined) {
      updateData.userEditedResponse = body.userEditedResponse;
    }

    // Update suggested response (if user edits) - capture original for feedback tracking
    if (body.suggestedResponse !== undefined && body.suggestedResponse !== existing.suggestedResponse) {
      // Only capture original if not already captured (first edit)
      if (!existing.originalSuggestedResponse && existing.suggestedResponse && !existing.isManuallyAdded) {
        updateData.originalSuggestedResponse = existing.suggestedResponse;
      }
      updateData.suggestedResponse = body.suggestedResponse;
    }

    // Track rating changes for feedback
    if (body.rating !== undefined && body.rating !== existing.rating) {
      if (!existing.originalRating && !existing.isManuallyAdded) {
        updateData.originalRating = existing.rating;
      }
      updateData.rating = body.rating;
    }

    // Track rationale changes for feedback
    if (body.rationale !== undefined && body.rationale !== existing.rationale) {
      if (!existing.originalRationale && !existing.isManuallyAdded) {
        updateData.originalRationale = existing.rationale;
      }
      updateData.rationale = body.rationale;
    }

    // Security review delegation
    if (body.assignedToSecurity !== undefined) {
      updateData.assignedToSecurity = body.assignedToSecurity;
      if (body.assignedToSecurity) {
        updateData.assignedToSecurityAt = new Date();
        updateData.assignedToSecurityBy = userName;
      } else {
        // Clear security assignment
        updateData.assignedToSecurityAt = null;
        updateData.assignedToSecurityBy = null;
        updateData.securityReviewNote = null;
        updateData.securityReviewedAt = null;
        updateData.securityReviewedBy = null;
      }
    }

    // Security review completion
    if (body.securityReviewNote !== undefined) {
      updateData.securityReviewNote = body.securityReviewNote;
    }
    if (body.securityReviewed) {
      updateData.securityReviewedAt = new Date();
      updateData.securityReviewedBy = userName;
      updateData.securityReviewNote = body.securityReviewNote || null;
    }

    const finding = await prisma.contractFinding.update({
      where: { id: findingId },
      data: updateData,
    });

    return apiSuccess({
      finding: {
        ...finding,
        createdAt: finding.createdAt.toISOString(),
        updatedAt: finding.updatedAt.toISOString(),
        flaggedAt: finding.flaggedAt?.toISOString(),
        flagResolvedAt: finding.flagResolvedAt?.toISOString(),
        reviewRequestedAt: finding.reviewRequestedAt?.toISOString(),
        reviewedAt: finding.reviewedAt?.toISOString(),
        assignedToSecurityAt: finding.assignedToSecurityAt?.toISOString(),
        securityReviewedAt: finding.securityReviewedAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Failed to update finding", error, { route: "/api/contracts/[id]/findings/[findingId]" });
    return errors.internal("Failed to update finding");
  }
}
