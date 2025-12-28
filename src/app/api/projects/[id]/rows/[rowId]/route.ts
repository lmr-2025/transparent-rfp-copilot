import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RowReviewStatus } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";
import { logAnswerChange, computeChanges, getUserFromSession, getRequestContext } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { projectRowPatchSchema, validateBody } from "@/lib/validations";

interface RouteContext {
  params: Promise<{ id: string; rowId: string }>;
}

// PATCH /api/projects/[id]/rows/[rowId] - Update a specific row
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: projectId, rowId } = params;
    const body = await request.json();
    const validation = validateBody(projectRowPatchSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }
    const data = validation.data;

    // Verify row exists and belongs to project
    const row = await prisma.bulkRow.findFirst({
      where: { id: rowId, projectId },
      include: {
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return errors.notFound("Row");
    }

    // Build update data based on provided fields
    const updateData: Record<string, unknown> = {};

    // Flagging fields (for self-notes, attention markers)
    if (data.flaggedForReview !== undefined) {
      updateData.flaggedForReview = data.flaggedForReview;
      if (data.flaggedForReview) {
        updateData.flaggedAt = new Date();
        updateData.flaggedBy = auth.session?.user?.name || auth.session?.user?.email || "Unknown";
        // Clear any previous resolution when re-flagging
        updateData.flagResolved = false;
        updateData.flagResolvedAt = null;
        updateData.flagResolvedBy = null;
        updateData.flagResolutionNote = null;
      }
    }
    if (data.flagNote !== undefined) {
      updateData.flagNote = data.flagNote;
    }

    // Flag resolution fields (close flag while preserving audit trail)
    if (data.flagResolved !== undefined) {
      updateData.flagResolved = data.flagResolved;
      if (data.flagResolved) {
        updateData.flagResolvedAt = new Date();
        updateData.flagResolvedBy = auth.session?.user?.name || auth.session?.user?.email || "Unknown";
        // Keep flaggedForReview true to preserve the audit trail - flag is resolved, not removed
      } else {
        // Re-opening a resolved flag
        updateData.flagResolvedAt = null;
        updateData.flagResolvedBy = null;
        updateData.flagResolutionNote = null;
      }
    }
    if (data.flagResolutionNote !== undefined) {
      updateData.flagResolutionNote = data.flagResolutionNote;
    }

    // Queue fields (for batch review workflow - persisted across sessions)
    if (data.queuedForReview !== undefined) {
      updateData.queuedForReview = data.queuedForReview;
      if (data.queuedForReview) {
        updateData.queuedAt = new Date();
        updateData.queuedBy = auth.session?.user?.name || auth.session?.user?.email || "Unknown";
      } else {
        // Clear queue fields when un-queueing
        updateData.queuedAt = null;
        updateData.queuedBy = null;
        updateData.queuedNote = null;
        updateData.queuedReviewerId = null;
        updateData.queuedReviewerName = null;
      }
    }
    if (data.queuedNote !== undefined) {
      updateData.queuedNote = data.queuedNote;
    }
    if (data.queuedReviewerId !== undefined) {
      updateData.queuedReviewerId = data.queuedReviewerId ?? null;
    }
    if (data.queuedReviewerName !== undefined) {
      updateData.queuedReviewerName = data.queuedReviewerName ?? null;
    }

    // Review workflow fields (for formal approval process)
    if (data.reviewStatus !== undefined) {
      updateData.reviewStatus = data.reviewStatus as RowReviewStatus;
    }
    if (data.reviewNote !== undefined) {
      updateData.reviewNote = data.reviewNote;
    }
    if (data.reviewedAt !== undefined) {
      updateData.reviewedAt = data.reviewedAt ? new Date(data.reviewedAt) : null;
    }
    if (data.reviewedBy !== undefined) {
      updateData.reviewedBy = data.reviewedBy;
    }
    if (data.userEditedAnswer !== undefined) {
      updateData.userEditedAnswer = data.userEditedAnswer;
    }

    // Track original response for feedback (first edit only)
    if (data.userEditedAnswer !== undefined && data.userEditedAnswer !== row.response) {
      // Only capture original if not already captured
      if (!row.originalResponse && row.response) {
        updateData.originalResponse = row.response;
        updateData.originalConfidence = row.confidence || null;
      }
    }

    // Update the row
    const updatedRow = await prisma.bulkRow.update({
      where: { id: rowId },
      data: updateData,
    });

    // Log answer changes to audit log
    const user = auth.session ? getUserFromSession(auth.session) : undefined;
    const requestContext = getRequestContext(request);

    // Determine the action based on what changed
    if (data.reviewStatus === "CORRECTED" || data.userEditedAnswer !== undefined) {
      // Answer was corrected
      const changes = computeChanges(
        {
          response: row.response,
          reviewStatus: row.reviewStatus,
          userEditedAnswer: row.userEditedAnswer,
        },
        {
          response: updatedRow.response,
          reviewStatus: updatedRow.reviewStatus,
          userEditedAnswer: updatedRow.userEditedAnswer,
        }
      );

      await logAnswerChange(
        "CORRECTED",
        rowId,
        row.question?.substring(0, 100) || "Answer",
        user,
        changes,
        {
          projectId,
          projectName: row.project.name,
          originalResponse: row.response,
          correctedAnswer: data.userEditedAnswer || updatedRow.userEditedAnswer,
          confidence: row.confidence,
        },
        requestContext
      );
    } else if (data.reviewStatus === "APPROVED") {
      // Answer was approved
      await logAnswerChange(
        "APPROVED",
        rowId,
        row.question?.substring(0, 100) || "Answer",
        user,
        undefined,
        {
          projectId,
          projectName: row.project.name,
          response: row.response,
          confidence: row.confidence,
        },
        requestContext
      );
    } else if (data.flagResolved === true) {
      // Flag was resolved/closed
      await logAnswerChange(
        "FLAG_RESOLVED",
        rowId,
        row.question?.substring(0, 100) || "Answer",
        user,
        undefined,
        {
          projectId,
          projectName: row.project.name,
          flagNote: row.flagNote,
          flaggedBy: row.flaggedBy,
          flaggedAt: row.flaggedAt,
          resolutionNote: data.flagResolutionNote,
        },
        requestContext
      );
    }

    return apiSuccess({ row: updatedRow });
  } catch (error) {
    logger.error("Failed to update row", error, { route: "/api/projects/[id]/rows/[rowId]" });
    return errors.internal("Failed to update row");
  }
}

