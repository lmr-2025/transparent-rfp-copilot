import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Type for feedback export
type RowFeedback = {
  id: string;
  rowNumber: number;
  question: string;
  feedbackType: "response_edited" | "confidence_changed";
  original?: string;
  corrected?: string;
  originalConfidence?: string;
  newConfidence?: string;
};

// GET /api/projects/[id]/feedback - Export review feedback for prompt improvement
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.bulkProject.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { rowNumber: "asc" },
        },
      },
    });

    if (!project) {
      return errors.notFound("Project");
    }

    const feedback: RowFeedback[] = [];

    for (const row of project.rows) {
      // User edited the AI's response
      if (row.originalResponse && row.userEditedAnswer && row.userEditedAnswer !== row.originalResponse) {
        feedback.push({
          id: row.id,
          rowNumber: row.rowNumber,
          question: row.question.substring(0, 200) + (row.question.length > 200 ? "..." : ""),
          feedbackType: "response_edited",
          original: row.originalResponse,
          corrected: row.userEditedAnswer,
          originalConfidence: row.originalConfidence || undefined,
          newConfidence: row.confidence || undefined,
        });
      }
    }

    // Calculate summary stats
    const stats = {
      totalRows: project.rows.length,
      completedRows: project.rows.filter(r => r.status === "COMPLETED").length,
      editedResponses: project.rows.filter(r => r.originalResponse).length,
      reviewedRows: project.rows.filter(r => r.reviewStatus === "APPROVED" || r.reviewStatus === "CORRECTED").length,
      flaggedRows: project.rows.filter(r => r.flaggedForReview).length,
    };

    return apiSuccess({
      projectId: project.id,
      projectName: project.name,
      customerName: project.customerName,
      stats,
      feedback,
    });
  } catch (error) {
    logger.error("Failed to export feedback", error, { route: "/api/projects/[id]/feedback" });
    return errors.internal("Failed to export feedback");
  }
}
