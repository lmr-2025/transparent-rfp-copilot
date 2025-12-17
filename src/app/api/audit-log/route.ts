import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { AuditEntityType, AuditAction } from "@prisma/client";
import { logger } from "@/lib/logger";
import { apiSuccess, errors } from "@/lib/apiResponse";

// GET /api/audit-log - Get audit log entries with filtering
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const entityType = searchParams.get("entityType") as AuditEntityType | null;
    const entityId = searchParams.get("entityId");
    const action = searchParams.get("action") as AuditAction | null;
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { entityTitle: { contains: search, mode: "insensitive" } },
        { userName: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Get total count and entries
    const [total, entries] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return apiSuccess({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch audit log", error, { route: "/api/audit-log" });

    // Check for specific Prisma errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle enum value not found (happens when migration hasn't been run)
    if (errorMessage.includes("enum") || errorMessage.includes("CLARIFY_USED")) {
      return errors.internal("Database migration required. Please run 'npx prisma migrate dev' to update the schema.");
    }

    // Handle table not found
    if (errorMessage.includes("does not exist") || errorMessage.includes("P2021")) {
      return errors.internal("Audit log table not found. Please run database migrations.");
    }

    return errors.internal("Failed to fetch audit log");
  }
}
