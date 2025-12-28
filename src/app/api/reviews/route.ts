import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/reviews - Get pending reviews across all projects, questions, collateral, and chat
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "REQUESTED"; // Default to pending
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const assignedTo = searchParams.get("assignedTo"); // Filter by assigned reviewer ID
    const includeUnassigned = searchParams.get("includeUnassigned") !== "false"; // Include unassigned by default
    const source = searchParams.get("source"); // "projects", "questions", "collateral", "chat", or null for all
    const type = searchParams.get("type"); // "review", "flagged", or null for both

    // Build base where clause for assignedTo filtering
    const assignedToClause: Record<string, unknown> = {};
    if (assignedTo) {
      if (includeUnassigned) {
        assignedToClause.OR = [
          { assignedReviewerId: assignedTo },
          { assignedReviewerId: null },
        ];
      } else {
        assignedToClause.assignedReviewerId = assignedTo;
      }
    }

    // Build where clause for BulkRow based on type
    const rowWhereClause: Record<string, unknown> = { ...assignedToClause };
    if (type === "flagged") {
      // Flagged items only (exclude resolved flags)
      rowWhereClause.flaggedForReview = true;
      rowWhereClause.flagResolved = { not: true };
    } else if (type === "resolved") {
      // Resolved flags only
      rowWhereClause.flaggedForReview = true;
      rowWhereClause.flagResolved = true;
    } else if (type === "review") {
      // Review requests only
      rowWhereClause.reviewStatus = status as "REQUESTED" | "APPROVED" | "CORRECTED";
    } else {
      // Both: review requests OR flagged items (exclude resolved flags)
      rowWhereClause.OR = [
        { reviewStatus: status as "REQUESTED" | "APPROVED" | "CORRECTED" },
        { flaggedForReview: true, flagResolved: { not: true } },
      ];
    }

    // Build where clause for QuestionHistory (same pattern)
    const questionWhereClause: Record<string, unknown> = { ...assignedToClause };
    if (type === "flagged") {
      // Flagged items only (exclude resolved flags)
      questionWhereClause.flaggedForReview = true;
      questionWhereClause.flagResolved = { not: true };
    } else if (type === "resolved") {
      // Resolved flags only
      questionWhereClause.flaggedForReview = true;
      questionWhereClause.flagResolved = true;
    } else if (type === "review") {
      questionWhereClause.reviewStatus = status as "REQUESTED" | "APPROVED" | "CORRECTED";
    } else {
      // Both: review requests OR flagged items (exclude resolved flags)
      questionWhereClause.OR = [
        { reviewStatus: status as "REQUESTED" | "APPROVED" | "CORRECTED" },
        { flaggedForReview: true, flagResolved: { not: true } },
      ];
    }

    // Build where clause for CollateralOutput (same pattern)
    const collateralWhereClause: Record<string, unknown> = { ...assignedToClause };
    if (type === "flagged") {
      collateralWhereClause.flaggedForReview = true;
      collateralWhereClause.flagResolved = { not: true };
    } else if (type === "resolved") {
      collateralWhereClause.flaggedForReview = true;
      collateralWhereClause.flagResolved = true;
    } else if (type === "review") {
      collateralWhereClause.reviewStatus = status as "REQUESTED" | "APPROVED" | "CORRECTED";
    } else {
      collateralWhereClause.OR = [
        { reviewStatus: status as "REQUESTED" | "APPROVED" | "CORRECTED" },
        { flaggedForReview: true, flagResolved: { not: true } },
      ];
    }

    // Fetch from sources based on filter
    const shouldFetchRows = !source || source === "projects";
    const shouldFetchQuestions = !source || source === "questions";
    const shouldFetchCollateral = !source || source === "collateral";

    // Get rows that need review (from Projects)
    const pendingRows = shouldFetchRows
      ? await prisma.bulkRow.findMany({
          where: rowWhereClause,
          include: {
            project: {
              select: {
                id: true,
                name: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            reviewRequestedAt: "desc",
          },
          take: limit,
        })
      : [];

    // Get questions that need review (from Quick Questions)
    const pendingQuestions = shouldFetchQuestions
      ? await prisma.questionHistory.findMany({
          where: questionWhereClause,
          orderBy: {
            reviewRequestedAt: "desc",
          },
          take: limit,
        })
      : [];

    // Get collateral that needs review (from Collateral Builder)
    const pendingCollateral = shouldFetchCollateral
      ? await prisma.collateralOutput.findMany({
          where: collateralWhereClause,
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            reviewRequestedAt: "desc",
          },
          take: limit,
        })
      : [];

    // Transform rows to a cleaner format
    const projectReviews = pendingRows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      question: row.question,
      response: row.response,
      confidence: row.confidence,
      reviewStatus: row.reviewStatus,
      // Review workflow fields
      reviewRequestedAt: row.reviewRequestedAt?.toISOString(),
      reviewRequestedBy: row.reviewRequestedBy,
      reviewNote: row.reviewNote,
      assignedReviewerId: row.assignedReviewerId,
      assignedReviewerName: row.assignedReviewerName,
      reviewedAt: row.reviewedAt?.toISOString(),
      reviewedBy: row.reviewedBy,
      // Flagging fields (separate)
      flaggedForReview: row.flaggedForReview,
      flaggedAt: row.flaggedAt?.toISOString(),
      flaggedBy: row.flaggedBy,
      flagNote: row.flagNote,
      // Flag resolution fields
      flagResolved: row.flagResolved,
      flagResolvedAt: row.flagResolvedAt?.toISOString(),
      flagResolvedBy: row.flagResolvedBy,
      flagResolutionNote: row.flagResolutionNote,
      project: row.project,
      source: "project" as const,
    }));

    // Transform questions to a cleaner format
    const questionReviews = pendingQuestions.map((q) => ({
      id: q.id,
      rowNumber: null,
      question: q.question,
      response: q.response,
      confidence: q.confidence,
      reviewStatus: q.reviewStatus,
      // Review workflow fields
      reviewRequestedAt: q.reviewRequestedAt?.toISOString(),
      reviewRequestedBy: q.reviewRequestedBy,
      reviewNote: q.reviewNote,
      assignedReviewerId: q.assignedReviewerId,
      assignedReviewerName: q.assignedReviewerName,
      reviewedAt: q.reviewedAt?.toISOString(),
      reviewedBy: q.reviewedBy,
      // Flagging fields (separate)
      flaggedForReview: q.flaggedForReview,
      flaggedAt: q.flaggedAt?.toISOString(),
      flaggedBy: q.flaggedBy,
      flagNote: q.flagNote,
      // Flag resolution fields
      flagResolved: q.flagResolved,
      flagResolvedAt: q.flagResolvedAt?.toISOString(),
      flagResolvedBy: q.flagResolvedBy,
      flagResolutionNote: q.flagResolutionNote,
      project: null,
      source: "questions" as const,
      createdAt: q.createdAt?.toISOString(),
      userEmail: q.userEmail,
    }));

    // Transform collateral to a cleaner format
    const collateralReviews = pendingCollateral.map((c) => ({
      id: c.id,
      rowNumber: null,
      title: c.name,
      content: c.generatedMarkdown || "",
      reviewStatus: c.reviewStatus,
      // Review workflow fields
      reviewRequestedAt: c.reviewRequestedAt?.toISOString(),
      reviewRequestedBy: c.reviewRequestedBy,
      reviewNote: c.reviewNote,
      assignedReviewerId: c.assignedReviewerId,
      assignedReviewerName: c.assignedReviewerName,
      reviewedAt: c.reviewedAt?.toISOString(),
      reviewedBy: c.reviewedBy,
      // Flagging fields
      flaggedForReview: c.flaggedForReview,
      flaggedAt: c.flaggedAt?.toISOString(),
      flaggedBy: c.flaggedBy,
      flagNote: c.flagNote,
      // Flag resolution fields
      flagResolved: c.flagResolved,
      flagResolvedAt: c.flagResolvedAt?.toISOString(),
      flagResolvedBy: c.flagResolvedBy,
      flagResolutionNote: c.flagResolutionNote,
      // Additional context (use relations instead of removed snapshot columns)
      templateId: c.templateId,
      customerId: c.customerId,
      customerName: c.customer?.name || null,
      owner: c.owner,
      customer: c.customer,
      project: null,
      source: "collateral" as const,
      createdAt: c.createdAt?.toISOString(),
    }));

    // Combine and sort by most recent date (reviewRequestedAt or flaggedAt)
    const reviews = [...projectReviews, ...questionReviews, ...collateralReviews]
      .sort((a, b) => {
        const dateA = Math.max(
          a.reviewRequestedAt ? new Date(a.reviewRequestedAt).getTime() : 0,
          a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0
        );
        const dateB = Math.max(
          b.reviewRequestedAt ? new Date(b.reviewRequestedAt).getTime() : 0,
          b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0
        );
        return dateB - dateA;
      })
      .slice(0, limit);

    // Get counts for badges
    // Review counts (by reviewStatus)
    const rowReviewCounts = await prisma.bulkRow.groupBy({
      by: ["reviewStatus"],
      _count: true,
      where: {
        ...assignedToClause,
        reviewStatus: {
          in: ["REQUESTED", "APPROVED", "CORRECTED"],
        },
      },
    });

    const questionReviewCounts = await prisma.questionHistory.groupBy({
      by: ["reviewStatus"],
      _count: true,
      where: {
        ...assignedToClause,
        reviewStatus: {
          in: ["REQUESTED", "APPROVED", "CORRECTED"],
        },
      },
    });

    const collateralReviewCounts = await prisma.collateralOutput.groupBy({
      by: ["reviewStatus"],
      _count: true,
      where: {
        ...assignedToClause,
        reviewStatus: {
          in: ["REQUESTED", "APPROVED", "CORRECTED"],
        },
      },
    });

    // Flagged counts (exclude resolved flags)
    const rowFlaggedCount = await prisma.bulkRow.count({
      where: {
        ...assignedToClause,
        flaggedForReview: true,
        flagResolved: { not: true },
      },
    });

    const questionFlaggedCount = await prisma.questionHistory.count({
      where: {
        ...assignedToClause,
        flaggedForReview: true,
        flagResolved: { not: true },
      },
    });

    const collateralFlaggedCount = await prisma.collateralOutput.count({
      where: {
        ...assignedToClause,
        flaggedForReview: true,
        flagResolved: { not: true },
      },
    });

    // Resolved flag counts
    const rowResolvedCount = await prisma.bulkRow.count({
      where: {
        ...assignedToClause,
        flaggedForReview: true,
        flagResolved: true,
      },
    });

    const questionResolvedCount = await prisma.questionHistory.count({
      where: {
        ...assignedToClause,
        flaggedForReview: true,
        flagResolved: true,
      },
    });

    const collateralResolvedCount = await prisma.collateralOutput.count({
      where: {
        ...assignedToClause,
        flaggedForReview: true,
        flagResolved: true,
      },
    });

    const countMap = {
      pending:
        (rowReviewCounts.find((c) => c.reviewStatus === "REQUESTED")?._count || 0) +
        (questionReviewCounts.find((c) => c.reviewStatus === "REQUESTED")?._count || 0) +
        (collateralReviewCounts.find((c) => c.reviewStatus === "REQUESTED")?._count || 0),
      approved:
        (rowReviewCounts.find((c) => c.reviewStatus === "APPROVED")?._count || 0) +
        (questionReviewCounts.find((c) => c.reviewStatus === "APPROVED")?._count || 0) +
        (collateralReviewCounts.find((c) => c.reviewStatus === "APPROVED")?._count || 0),
      corrected:
        (rowReviewCounts.find((c) => c.reviewStatus === "CORRECTED")?._count || 0) +
        (questionReviewCounts.find((c) => c.reviewStatus === "CORRECTED")?._count || 0) +
        (collateralReviewCounts.find((c) => c.reviewStatus === "CORRECTED")?._count || 0),
      flagged: rowFlaggedCount + questionFlaggedCount + collateralFlaggedCount,
      resolved: rowResolvedCount + questionResolvedCount + collateralResolvedCount,
    };

    return apiSuccess({
      reviews,
      counts: countMap,
    });
  } catch (error) {
    logger.error("Error fetching reviews", error, { route: "/api/reviews" });
    return errors.internal("Failed to fetch reviews");
  }
}
