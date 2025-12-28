import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Type for feedback export
type FindingFeedback = {
  id: string;
  category: string;
  clauseText: string;
  feedbackType: "ai_missed" | "response_edited" | "rating_changed" | "rationale_changed";
  original?: string;
  corrected?: string;
  context?: string;
};

// GET /api/contracts/[id]/feedback - Export review feedback for prompt improvement
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const contract = await prisma.contractReview.findUnique({
      where: { id },
      include: {
        findings: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!contract) {
      return errors.notFound("Contract review");
    }

    const feedback: FindingFeedback[] = [];

    for (const finding of contract.findings) {
      // 1. AI missed this - human added manually
      if (finding.isManuallyAdded) {
        feedback.push({
          id: finding.id,
          category: finding.category,
          clauseText: finding.clauseText.substring(0, 200) + (finding.clauseText.length > 200 ? "..." : ""),
          feedbackType: "ai_missed",
          corrected: `Category: ${finding.category}, Rating: ${finding.rating}`,
          context: finding.rationale,
        });
      }

      // 2. User edited the suggested response
      if (finding.originalSuggestedResponse && finding.suggestedResponse !== finding.originalSuggestedResponse) {
        feedback.push({
          id: finding.id,
          category: finding.category,
          clauseText: finding.clauseText.substring(0, 200) + (finding.clauseText.length > 200 ? "..." : ""),
          feedbackType: "response_edited",
          original: finding.originalSuggestedResponse,
          corrected: finding.suggestedResponse || undefined,
        });
      }

      // 3. User changed the rating
      if (finding.originalRating && finding.rating !== finding.originalRating) {
        feedback.push({
          id: finding.id,
          category: finding.category,
          clauseText: finding.clauseText.substring(0, 200) + (finding.clauseText.length > 200 ? "..." : ""),
          feedbackType: "rating_changed",
          original: finding.originalRating,
          corrected: finding.rating,
        });
      }

      // 4. User changed the rationale
      if (finding.originalRationale && finding.rationale !== finding.originalRationale) {
        feedback.push({
          id: finding.id,
          category: finding.category,
          clauseText: finding.clauseText.substring(0, 200) + (finding.clauseText.length > 200 ? "..." : ""),
          feedbackType: "rationale_changed",
          original: finding.originalRationale,
          corrected: finding.rationale,
        });
      }
    }

    // Calculate summary stats
    const stats = {
      totalFindings: contract.findings.length,
      aiGenerated: contract.findings.filter(f => !f.isManuallyAdded).length,
      manuallyAdded: contract.findings.filter(f => f.isManuallyAdded).length,
      responsesEdited: contract.findings.filter(f => f.originalSuggestedResponse).length,
      ratingsChanged: contract.findings.filter(f => f.originalRating).length,
      rationalesChanged: contract.findings.filter(f => f.originalRationale).length,
    };

    return apiSuccess({
      contractId: contract.id,
      contractName: contract.name,
      customerName: contract.customer?.name || null,
      reviewedAt: contract.reviewedAt?.toISOString(),
      reviewedBy: contract.reviewedBy,
      stats,
      feedback,
    });
  } catch (error) {
    logger.error("Failed to export feedback", error, { route: "/api/contracts/[id]/feedback" });
    return errors.internal("Failed to export feedback");
  }
}
