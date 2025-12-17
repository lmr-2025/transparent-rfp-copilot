import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/instruction-presets/[id] - Get a single preset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userCapabilities = session?.user?.capabilities || [];
    const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
      userCapabilities.includes("ADMIN") ||
      session?.user?.role === "ADMIN";

    const preset = await prisma.instructionPreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return errors.notFound("Preset");
    }

    // Check access: must be approved+shared, OR owned by user, OR admin viewing pending
    const isOwner = preset.createdBy === userId;
    const isApprovedShared = preset.isShared && preset.shareStatus === "APPROVED";
    const isPendingAndAdmin = preset.shareStatus === "PENDING_APPROVAL" && isAdmin;

    if (!isApprovedShared && !isOwner && !isPendingAndAdmin) {
      return errors.forbidden("Access denied");
    }

    return apiSuccess({ preset });
  } catch (error) {
    logger.error("Failed to fetch instruction preset", error, { route: "/api/instruction-presets/[id]" });
    return errors.internal("Failed to fetch instruction preset");
  }
}

// PUT /api/instruction-presets/[id] - Update a preset or approve/reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const preset = await prisma.instructionPreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return errors.notFound("Preset");
    }

    const isOwner = preset.createdBy === session.user.id;
    const userCapabilities = session.user.capabilities || [];
    const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
      userCapabilities.includes("ADMIN") ||
      session.user.role === "ADMIN";

    const data = await request.json();
    const {
      name,
      content,
      description,
      requestShare,
      isDefault,
      // Admin-only actions
      action, // "approve" | "reject"
      rejectionReason,
    } = data;

    // Handle admin approval/rejection
    if (action === "approve" || action === "reject") {
      if (!isAdmin) {
        return errors.forbidden("Admin access required");
      }

      if (preset.shareStatus !== "PENDING_APPROVAL") {
        return errors.badRequest("Preset is not pending approval");
      }

      if (action === "approve") {
        const updated = await prisma.instructionPreset.update({
          where: { id },
          data: {
            shareStatus: "APPROVED",
            isShared: true,
            approvedAt: new Date(),
            approvedBy: session.user.id,
            rejectedAt: null,
            rejectedBy: null,
            rejectionReason: null,
          },
        });
        return apiSuccess({ preset: updated });
      } else {
        const updated = await prisma.instructionPreset.update({
          where: { id },
          data: {
            shareStatus: "REJECTED",
            isShared: false,
            rejectedAt: new Date(),
            rejectedBy: session.user.id,
            rejectionReason: rejectionReason || null,
          },
        });
        return apiSuccess({ preset: updated });
      }
    }

    // Regular updates - must be owner OR admin
    if (!isOwner && !isAdmin) {
      return errors.forbidden("Access denied");
    }

    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (content !== undefined) updates.content = content;
    if (description !== undefined) updates.description = description;

    // Handle share request from owner
    if (requestShare !== undefined && isOwner) {
      if (requestShare && preset.shareStatus === "PRIVATE") {
        // Request to share
        if (isAdmin) {
          // Admins auto-approve their own
          updates.shareStatus = "APPROVED";
          updates.isShared = true;
          updates.shareRequestedAt = new Date();
          updates.approvedAt = new Date();
          updates.approvedBy = session.user.id;
        } else {
          updates.shareStatus = "PENDING_APPROVAL";
          updates.shareRequestedAt = new Date();
        }
      } else if (!requestShare && (preset.shareStatus === "PENDING_APPROVAL" || preset.shareStatus === "REJECTED")) {
        // Cancel share request or revert rejected to private
        updates.shareStatus = "PRIVATE";
        updates.isShared = false;
        updates.shareRequestedAt = null;
        updates.rejectedAt = null;
        updates.rejectedBy = null;
        updates.rejectionReason = null;
      }
    }

    // Only admins can set default
    if (isDefault !== undefined && isAdmin) {
      if (isDefault) {
        // Unset any other defaults first
        await prisma.instructionPreset.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      updates.isDefault = isDefault;
    }

    const updated = await prisma.instructionPreset.update({
      where: { id },
      data: updates,
    });

    return apiSuccess({ preset: updated });
  } catch (error) {
    logger.error("Failed to update instruction preset", error, { route: "/api/instruction-presets/[id]" });
    return errors.internal("Failed to update instruction preset");
  }
}

// DELETE /api/instruction-presets/[id] - Delete a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const preset = await prisma.instructionPreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return errors.notFound("Preset");
    }

    // Check ownership: must be owner OR admin
    const isOwner = preset.createdBy === session.user.id;
    const userCapabilities = session.user.capabilities || [];
    const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
      userCapabilities.includes("ADMIN") ||
      session.user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return errors.forbidden("Access denied");
    }

    await prisma.instructionPreset.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete instruction preset", error, { route: "/api/instruction-presets/[id]" });
    return errors.internal("Failed to delete instruction preset");
  }
}
