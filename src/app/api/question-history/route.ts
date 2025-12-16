import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET - Fetch question history for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return apiSuccess({ history: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const history = await prisma.questionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        question: true,
        response: true,
        confidence: true,
        sources: true,
        reasoning: true,
        inference: true,
        remarks: true,
        skillsUsed: true,
        createdAt: true,
        reviewStatus: true,
        reviewNote: true,
        reviewedBy: true,
        flaggedForReview: true,
        flaggedAt: true,
        flaggedBy: true,
        flagNote: true,
        reviewRequestedAt: true,
        reviewRequestedBy: true,
        assignedReviewerId: true,
        assignedReviewerName: true,
      },
    });

    const total = await prisma.questionHistory.count({
      where: { userId },
    });

    return apiSuccess({ history, total });
  } catch (error) {
    logger.error("Error fetching question history", error, { route: "/api/question-history" });
    return errors.internal("Failed to fetch question history");
  }
}

// POST - Save a new question to history
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    // Allow saving even without auth (for anonymous users)
    const body = await request.json();
    const { question, response, confidence, sources, reasoning, inference, remarks, skillsUsed } = body;

    if (!question || !response) {
      return errors.badRequest("Question and response are required");
    }

    const entry = await prisma.questionHistory.create({
      data: {
        userId: userId || null,
        userEmail: userEmail || null,
        question,
        response,
        confidence: confidence || null,
        sources: sources || null,
        reasoning: reasoning || null,
        inference: inference || null,
        remarks: remarks || null,
        skillsUsed: skillsUsed || null,
      },
    });

    return apiSuccess({ entry });
  } catch (error) {
    logger.error("Error saving question history", error, { route: "/api/question-history" });
    return errors.internal("Failed to save question history");
  }
}

// DELETE - Clear all history for current user
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return errors.unauthorized();
    }

    await prisma.questionHistory.deleteMany({
      where: { userId },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Error clearing question history", error, { route: "/api/question-history" });
    return errors.internal("Failed to clear question history");
  }
}
