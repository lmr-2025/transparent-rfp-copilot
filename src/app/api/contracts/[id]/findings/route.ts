import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// POST /api/contracts/[id]/findings - Create a manual finding
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Verify contract exists
    const contract = await prisma.contractReview.findUnique({
      where: { id },
    });

    if (!contract) {
      return errors.notFound("Contract review");
    }

    const {
      clauseText,
      category,
      rating,
      rationale,
      suggestedResponse,
      flaggedForReview,
      flagNote,
      flaggedBy,
    } = body;

    if (!clauseText || !category || !rating) {
      return errors.badRequest("clauseText, category, and rating are required");
    }

    // Create the finding (marked as manually added for feedback tracking)
    const finding = await prisma.contractFinding.create({
      data: {
        contractReviewId: id,
        clauseText,
        category,
        rating,
        rationale: rationale || "Manually added finding",
        suggestedResponse: suggestedResponse || null,
        flaggedForReview: flaggedForReview ?? true,
        flaggedAt: flaggedForReview ? new Date() : null,
        flaggedBy: flaggedBy || auth.session?.user?.name || auth.session?.user?.email || "User",
        flagNote: flagNote || "Manually added",
        isManuallyAdded: true, // Track that AI missed this
      },
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
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create finding", error, { route: "/api/contracts/[id]/findings" });
    return errors.internal("Failed to create finding");
  }
}
