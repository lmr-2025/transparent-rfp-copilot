import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import type { CollateralStatus, Prisma } from "@prisma/client";

// Validation schemas
const createCollateralSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().uuid().optional(),
  templateName: z.string().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  filledContent: z.record(z.string(), z.string()).optional(),
  generatedMarkdown: z.string().optional(),
  googleSlidesId: z.string().optional(),
  googleSlidesUrl: z.string().url().optional(),
  status: z.enum(["DRAFT", "GENERATED", "EXPORTED", "NEEDS_REVIEW", "APPROVED", "FINALIZED"]).optional(),
  // Flagging
  flaggedForReview: z.boolean().optional(),
  flagNote: z.string().optional(),
  // Review
  reviewStatus: z.enum(["NONE", "REQUESTED", "APPROVED", "CORRECTED"]).optional(),
  queuedForReview: z.boolean().optional(),
  queuedNote: z.string().optional(),
  queuedReviewerId: z.string().optional(),
  queuedReviewerName: z.string().optional(),
  // Feedback
  rating: z.enum(["THUMBS_UP", "THUMBS_DOWN"]).optional().nullable(),
  feedbackComment: z.string().optional(),
});

/**
 * GET /api/collateral/output - List user's collateral outputs
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: Prisma.CollateralOutputWhereInput = {
      ownerId: auth.session.user.id,
    };

    if (status) {
      where.status = status as CollateralStatus;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    const [outputs, total] = await Promise.all([
      prisma.collateralOutput.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.collateralOutput.count({ where }),
    ]);

    return apiSuccess({
      outputs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("Failed to list collateral outputs", error);
    return errors.internal("Failed to list collateral outputs");
  }
}

/**
 * POST /api/collateral/output - Create a new collateral output
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest("Invalid JSON body");
    }

    const validation = validateBody(createCollateralSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    const output = await prisma.collateralOutput.create({
      data: {
        name: data.name,
        templateId: data.templateId,
        customerId: data.customerId,
        filledContent: data.filledContent as Prisma.InputJsonValue | undefined,
        generatedMarkdown: data.generatedMarkdown,
        googleSlidesId: data.googleSlidesId,
        googleSlidesUrl: data.googleSlidesUrl,
        status: data.status || "DRAFT",
        ownerId: auth.session.user.id,
        createdBy: auth.session.user.email,
      },
    });

    logger.info("Created collateral output", {
      outputId: output.id,
      userId: auth.session.user.id,
    });

    return apiSuccess({ output }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create collateral output", error);
    return errors.internal("Failed to create collateral output");
  }
}
