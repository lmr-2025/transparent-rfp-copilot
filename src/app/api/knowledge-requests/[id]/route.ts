import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAnyCapability } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Validation schema for updating a knowledge request
const updateRequestSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED"]).optional(),
  reviewNote: z.string().optional(),
  skillId: z.string().optional(), // When converting to skill
});

/**
 * GET /api/knowledge-requests/[id] - Get a single knowledge request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;

    const knowledgeRequest = await prisma.knowledgeRequest.findUnique({
      where: { id },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!knowledgeRequest) {
      return errors.notFound("Knowledge request not found");
    }

    // Check permissions - user can view their own, managers can view all
    const canManage = auth.session.user.capabilities.some((cap) =>
      ["MANAGE_KNOWLEDGE", "ADMIN"].includes(cap)
    );

    if (!canManage && knowledgeRequest.requestedById !== auth.session.user.id) {
      return errors.forbidden("You can only view your own requests");
    }

    return apiSuccess({ request: knowledgeRequest });
  } catch (error) {
    logger.error("Failed to fetch knowledge request", error, {
      route: "/api/knowledge-requests/[id]",
    });
    return errors.internal("Failed to fetch knowledge request");
  }
}

/**
 * PATCH /api/knowledge-requests/[id] - Update a knowledge request
 *
 * Only users with MANAGE_KNOWLEDGE or ADMIN can update status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require MANAGE_KNOWLEDGE or ADMIN capability to update requests
  const auth = await requireAnyCapability(["MANAGE_KNOWLEDGE", "ADMIN"]);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateRequestSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return errors.validation(firstError?.message || "Invalid request data");
    }

    const data = validation.data;

    // Check if request exists
    const existing = await prisma.knowledgeRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Knowledge request not found");
    }

    // Build update data
    const updateData: {
      status?: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
      reviewNote?: string;
      reviewedAt?: Date;
      reviewedById?: string;
      reviewedByEmail?: string;
      skillId?: string;
    } = {};

    if (data.status) {
      updateData.status = data.status;
      updateData.reviewedAt = new Date();
      updateData.reviewedById = auth.session.user.id;
      updateData.reviewedByEmail = auth.session.user.email;
    }

    if (data.reviewNote !== undefined) {
      updateData.reviewNote = data.reviewNote;
    }

    if (data.skillId) {
      updateData.skillId = data.skillId;
      updateData.status = "COMPLETED";
    }

    const knowledgeRequest = await prisma.knowledgeRequest.update({
      where: { id },
      data: updateData,
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    logger.info("Knowledge request updated", {
      requestId: id,
      reviewerId: auth.session.user.id,
      newStatus: data.status,
    });

    return apiSuccess({ request: knowledgeRequest });
  } catch (error) {
    logger.error("Failed to update knowledge request", error, {
      route: "/api/knowledge-requests/[id]",
    });
    return errors.internal("Failed to update knowledge request");
  }
}

/**
 * DELETE /api/knowledge-requests/[id] - Delete a knowledge request
 *
 * Users can delete their own pending requests
 * Admins can delete any request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;

    const existing = await prisma.knowledgeRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Knowledge request not found");
    }

    // Check permissions
    const isAdmin = auth.session.user.capabilities.some((cap) =>
      ["ADMIN"].includes(cap)
    );
    const isOwner = existing.requestedById === auth.session.user.id;

    if (!isAdmin && !isOwner) {
      return errors.forbidden("You can only delete your own requests");
    }

    // Non-admins can only delete pending requests
    if (!isAdmin && existing.status !== "PENDING") {
      return errors.badRequest("You can only delete pending requests");
    }

    await prisma.knowledgeRequest.delete({
      where: { id },
    });

    logger.info("Knowledge request deleted", {
      requestId: id,
      deletedBy: auth.session.user.id,
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete knowledge request", error, {
      route: "/api/knowledge-requests/[id]",
    });
    return errors.internal("Failed to delete knowledge request");
  }
}
