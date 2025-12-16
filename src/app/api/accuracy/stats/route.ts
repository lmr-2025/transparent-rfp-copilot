import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/accuracy/stats - Get AI accuracy statistics from implicit signals
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

    // Get all completed rows with responses in the time period (from Projects)
    const rows = await prisma.bulkRow.findMany({
      where: {
        status: "COMPLETED",
        project: {
          createdAt: { gte: startDate },
        },
      },
      select: {
        id: true,
        confidence: true,
        reviewStatus: true,
        userEditedAnswer: true,
        usedSkills: true,
        flaggedForReview: true,
        project: {
          select: {
            createdAt: true,
          },
        },
      },
    });

    // Get question history entries (from Quick Questions)
    const questionHistory = await prisma.questionHistory.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        confidence: true,
        reviewStatus: true,
        userEditedAnswer: true,
        skillsUsed: true,
        createdAt: true,
      },
    });

    // Calculate confidence distribution
    const confidenceCounts = {
      High: 0,
      Medium: 0,
      Low: 0,
      Unknown: 0,
    };

    // Track corrections by confidence level
    const correctionsByConfidence: Record<string, { total: number; corrected: number }> = {
      High: { total: 0, corrected: 0 },
      Medium: { total: 0, corrected: 0 },
      Low: { total: 0, corrected: 0 },
      Unknown: { total: 0, corrected: 0 },
    };

    // Track review outcomes
    const reviewOutcomes = {
      approved: 0,
      corrected: 0,
      pending: 0,
    };

    // Track flagged answers
    let flaggedCount = 0;

    // Track skills involved in corrections
    const skillCorrections: Record<string, { skillId: string; title: string; corrections: number; total: number }> = {};

    // Helper function to process an answer entry (works for both BulkRow and QuestionHistory)
    function processAnswer(entry: {
      confidence: string | null;
      reviewStatus: string;
      userEditedAnswer: string | null;
      usedSkills: unknown;
      flaggedForReview?: boolean;
    }) {
      // Normalize confidence
      const conf = entry.confidence?.trim() || "Unknown";
      const normalizedConf = conf === "High" || conf === "Medium" || conf === "Low" ? conf : "Unknown";

      confidenceCounts[normalizedConf]++;
      correctionsByConfidence[normalizedConf].total++;

      // Check if corrected (has userEditedAnswer or reviewStatus is CORRECTED)
      const wasCorrected = entry.reviewStatus === "CORRECTED" || (entry.userEditedAnswer && entry.userEditedAnswer.length > 0);
      if (wasCorrected) {
        correctionsByConfidence[normalizedConf].corrected++;

        // Track which skills were involved in corrections
        const skills = entry.usedSkills;
        if (skills && Array.isArray(skills)) {
          for (const skill of skills as { id: string; title: string }[]) {
            if (!skillCorrections[skill.id]) {
              skillCorrections[skill.id] = { skillId: skill.id, title: skill.title, corrections: 0, total: 0 };
            }
            skillCorrections[skill.id].corrections++;
          }
        }
      }

      // Track all skill usage
      const skills = entry.usedSkills;
      if (skills && Array.isArray(skills)) {
        for (const skill of skills as { id: string; title: string }[]) {
          if (!skillCorrections[skill.id]) {
            skillCorrections[skill.id] = { skillId: skill.id, title: skill.title, corrections: 0, total: 0 };
          }
          skillCorrections[skill.id].total++;
        }
      }

      // Track review outcomes
      if (entry.reviewStatus === "APPROVED") {
        reviewOutcomes.approved++;
      } else if (entry.reviewStatus === "CORRECTED") {
        reviewOutcomes.corrected++;
      } else if (entry.reviewStatus === "REQUESTED") {
        reviewOutcomes.pending++;
      }

      // Track flagged (only for BulkRow)
      if (entry.flaggedForReview) {
        flaggedCount++;
      }
    }

    // Process BulkRow entries (from Projects)
    for (const row of rows) {
      processAnswer({
        confidence: row.confidence,
        reviewStatus: row.reviewStatus,
        userEditedAnswer: row.userEditedAnswer,
        usedSkills: row.usedSkills,
        flaggedForReview: row.flaggedForReview,
      });
    }

    // Process QuestionHistory entries (from Quick Questions)
    for (const qh of questionHistory) {
      processAnswer({
        confidence: qh.confidence,
        reviewStatus: qh.reviewStatus,
        userEditedAnswer: qh.userEditedAnswer,
        usedSkills: qh.skillsUsed,
      });
    }

    // Calculate correction rates by confidence
    const correctionRates = Object.entries(correctionsByConfidence).map(([confidence, data]) => ({
      confidence,
      total: data.total,
      corrected: data.corrected,
      correctionRate: data.total > 0 ? (data.corrected / data.total) * 100 : null,
    }));

    // Get skills with highest correction rates (potential knowledge gaps)
    const skillsNeedingAttention = Object.values(skillCorrections)
      .filter(s => s.total >= 3) // Only skills used at least 3 times
      .map(s => ({
        ...s,
        correctionRate: s.total > 0 ? (s.corrections / s.total) * 100 : 0,
      }))
      .filter(s => s.correctionRate > 10) // More than 10% correction rate
      .sort((a, b) => b.correctionRate - a.correctionRate)
      .slice(0, 10);

    // Get daily breakdown
    const dailyRaw = await prisma.$queryRaw<
      { date: Date; confidence: string; review_status: string; count: bigint }[]
    >`
      SELECT
        DATE(p."createdAt") as date,
        br.confidence,
        br."reviewStatus" as review_status,
        COUNT(*) as count
      FROM "BulkRow" br
      JOIN "BulkProject" p ON br."projectId" = p.id
      WHERE br.status = 'COMPLETED'
        AND p."createdAt" >= ${startDate}
      GROUP BY DATE(p."createdAt"), br.confidence, br."reviewStatus"
      ORDER BY date ASC
    `;

    // Process daily data
    const dailyMap: Record<string, { high: number; medium: number; low: number; corrected: number; total: number }> = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap[dateStr] = { high: 0, medium: 0, low: 0, corrected: 0, total: 0 };
    }

    for (const row of dailyRaw) {
      const dateStr = new Date(row.date).toISOString().split("T")[0];
      if (dailyMap[dateStr]) {
        const count = Number(row.count);
        dailyMap[dateStr].total += count;

        const conf = row.confidence?.trim() || "";
        if (conf === "High") dailyMap[dateStr].high += count;
        else if (conf === "Medium") dailyMap[dateStr].medium += count;
        else if (conf === "Low") dailyMap[dateStr].low += count;

        if (row.review_status === "CORRECTED") {
          dailyMap[dateStr].corrected += count;
        }
      }
    }

    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        ...data,
        accuracyRate: data.total > 0 ? ((data.total - data.corrected) / data.total) * 100 : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent corrections for review (from Projects)
    const recentProjectCorrections = await prisma.bulkRow.findMany({
      where: {
        OR: [
          { reviewStatus: "CORRECTED" },
          { userEditedAnswer: { not: null } },
        ],
        project: {
          createdAt: { gte: startDate },
        },
      },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      select: {
        id: true,
        question: true,
        response: true,
        userEditedAnswer: true,
        confidence: true,
        usedSkills: true,
        reviewedAt: true,
        reviewedBy: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get recent corrections from Quick Questions
    const recentQuestionCorrections = await prisma.questionHistory.findMany({
      where: {
        OR: [
          { reviewStatus: "CORRECTED" },
          { userEditedAnswer: { not: null } },
        ],
        createdAt: { gte: startDate },
      },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      select: {
        id: true,
        question: true,
        response: true,
        userEditedAnswer: true,
        confidence: true,
        skillsUsed: true,
        reviewedAt: true,
        reviewedBy: true,
      },
    });

    // Combine and sort recent corrections
    const recentCorrections = [
      ...recentProjectCorrections.map(r => ({
        id: r.id,
        question: r.question,
        response: r.response,
        userEditedAnswer: r.userEditedAnswer,
        confidence: r.confidence,
        usedSkills: r.usedSkills as { id: string; title: string }[] | null,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        source: "project" as const,
        project: r.project,
      })),
      ...recentQuestionCorrections.map(r => ({
        id: r.id,
        question: r.question,
        response: r.response,
        userEditedAnswer: r.userEditedAnswer,
        confidence: r.confidence,
        usedSkills: r.skillsUsed as { id: string; title: string }[] | null,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        source: "questions" as const,
        project: null,
      })),
    ]
      .sort((a, b) => {
        const dateA = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
        const dateB = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 20);

    // Summary stats (includes both Projects and Quick Questions)
    const totalAnswers = rows.length + questionHistory.length;
    const totalCorrected = correctionsByConfidence.High.corrected +
                          correctionsByConfidence.Medium.corrected +
                          correctionsByConfidence.Low.corrected +
                          correctionsByConfidence.Unknown.corrected;
    const overallAccuracy = totalAnswers > 0 ? ((totalAnswers - totalCorrected) / totalAnswers) * 100 : null;

    return apiSuccess({
      summary: {
        totalAnswers,
        totalCorrected,
        overallAccuracy,
        flaggedCount,
        reviewsPending: reviewOutcomes.pending,
        reviewsApproved: reviewOutcomes.approved,
        reviewsCorrected: reviewOutcomes.corrected,
      },
      confidenceDistribution: confidenceCounts,
      correctionRates,
      skillsNeedingAttention,
      daily,
      recentCorrections,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    logger.error("Error fetching accuracy stats", error, { route: "/api/accuracy/stats" });
    return errors.internal("Failed to fetch accuracy stats");
  }
}
