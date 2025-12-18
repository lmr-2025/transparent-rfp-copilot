import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import type { Prisma } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateCollateralSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  filledContent: z.record(z.string(), z.string()).optional(),
  generatedMarkdown: z.string().optional(),
  googleSlidesId: z.string().optional(),
  googleSlidesUrl: z.string().url().optional(),
  status: z.enum(["DRAFT", "GENERATED", "EXPORTED", "NEEDS_REVIEW", "APPROVED", "FINALIZED"]).optional(),
  // Flagging
  flaggedForReview: z.boolean().optional(),
  flagNote: z.string().optional(),
  flagResolved: z.boolean().optional(),
  flagResolutionNote: z.string().optional(),
  // Review
  reviewStatus: z.enum(["NONE", "REQUESTED", "APPROVED", "CORRECTED"]).optional(),
  reviewNote: z.string().optional(),
  assignedReviewerId: z.string().optional(),
  assignedReviewerName: z.string().optional(),
  // Queue
  queuedForReview: z.boolean().optional(),
  queuedNote: z.string().optional(),
  queuedReviewerId: z.string().optional(),
  queuedReviewerName: z.string().optional(),
  // Feedback
  rating: z.enum(["THUMBS_UP", "THUMBS_DOWN"]).optional().nullable(),
  feedbackComment: z.string().optional(),
});

/**
 * GET /api/collateral/output/[id] - Get a specific collateral output
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    const output = await prisma.collateralOutput.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, industry: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!output) {
      return errors.notFound("Collateral output not found");
    }

    return apiSuccess({ output });
  } catch (error) {
    logger.error("Failed to get collateral output", error);
    return errors.internal("Failed to get collateral output");
  }
}

/**
 * PATCH /api/collateral/output/[id] - Update a collateral output
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    // Check if exists
    const existing = await prisma.collateralOutput.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Collateral output not found");
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest("Invalid JSON body");
    }

    const validation = validateBody(updateCollateralSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;
    const userEmail = auth.session.user.email || "unknown";
    const now = new Date();

    // Build update object with workflow logic
    const updateData: Prisma.CollateralOutputUpdateInput = {};

    // Basic fields
    if (data.name !== undefined) updateData.name = data.name;
    if (data.filledContent !== undefined) updateData.filledContent = data.filledContent;
    if (data.generatedMarkdown !== undefined) updateData.generatedMarkdown = data.generatedMarkdown;
    if (data.googleSlidesId !== undefined) updateData.googleSlidesId = data.googleSlidesId;
    if (data.googleSlidesUrl !== undefined) updateData.googleSlidesUrl = data.googleSlidesUrl;
    if (data.status !== undefined) updateData.status = data.status;

    // Flagging logic
    if (data.flaggedForReview === true && !existing.flaggedForReview) {
      updateData.flaggedForReview = true;
      updateData.flaggedAt = now;
      updateData.flaggedBy = userEmail;
      updateData.flagResolved = false;
    }
    if (data.flagNote !== undefined) updateData.flagNote = data.flagNote;
    if (data.flagResolved === true && !existing.flagResolved) {
      updateData.flagResolved = true;
      updateData.flagResolvedAt = now;
      updateData.flagResolvedBy = userEmail;
    }
    if (data.flagResolutionNote !== undefined) updateData.flagResolutionNote = data.flagResolutionNote;
    // Reopen flag
    if (data.flagResolved === false && existing.flagResolved) {
      updateData.flagResolved = false;
      updateData.flagResolvedAt = null;
      updateData.flagResolvedBy = null;
      updateData.flagResolutionNote = null;
    }

    // Review logic
    if (data.reviewStatus !== undefined) {
      updateData.reviewStatus = data.reviewStatus;
      if (data.reviewStatus === "REQUESTED" && existing.reviewStatus !== "REQUESTED") {
        updateData.reviewRequestedAt = now;
        updateData.reviewRequestedBy = userEmail;
        updateData.status = "NEEDS_REVIEW";
      }
      if (data.reviewStatus === "APPROVED" || data.reviewStatus === "CORRECTED") {
        updateData.reviewedAt = now;
        updateData.reviewedBy = userEmail;
        if (data.reviewStatus === "APPROVED") {
          updateData.status = "APPROVED";
        }
      }
    }
    if (data.reviewNote !== undefined) updateData.reviewNote = data.reviewNote;
    if (data.assignedReviewerId !== undefined) updateData.assignedReviewerId = data.assignedReviewerId;
    if (data.assignedReviewerName !== undefined) updateData.assignedReviewerName = data.assignedReviewerName;

    // Queue logic
    if (data.queuedForReview === true && !existing.queuedForReview) {
      updateData.queuedForReview = true;
      updateData.queuedAt = now;
      updateData.queuedBy = userEmail;
    }
    if (data.queuedForReview === false && existing.queuedForReview) {
      updateData.queuedForReview = false;
      updateData.queuedAt = null;
      updateData.queuedBy = null;
      updateData.queuedNote = null;
      updateData.queuedReviewerId = null;
      updateData.queuedReviewerName = null;
    }
    if (data.queuedNote !== undefined) updateData.queuedNote = data.queuedNote;
    if (data.queuedReviewerId !== undefined) updateData.queuedReviewerId = data.queuedReviewerId;
    if (data.queuedReviewerName !== undefined) updateData.queuedReviewerName = data.queuedReviewerName;

    // Feedback
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.feedbackComment !== undefined) updateData.feedbackComment = data.feedbackComment;

    const output = await prisma.collateralOutput.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true },
        },
      },
    });

    logger.info("Updated collateral output", {
      outputId: id,
      userId: auth.session.user.id,
      updates: Object.keys(updateData),
    });

    return apiSuccess({ output });
  } catch (error) {
    logger.error("Failed to update collateral output", error);
    return errors.internal("Failed to update collateral output");
  }
}

/**
 * DELETE /api/collateral/output/[id] - Delete a collateral output
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    // Check if exists
    const existing = await prisma.collateralOutput.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Collateral output not found");
    }

    await prisma.collateralOutput.delete({
      where: { id },
    });

    logger.info("Deleted collateral output", {
      outputId: id,
      userId: auth.session.user.id,
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete collateral output", error);
    return errors.internal("Failed to delete collateral output");
  }
}
