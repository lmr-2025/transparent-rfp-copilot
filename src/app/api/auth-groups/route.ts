import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { hasCapability } from "@/lib/capabilities";
import { Capability } from "@prisma/client";

// GET /api/auth-groups - List all auth group mappings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized("Authentication required");
    }

    // Check for MANAGE_USERS or ADMIN capability
    const userCapabilities = session.user.capabilities || [];
    if (!hasCapability(userCapabilities, "MANAGE_USERS")) {
      return errors.forbidden("MANAGE_USERS capability required");
    }

    const mappings = await prisma.authGroupMapping.findMany({
      orderBy: [{ provider: "asc" }, { groupId: "asc" }],
    });

    return apiSuccess({ mappings });
  } catch (error) {
    logger.error("Error fetching auth group mappings", error);
    return errors.internal("Failed to fetch auth group mappings");
  }
}

// POST /api/auth-groups - Create a new auth group mapping
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized("Authentication required");
    }

    const userCapabilities = session.user.capabilities || [];
    if (!hasCapability(userCapabilities, "MANAGE_USERS")) {
      return errors.forbidden("MANAGE_USERS capability required");
    }

    const body = await request.json();
    const { provider, groupId, groupName, capabilities } = body;

    if (!provider || !groupId) {
      return errors.badRequest("provider and groupId are required");
    }

    // Validate capabilities
    const validCapabilities = capabilities?.filter((c: string) =>
      Object.values(Capability).includes(c as Capability)
    ) as Capability[] || [];

    // Check if mapping already exists
    const existing = await prisma.authGroupMapping.findUnique({
      where: { provider_groupId: { provider, groupId } },
    });

    if (existing) {
      return errors.badRequest("Mapping already exists for this provider and group");
    }

    const mapping = await prisma.authGroupMapping.create({
      data: {
        provider,
        groupId,
        groupName: groupName || null,
        capabilities: validCapabilities,
      },
    });

    logger.info("Created auth group mapping", {
      id: mapping.id,
      provider,
      groupId,
      createdBy: session.user.email,
    });

    return apiSuccess({ mapping });
  } catch (error) {
    logger.error("Error creating auth group mapping", error);
    return errors.internal("Failed to create auth group mapping");
  }
}

// PUT /api/auth-groups - Update an auth group mapping
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized("Authentication required");
    }

    const userCapabilities = session.user.capabilities || [];
    if (!hasCapability(userCapabilities, "MANAGE_USERS")) {
      return errors.forbidden("MANAGE_USERS capability required");
    }

    const body = await request.json();
    const { id, groupName, capabilities, isActive } = body;

    if (!id) {
      return errors.badRequest("id is required");
    }

    const existing = await prisma.authGroupMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Auth group mapping not found");
    }

    // Validate capabilities if provided
    const validCapabilities = capabilities?.filter((c: string) =>
      Object.values(Capability).includes(c as Capability)
    ) as Capability[] | undefined;

    const mapping = await prisma.authGroupMapping.update({
      where: { id },
      data: {
        ...(groupName !== undefined && { groupName }),
        ...(validCapabilities !== undefined && { capabilities: validCapabilities }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    logger.info("Updated auth group mapping", {
      id: mapping.id,
      updatedBy: session.user.email,
    });

    return apiSuccess({ mapping });
  } catch (error) {
    logger.error("Error updating auth group mapping", error);
    return errors.internal("Failed to update auth group mapping");
  }
}

// DELETE /api/auth-groups - Delete an auth group mapping
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized("Authentication required");
    }

    const userCapabilities = session.user.capabilities || [];
    if (!hasCapability(userCapabilities, "MANAGE_USERS")) {
      return errors.forbidden("MANAGE_USERS capability required");
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return errors.badRequest("id is required");
    }

    const existing = await prisma.authGroupMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Auth group mapping not found");
    }

    await prisma.authGroupMapping.delete({
      where: { id },
    });

    logger.info("Deleted auth group mapping", {
      id,
      provider: existing.provider,
      groupId: existing.groupId,
      deletedBy: session.user.email,
    });

    return apiSuccess({ deleted: true, id });
  } catch (error) {
    logger.error("Error deleting auth group mapping", error);
    return errors.internal("Failed to delete auth group mapping");
  }
}
