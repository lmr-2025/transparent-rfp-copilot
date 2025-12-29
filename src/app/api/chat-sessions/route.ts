import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET - Fetch chat sessions for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiSuccess({ sessions: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        messages: true,
        skillsUsed: true,
        documentsUsed: true,
        customersUsed: true, // Deprecated - kept for backwards compatibility
        urlsUsed: true,
        createdAt: true,
        updatedAt: true,
        // Include proper relation data
        customers: {
          include: {
            customer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const total = await prisma.chatSession.count({
      where: { userId },
    });

    return apiSuccess({ sessions, total });
  } catch (error) {
    logger.error("Failed to fetch chat sessions", error, { route: "/api/chat-sessions" });
    return errors.internal("Failed to fetch chat sessions");
  }
}

// POST - Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    const body = await request.json();
    const { title, messages, skillsUsed, documentsUsed, customersUsed, urlsUsed } = body;

    if (!messages || !Array.isArray(messages)) {
      return errors.badRequest("Messages array is required");
    }

    // Auto-generate title from first user message if not provided
    const autoTitle = title || messages.find((m: { role: string }) => m.role === "user")?.content?.slice(0, 100) || "New Chat";

    // Extract customer IDs for the join table relation
    const customerIds: string[] = Array.isArray(customersUsed)
      ? customersUsed
          .filter((c: { id?: string }) => c && c.id)
          .map((c: { id: string }) => c.id)
      : [];

    const chatSession = await prisma.chatSession.create({
      data: {
        userId: userId || null,
        userEmail: userEmail || null,
        title: autoTitle,
        messages,
        skillsUsed: skillsUsed || null,
        documentsUsed: documentsUsed || null,
        customersUsed: customersUsed || null, // Keep for backwards compatibility (deprecated)
        urlsUsed: urlsUsed || null,
        // Create ChatSessionCustomer join table entries
        customers: customerIds.length > 0 ? {
          create: customerIds.map((customerId) => ({
            customerId,
          })),
        } : undefined,
      },
      include: {
        customers: {
          include: {
            customer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return apiSuccess({ session: chatSession }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create chat session", error, { route: "/api/chat-sessions" });
    return errors.internal("Failed to create chat session");
  }
}

// DELETE - Clear all chat sessions for current user
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return errors.unauthorized();
    }

    await prisma.chatSession.deleteMany({
      where: { userId },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to clear chat sessions", error, { route: "/api/chat-sessions" });
    return errors.internal("Failed to clear chat sessions");
  }
}
