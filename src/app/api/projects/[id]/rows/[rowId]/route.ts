import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RowReviewStatus } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";
import { logAnswerChange, computeChanges, getUserFromSession, getRequestContext } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

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

    // Verify row exists and belongs to project
    const row = await prisma.bulkRow.findFirst({
      where: { id: rowId, projectId },
      include: { project: true },
    });

    if (!row) {
      return errors.notFound("Row");
    }

    // Build update data based on provided fields
    const updateData: Record<string, unknown> = {};

    // Flagging fields (for self-notes, attention markers)
    if (body.flaggedForReview !== undefined) {
      updateData.flaggedForReview = body.flaggedForReview;
      if (body.flaggedForReview) {
        updateData.flaggedAt = new Date();
        updateData.flaggedBy = auth.session?.user?.name || auth.session?.user?.email || "Unknown";
      }
    }
    if (body.flagNote !== undefined) {
      updateData.flagNote = body.flagNote;
    }

    // Queue fields (for batch review workflow - persisted across sessions)
    if (body.queuedForReview !== undefined) {
      updateData.queuedForReview = body.queuedForReview;
      if (body.queuedForReview) {
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
    if (body.queuedNote !== undefined) {
      updateData.queuedNote = body.queuedNote;
    }
    if (body.queuedReviewerId !== undefined) {
      updateData.queuedReviewerId = body.queuedReviewerId;
    }
    if (body.queuedReviewerName !== undefined) {
      updateData.queuedReviewerName = body.queuedReviewerName;
    }

    // Review workflow fields (for formal approval process)
    if (body.reviewStatus !== undefined) {
      updateData.reviewStatus = body.reviewStatus as RowReviewStatus;
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

    // Update the row
    const updatedRow = await prisma.bulkRow.update({
      where: { id: rowId },
      data: updateData,
    });

    // Log answer changes to audit log
    const user = auth.session ? getUserFromSession(auth.session) : undefined;
    const requestContext = getRequestContext(request);

    // Determine the action based on what changed
    if (body.reviewStatus === "CORRECTED" || body.userEditedAnswer !== undefined) {
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
          correctedAnswer: body.userEditedAnswer || updatedRow.userEditedAnswer,
          confidence: row.confidence,
        },
        requestContext
      );
    } else if (body.reviewStatus === "APPROVED") {
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
      include: { project: true },
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
              customerName: row.project.customerName,
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
