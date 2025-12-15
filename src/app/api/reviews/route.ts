import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";

// GET /api/reviews - Get pending reviews across all projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "REQUESTED"; // Default to pending
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get rows that need review
    const pendingRows = await prisma.bulkRow.findMany({
      where: {
        reviewStatus: status as "REQUESTED" | "APPROVED" | "CORRECTED",
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            customerName: true,
          },
        },
      },
      orderBy: {
        flaggedAt: "desc",
      },
      take: limit,
    });

    // Transform to a cleaner format
    const reviews = pendingRows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      question: row.question,
      response: row.response,
      confidence: row.confidence,
      reviewStatus: row.reviewStatus,
      flaggedAt: row.flaggedAt?.toISOString(),
      flaggedBy: row.flaggedBy,
      flagNote: row.flagNote,
      reviewedAt: row.reviewedAt?.toISOString(),
      reviewedBy: row.reviewedBy,
      project: row.project,
    }));

    // Also get counts for the badge
    const counts = await prisma.bulkRow.groupBy({
      by: ["reviewStatus"],
      _count: true,
      where: {
        reviewStatus: {
          in: ["REQUESTED", "APPROVED", "CORRECTED"],
        },
      },
    });

    const countMap = {
      pending: counts.find((c) => c.reviewStatus === "REQUESTED")?._count || 0,
      approved: counts.find((c) => c.reviewStatus === "APPROVED")?._count || 0,
      corrected: counts.find((c) => c.reviewStatus === "CORRECTED")?._count || 0,
    };

    return apiSuccess({
      reviews,
      counts: countMap,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return errors.internal("Failed to fetch reviews");
  }
}
