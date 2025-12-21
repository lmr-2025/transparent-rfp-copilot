import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstructionShareStatus, Prisma } from "@prisma/client";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/instruction-presets - List all presets (user's own + approved shared presets)
// Admins also see pending approval requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userCapabilities = session?.user?.capabilities || [];
    const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
      userCapabilities.includes("ADMIN") ||
      session?.user?.role === "ADMIN";

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

    return apiSuccess({ presets });
  } catch (error) {
    logger.error("Failed to fetch instruction presets", error, { route: "/api/instruction-presets" });
    return errors.internal("Failed to fetch instruction presets");
  }
}

// POST /api/instruction-presets - Create a new preset
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const data = await request.json();
    const { name, content, description, defaultCategories, requestShare } = data;

    if (!name || !content) {
      return errors.badRequest("Name and content are required");
    }

    const userCapabilities = session.user.capabilities || [];
    const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
      userCapabilities.includes("ADMIN") ||
      session.user.role === "ADMIN";

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
        defaultCategories: defaultCategories || [],
        isShared,
        shareStatus,
        shareRequestedAt: requestShare ? new Date() : null,
        approvedAt: isAdmin && requestShare ? new Date() : null,
        approvedBy: isAdmin && requestShare ? session.user.id : null,
        createdBy: session.user.id,
        createdByEmail: session.user.email || null,
      },
    });

    return apiSuccess({ preset }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create instruction preset", error, { route: "/api/instruction-presets" });
    return errors.internal("Failed to create instruction preset");
  }
}
