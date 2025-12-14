import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/instruction-presets/[id] - Get a single preset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const isAdmin = session?.user?.role === "ADMIN";

    const preset = await prisma.instructionPreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Check access: must be approved+shared, OR owned by user, OR admin viewing pending
    const isOwner = preset.createdBy === userId;
    const isApprovedShared = preset.isShared && preset.shareStatus === "APPROVED";
    const isPendingAndAdmin = preset.shareStatus === "PENDING_APPROVAL" && isAdmin;

    if (!isApprovedShared && !isOwner && !isPendingAndAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ preset });
  } catch (error) {
    console.error("Error fetching instruction preset:", error);
    return NextResponse.json(
      { error: "Failed to fetch instruction preset" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preset = await prisma.instructionPreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const isOwner = preset.createdBy === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

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
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }

      if (preset.shareStatus !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "Preset is not pending approval" }, { status: 400 });
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
        return NextResponse.json({ preset: updated });
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
        return NextResponse.json({ preset: updated });
      }
    }

    // Regular updates - must be owner OR admin
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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

    return NextResponse.json({ preset: updated });
  } catch (error) {
    console.error("Error updating instruction preset:", error);
    return NextResponse.json(
      { error: "Failed to update instruction preset" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preset = await prisma.instructionPreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Check ownership: must be owner OR admin
    const isOwner = preset.createdBy === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.instructionPreset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting instruction preset:", error);
    return NextResponse.json(
      { error: "Failed to delete instruction preset" },
      { status: 500 }
    );
  }
}
