import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstructionShareStatus, Prisma } from "@prisma/client";

// GET /api/instruction-presets - List all presets (user's own + approved shared presets)
// Admins also see pending approval requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const isAdmin = session?.user?.role === "ADMIN";

    // Check for admin-only query param to get pending approvals
    const { searchParams } = new URL(request.url);
    const includePending = searchParams.get("pending") === "true" && isAdmin;

    // Build query conditions
    const conditions: Prisma.InstructionPresetWhereInput[] = [];

    // Always include approved/shared presets
    conditions.push({ isShared: true, shareStatus: InstructionShareStatus.APPROVED });

    // Include user's own presets (any status)
    if (userId) {
      conditions.push({ createdBy: userId });
    }

    // Admins can see all pending approval requests
    if (includePending) {
      conditions.push({ shareStatus: InstructionShareStatus.PENDING_APPROVAL });
    }

    const presets = await prisma.instructionPreset.findMany({
      where: {
        OR: conditions,
      },
      orderBy: [
        { isDefault: "desc" },
        { shareStatus: "asc" }, // PENDING first for admins
        { isShared: "desc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ presets });
  } catch (error) {
    console.error("Error fetching instruction presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch instruction presets" },
      { status: 500 }
    );
  }
}

// POST /api/instruction-presets - Create a new preset
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { name, content, description, requestShare } = data;

    if (!name || !content) {
      return NextResponse.json(
        { error: "Name and content are required" },
        { status: 400 }
      );
    }

    const isAdmin = session.user.role === "ADMIN";

    // Determine share status based on request and user role
    let shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" = "PRIVATE";
    let isShared = false;

    if (requestShare) {
      if (isAdmin) {
        // Admins can directly share without approval
        shareStatus = "APPROVED";
        isShared = true;
      } else {
        // Non-admins need approval
        shareStatus = "PENDING_APPROVAL";
        isShared = false; // Not shared until approved
      }
    }

    const preset = await prisma.instructionPreset.create({
      data: {
        name,
        content,
        description: description || null,
        isShared,
        shareStatus,
        shareRequestedAt: requestShare ? new Date() : null,
        approvedAt: isAdmin && requestShare ? new Date() : null,
        approvedBy: isAdmin && requestShare ? session.user.id : null,
        createdBy: session.user.id,
        createdByEmail: session.user.email || null,
      },
    });

    return NextResponse.json({ preset });
  } catch (error) {
    console.error("Error creating instruction preset:", error);
    return NextResponse.json(
      { error: "Failed to create instruction preset" },
      { status: 500 }
    );
  }
}
