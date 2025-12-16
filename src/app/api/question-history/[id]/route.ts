import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RowReviewStatus } from "@prisma/client";
import { logAnswerChange, computeChanges, getUserFromSession, getRequestContext } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET - Fetch a single question history entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { id } = await params;

    const entry = await prisma.questionHistory.findUnique({
      where: { id },
    });

    if (!entry) {
      return errors.notFound("Entry");
    }

    return apiSuccess({
      question: {
        id: entry.id,
        question: entry.question,
        response: entry.response,
        confidence: entry.confidence,
        sources: entry.sources,
        reasoning: entry.reasoning,
        inference: entry.inference,
        remarks: entry.remarks,
        skillsUsed: entry.skillsUsed,
        createdAt: entry.createdAt.toISOString(),
        reviewStatus: entry.reviewStatus,
        reviewNote: entry.reviewNote,
        reviewRequestedBy: entry.reviewRequestedBy,
        reviewedAt: entry.reviewedAt?.toISOString(),
        reviewedBy: entry.reviewedBy,
        flaggedForReview: entry.flaggedForReview,
        flaggedAt: entry.flaggedAt?.toISOString(),
        flaggedBy: entry.flaggedBy,
        flagNote: entry.flagNote,
        flagResolved: entry.flagResolved,
        flagResolvedAt: entry.flagResolvedAt?.toISOString(),
        flagResolvedBy: entry.flagResolvedBy,
        flagResolutionNote: entry.flagResolutionNote,
        userEditedAnswer: entry.userEditedAnswer,
      },
    });
  } catch (error) {
    logger.error("Error fetching question history entry", error, { route: "/api/question-history/[id]" });
    return errors.internal("Failed to fetch entry");
  }
}

