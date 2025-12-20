import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// POST /api/chat/feedback - Save feedback for a chat message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    const body = await request.json();
    const {
      messageId,
      sessionId,
      rating,
      comment,
      flaggedForReview,
      flagNote,
      reviewRequested,
      reviewerId,
      reviewerName,
      reviewNote,
      sendNow,
    } = body;

    if (!messageId) {
      return errors.badRequest("Message ID is required");
    }

    // Upsert the feedback record
    const feedback = await prisma.chatFeedback.upsert({
      where: {
        messageId_sessionId: {
          messageId,
          sessionId: sessionId || "no-session",
        },
      },
      update: {
        rating: rating ?? undefined,
        comment: comment ?? undefined,
        flaggedForReview: flaggedForReview ?? undefined,
        flagNote: flagNote ?? undefined,
        reviewRequested: reviewRequested ?? undefined,
        reviewerId: reviewerId ?? undefined,
        reviewerName: reviewerName ?? undefined,
        reviewNote: reviewNote ?? undefined,
        sendNow: sendNow ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        messageId,
        sessionId: sessionId || "no-session",
        userId: session.user.id,
        orgId: null, // User model doesn't have orgId
        rating: rating ?? null,
        comment: comment ?? null,
        flaggedForReview: flaggedForReview ?? false,
        flagNote: flagNote ?? null,
        reviewRequested: reviewRequested ?? false,
        reviewerId: reviewerId ?? null,
        reviewerName: reviewerName ?? null,
        reviewNote: reviewNote ?? null,
        sendNow: sendNow ?? false,
      },
    });

    return apiSuccess({ feedback });
  } catch (error) {
    logger.error("Error saving chat feedback", error, { route: "/api/chat/feedback" });
    return errors.internal("Failed to save feedback");
  }
}

// GET /api/chat/feedback - Get feedback for a session or message
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const messageId = searchParams.get("messageId");

    if (!sessionId && !messageId) {
      return errors.badRequest("Session ID or Message ID is required");
    }

    const where: { sessionId?: string; messageId?: string; userId: string } = {
      userId: session.user.id,
    };

    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (messageId) {
      where.messageId = messageId;
    }

    const feedbacks = await prisma.chatFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ feedbacks });
  } catch (error) {
    logger.error("Error fetching chat feedback", error, { route: "/api/chat/feedback" });
    return errors.internal("Failed to fetch feedback");
  }
}
