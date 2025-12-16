import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { apiSuccess, errors } from "@/lib/apiResponse";

// Schema for submitting feedback
const feedbackSchema = z.object({
  feature: z.enum(["questions", "chat", "projects"]),
  rating: z.enum(["thumbs_up", "thumbs_down"]),
  comment: z.string().max(5000).optional(),
  question: z.string().min(1).max(50000),
  answer: z.string().min(1).max(100000),
  confidence: z.string().optional(),
  skillsUsed: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })).optional(),
  questionHistoryId: z.string().optional(),
  bulkRowId: z.string().optional(),
  chatSessionId: z.string().optional(),
  model: z.string().optional(),
  usedFallback: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/feedback - Submit feedback on an AI response
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    const result = feedbackSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return errors.validation(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
    }

    const data = result.data;

    const feedback = await prisma.answerFeedback.create({
      data: {
        userId: session?.user?.id ?? null,
        userEmail: session?.user?.email ?? null,
        feature: data.feature,
        rating: data.rating === "thumbs_up" ? "THUMBS_UP" : "THUMBS_DOWN",
        comment: data.comment ?? null,
        question: data.question,
        answer: data.answer,
        confidence: data.confidence ?? null,
        skillsUsed: data.skillsUsed ?? undefined,
        questionHistoryId: data.questionHistoryId ?? null,
        bulkRowId: data.bulkRowId ?? null,
        chatSessionId: data.chatSessionId ?? null,
        model: data.model ?? null,
        usedFallback: data.usedFallback ?? false,
        metadata: data.metadata as object | undefined,
      },
    });

    return apiSuccess({ feedback, success: true }, { status: 201 });
  } catch (error) {
    logger.error("Failed to submit feedback", error, { route: "/api/feedback" });
    return errors.internal("Failed to submit feedback");
  }
}

// GET /api/feedback - Get feedback history (for admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const feature = searchParams.get("feature");
    const rating = searchParams.get("rating");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: Record<string, unknown> = {};
    if (feature) {
      where.feature = feature;
    }
    if (rating) {
      where.rating = rating === "thumbs_up" ? "THUMBS_UP" : "THUMBS_DOWN";
    }

    const [feedback, total] = await Promise.all([
      prisma.answerFeedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.answerFeedback.count({ where }),
    ]);

    return apiSuccess({
      feedback: feedback.map(f => ({
        ...f,
        rating: f.rating === "THUMBS_UP" ? "thumbs_up" : "thumbs_down",
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("Failed to fetch feedback", error, { route: "/api/feedback" });
    return errors.internal("Failed to fetch feedback");
  }
}