// PATCH - Update a question history entry (for corrections/reviews)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();

    // Fetch the existing entry
    const entry = await prisma.questionHistory.findUnique({
      where: { id },
    });

    if (!entry) {
      return errors.notFound("Entry");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.reviewStatus !== undefined) {
      updateData.reviewStatus = body.reviewStatus as RowReviewStatus;
      // Auto-set reviewRequestedAt when status becomes REQUESTED
      if (body.reviewStatus === "REQUESTED" && !body.reviewRequestedAt) {
        updateData.reviewRequestedAt = new Date();
      }
    }
    if (body.reviewNote !== undefined) {
      updateData.reviewNote = body.reviewNote;
    }
    if (body.reviewedAt !== undefined) {
      updateData.reviewedAt = body.reviewedAt ? new Date(body.reviewedAt) : null;
    }
    if (body.reviewedBy !== undefined) {
      updateData.reviewedBy = body.reviewedBy;
    }
    if (body.userEditedAnswer !== undefined) {
      updateData.userEditedAnswer = body.userEditedAnswer;
    }
    if (body.response !== undefined) {
      updateData.response = body.response;
    }
    if (body.flaggedForReview !== undefined) {
      updateData.flaggedForReview = body.flaggedForReview;
      if (body.flaggedForReview) {
        updateData.flaggedAt = new Date();
        updateData.flaggedBy = session.user.email || session.user.name || 'Unknown';
        // Clear any previous resolution when re-flagging
        updateData.flagResolved = false;
        updateData.flagResolvedAt = null;
        updateData.flagResolvedBy = null;
        updateData.flagResolutionNote = null;
      } else {
        updateData.flaggedAt = null;
        updateData.flaggedBy = null;
        updateData.flagNote = null;
      }
    }
    if (body.flagNote !== undefined) {
      updateData.flagNote = body.flagNote;
    }

    // Flag resolution fields (close flag while preserving audit trail)
    if (body.flagResolved !== undefined) {
      updateData.flagResolved = body.flagResolved;
      if (body.flagResolved) {
        updateData.flagResolvedAt = new Date();
        updateData.flagResolvedBy = session.user.name || session.user.email || "Unknown";
        // Keep flaggedForReview true to preserve the audit trail
      } else {
        // Re-opening a resolved flag
        updateData.flagResolvedAt = null;
        updateData.flagResolvedBy = null;
        updateData.flagResolutionNote = null;
      }
    }
    if (body.flagResolutionNote !== undefined) {
      updateData.flagResolutionNote = body.flagResolutionNote;
    }
    if (body.reviewRequestedBy !== undefined) {
      updateData.reviewRequestedBy = body.reviewRequestedBy;
    }
    if (body.reviewRequestedAt !== undefined) {
      updateData.reviewRequestedAt = body.reviewRequestedAt ? new Date(body.reviewRequestedAt) : null;
    }
    if (body.assignedReviewerId !== undefined) {
      updateData.assignedReviewerId = body.assignedReviewerId;
    }
    if (body.assignedReviewerName !== undefined) {
      updateData.assignedReviewerName = body.assignedReviewerName;
    }

    const updatedEntry = await prisma.questionHistory.update({
      where: { id },
      data: updateData,
    });

    // Log answer changes to audit log
    const user = getUserFromSession(session);
    const requestContext = getRequestContext(request);

    if (body.reviewStatus === "CORRECTED" || body.userEditedAnswer !== undefined) {
      const changes = computeChanges(
        {
          response: entry.response,
          reviewStatus: entry.reviewStatus,
          userEditedAnswer: entry.userEditedAnswer,
        },
        {
          response: updatedEntry.response,
          reviewStatus: updatedEntry.reviewStatus,
          userEditedAnswer: updatedEntry.userEditedAnswer,
        }
      );

      await logAnswerChange(
        "CORRECTED",
        id,
        entry.question?.substring(0, 100) || "Question",
        user,
        changes,
        {
          feature: "questions",
          originalResponse: entry.response,
          correctedAnswer: body.userEditedAnswer || updatedEntry.userEditedAnswer,
          confidence: entry.confidence,
        },
        requestContext
      );
    } else if (body.reviewStatus === "APPROVED") {
      await logAnswerChange(
        "APPROVED",
        id,
        entry.question?.substring(0, 100) || "Question",
        user,
        undefined,
        {
          feature: "questions",
          response: entry.response,
          confidence: entry.confidence,
        },
        requestContext
      );
    } else if (body.reviewStatus === "REQUESTED" || body.flaggedForReview === true) {
      await logAnswerChange(
        "REVIEW_REQUESTED",
        id,
        entry.question?.substring(0, 100) || "Question",
        user,
        undefined,
        {
          feature: "questions",
          response: entry.response,
          confidence: entry.confidence,
          flagNote: body.flagNote,
          reviewNote: body.reviewNote,
          reviewRequestedBy: body.reviewRequestedBy,
        },
        requestContext
      );
    } else if (body.flagResolved === true) {
      // Flag was resolved/closed
      await logAnswerChange(
        "FLAG_RESOLVED",
        id,
        entry.question?.substring(0, 100) || "Question",
        user,
        undefined,
        {
          feature: "questions",
          flagNote: entry.flagNote,
          flaggedBy: entry.flaggedBy,
          flaggedAt: entry.flaggedAt,
          resolutionNote: body.flagResolutionNote,
        },
        requestContext
      );
    }

    return apiSuccess({ entry: updatedEntry });
  } catch (error) {
    logger.error("Error updating question history entry", error, { route: "/api/question-history/[id]" });
    return errors.internal("Failed to update entry");
  }
}

// DELETE - Delete a specific question from history
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return errors.unauthorized();
    }

    const { id } = await params;

    // Ensure the entry belongs to the current user
    const entry = await prisma.questionHistory.findFirst({
      where: { id, userId },
    });

    if (!entry) {
      return errors.notFound("Entry");
    }

    await prisma.questionHistory.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Error deleting question history entry", error, { route: "/api/question-history/[id]" });
    return errors.internal("Failed to delete entry");
  }
}