// POST /api/projects/[id]/rows/[rowId]/request-review - Request review with Slack notification
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: projectId, rowId } = params;
    const body = await request.json();
    const { reviewNote, sendSlack = true, assignedReviewerId, assignedReviewerName } = body;

    // Verify row exists and belongs to project
    const row = await prisma.bulkRow.findFirst({
      where: { id: rowId, projectId },
      include: {
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return errors.notFound("Row");
    }

    const requesterName = auth.session?.user?.name || auth.session?.user?.email || "Unknown User";

    // Update the row with review request (separate from flagging)
    // Also clear queue status if this was a queued item being sent
    const updatedRow = await prisma.bulkRow.update({
      where: { id: rowId },
      data: {
        reviewStatus: "REQUESTED",
        reviewRequestedAt: new Date(),
        reviewRequestedBy: requesterName,
        reviewNote: reviewNote || null,
        assignedReviewerId: assignedReviewerId || null,
        assignedReviewerName: assignedReviewerName || null,
        // Clear queue status now that it's been sent
        queuedForReview: false,
        queuedAt: null,
        queuedBy: null,
        queuedNote: null,
        queuedReviewerId: null,
        queuedReviewerName: null,
      },
    });

    // Log the review request to audit log
    const user = auth.session ? getUserFromSession(auth.session) : undefined;
    const requestContext = getRequestContext(request);
    await logAnswerChange(
      "REVIEW_REQUESTED",
      rowId,
      row.question?.substring(0, 100) || "Answer",
      user,
      undefined,
      {
        projectId,
        projectName: row.project.name,
        response: row.response,
        confidence: row.confidence,
        reviewNote,
        assignedReviewerName,
      },
      requestContext
    );

    // Send Slack notification if enabled
    let slackSent = false;
    if (sendSlack) {
      try {
        const projectUrl = `${request.headers.get("origin") || ""}/projects/${projectId}?filter=flagged`;

        const slackResponse = await fetch(
          `${request.headers.get("origin") || ""}/api/slack/notify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "question",
              projectName: row.project.name,
              projectUrl,
              customerName: row.project.customer?.name || null,
              requesterName,
              question: row.question,
              answer: row.response,
              confidence: row.confidence,
              reviewNote,
            }),
          }
        );

        slackSent = slackResponse.ok;
      } catch (slackError) {
        logger.warn("Slack notification failed", slackError);
      }
    }

    return apiSuccess({
      row: updatedRow,
      slackSent,
    });
  } catch (error) {
    logger.error("Failed to request review", error, { route: "/api/projects/[id]/rows/[rowId]" });
    return errors.internal("Failed to request review");
  }
}
