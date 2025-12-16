import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/feedback/stats - Get accuracy statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get overall stats
    const [totalUp, totalDown] = await Promise.all([
      prisma.answerFeedback.count({
        where: { rating: "THUMBS_UP", createdAt: { gte: startDate } },
      }),
      prisma.answerFeedback.count({
        where: { rating: "THUMBS_DOWN", createdAt: { gte: startDate } },
      }),
    ]);

    const totalFeedback = totalUp + totalDown;
    const overallAccuracy = totalFeedback > 0 ? (totalUp / totalFeedback) * 100 : null;

    // Get stats by feature
    const byFeatureRaw = await prisma.answerFeedback.groupBy({
      by: ["feature", "rating"],
      _count: true,
      where: { createdAt: { gte: startDate } },
    });

    // Process by-feature data
    const featureMap: Record<string, { thumbsUp: number; thumbsDown: number }> = {};
    for (const row of byFeatureRaw) {
      if (!featureMap[row.feature]) {
        featureMap[row.feature] = { thumbsUp: 0, thumbsDown: 0 };
      }
      if (row.rating === "THUMBS_UP") {
        featureMap[row.feature].thumbsUp = row._count;
      } else {
        featureMap[row.feature].thumbsDown = row._count;
      }
    }

    const byFeature = Object.entries(featureMap).map(([feature, counts]) => {
      const total = counts.thumbsUp + counts.thumbsDown;
      return {
        feature,
        thumbsUp: counts.thumbsUp,
        thumbsDown: counts.thumbsDown,
        total,
        accuracy: total > 0 ? (counts.thumbsUp / total) * 100 : null,
      };
    });

    // Get daily trend data
    const dailyRaw = await prisma.$queryRaw<
      { date: Date; rating: string; count: bigint }[]
    >`
      SELECT DATE("createdAt") as date, "rating", COUNT(*) as count
      FROM "AnswerFeedback"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt"), "rating"
      ORDER BY date ASC
    `;

    // Process daily data - fill in missing days
    const dailyMap: Record<string, { thumbsUp: number; thumbsDown: number }> = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap[dateStr] = { thumbsUp: 0, thumbsDown: 0 };
    }

    for (const row of dailyRaw) {
      const dateStr = new Date(row.date).toISOString().split("T")[0];
      if (dailyMap[dateStr]) {
        if (row.rating === "THUMBS_UP") {
          dailyMap[dateStr].thumbsUp = Number(row.count);
        } else {
          dailyMap[dateStr].thumbsDown = Number(row.count);
        }
      }
    }

    const daily = Object.entries(dailyMap)
      .map(([date, counts]) => {
        const total = counts.thumbsUp + counts.thumbsDown;
        return {
          date,
          thumbsUp: counts.thumbsUp,
          thumbsDown: counts.thumbsDown,
          total,
          accuracy: total > 0 ? (counts.thumbsUp / total) * 100 : null,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get stats by confidence level
    const byConfidenceRaw = await prisma.answerFeedback.groupBy({
      by: ["confidence", "rating"],
      _count: true,
      where: {
        createdAt: { gte: startDate },
        confidence: { not: null },
      },
    });

    const confidenceMap: Record<string, { thumbsUp: number; thumbsDown: number }> = {};
    for (const row of byConfidenceRaw) {
      const conf = row.confidence || "unknown";
      if (!confidenceMap[conf]) {
        confidenceMap[conf] = { thumbsUp: 0, thumbsDown: 0 };
      }
      if (row.rating === "THUMBS_UP") {
        confidenceMap[conf].thumbsUp = row._count;
      } else {
        confidenceMap[conf].thumbsDown = row._count;
      }
    }

    const byConfidence = Object.entries(confidenceMap).map(([confidence, counts]) => {
      const total = counts.thumbsUp + counts.thumbsDown;
      return {
        confidence,
        thumbsUp: counts.thumbsUp,
        thumbsDown: counts.thumbsDown,
        total,
        accuracy: total > 0 ? (counts.thumbsUp / total) * 100 : null,
      };
    });

    // Get fallback vs skills comparison
    const [fallbackUp, fallbackDown, skillsUp, skillsDown] = await Promise.all([
      prisma.answerFeedback.count({
        where: { rating: "THUMBS_UP", usedFallback: true, createdAt: { gte: startDate } },
      }),
      prisma.answerFeedback.count({
        where: { rating: "THUMBS_DOWN", usedFallback: true, createdAt: { gte: startDate } },
      }),
      prisma.answerFeedback.count({
        where: { rating: "THUMBS_UP", usedFallback: false, createdAt: { gte: startDate } },
      }),
      prisma.answerFeedback.count({
        where: { rating: "THUMBS_DOWN", usedFallback: false, createdAt: { gte: startDate } },
      }),
    ]);

    const fallbackTotal = fallbackUp + fallbackDown;
    const skillsTotal = skillsUp + skillsDown;

    const sourceComparison = {
      fallback: {
        thumbsUp: fallbackUp,
        thumbsDown: fallbackDown,
        total: fallbackTotal,
        accuracy: fallbackTotal > 0 ? (fallbackUp / fallbackTotal) * 100 : null,
      },
      skills: {
        thumbsUp: skillsUp,
        thumbsDown: skillsDown,
        total: skillsTotal,
        accuracy: skillsTotal > 0 ? (skillsUp / skillsTotal) * 100 : null,
      },
    };

    // Get recent negative feedback for review
    const recentNegative = await prisma.answerFeedback.findMany({
      where: {
        rating: "THUMBS_DOWN",
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        feature: true,
        question: true,
        answer: true,
        confidence: true,
        comment: true,
        usedFallback: true,
        skillsUsed: true,
        createdAt: true,
        userEmail: true,
      },
    });

    return apiSuccess({
      summary: {
        thumbsUp: totalUp,
        thumbsDown: totalDown,
        total: totalFeedback,
        accuracy: overallAccuracy,
      },
      byFeature,
      byConfidence,
      sourceComparison,
      daily,
      recentNegative,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    logger.error("Error fetching feedback stats", error, { route: "/api/feedback/stats" });
    return errors.internal("Failed to fetch feedback stats");
  }
}
