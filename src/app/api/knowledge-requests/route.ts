import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Validation schema for creating a knowledge request
const createRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(10, "Description must be at least 10 characters"),
  suggestedUrls: z.array(z.string().url()).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
});

/**
 * GET /api/knowledge-requests - List knowledge requests
 *
 * For users without MANAGE_KNOWLEDGE: returns only their own requests
 * For users with MANAGE_KNOWLEDGE/ADMIN: returns all requests (with optional status filter)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const myOnly = searchParams.get("myOnly") === "true";

    // Check if user has knowledge management permissions
    const canManage = auth.session.user.capabilities.some((cap) =>
      ["MANAGE_KNOWLEDGE", "ADMIN"].includes(cap)
    );

    // Build where clause
    const where: {
      status?: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
      requestedById?: string;
    } = {};

    // Non-managers can only see their own requests
    if (!canManage || myOnly) {
      where.requestedById = auth.session.user.id;
    }

    // Filter by status if provided
    if (status && ["PENDING", "APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      where.status = status as "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
    }

    const requests = await prisma.knowledgeRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
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

    return apiSuccess({ requests, canManage });
  } catch (error) {
    logger.error("Failed to fetch knowledge requests", error, {
      route: "/api/knowledge-requests",
    });
    return errors.internal("Failed to fetch knowledge requests");
  }
}

/**
 * POST /api/knowledge-requests - Create a new knowledge request
 *
 * Any authenticated user can create a request
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const validation = createRequestSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return errors.validation(firstError?.message || "Invalid request data");
    }

    const data = validation.data;

    const knowledgeRequest = await prisma.knowledgeRequest.create({
      data: {
        title: data.title,
        description: data.description,
        suggestedUrls: data.suggestedUrls,
        categories: data.categories,
        requestedById: auth.session.user.id,
        requestedByEmail: auth.session.user.email,
        requestedByName: auth.session.user.name,
      },
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

    logger.info("Knowledge request created", {
      requestId: knowledgeRequest.id,
      userId: auth.session.user.id,
      title: data.title,
    });

    return apiSuccess({ request: knowledgeRequest }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create knowledge request", error, {
      route: "/api/knowledge-requests",
    });
    return errors.internal("Failed to create knowledge request");
  }
}
