import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import type { QuestionLogEntry, QuestionLogStats, QuestionLogStatus } from "@/app/admin/question-log/types";

// GET /api/question-log - Get all questions (audit log)
// Status options:
// - "answered" (default): All questions with responses (COMPLETED status or has response)
// - "verified": Only formally verified questions
// - "corrected": Only corrected questions
// - "locked": Only locked questions (project rows only)
// - "resolved": Only flag-resolved questions
// - "all": Everything including in-progress/pending
// User filter:
// - "userId": Filter by user ID who asked the question
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "answered"; // Default to answered
    const source = searchParams.get("source") || "all"; // project, questions, all
    const userId = searchParams.get("userId")?.trim() || ""; // Filter by user who asked
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Build where clauses for BulkRow (project questions)
    const buildRowWhereClause = () => {
      const conditions: Record<string, unknown>[] = [];

      // Status-based filtering
      if (status === "verified") {
        conditions.push({ reviewStatus: "APPROVED" });
      } else if (status === "corrected") {
        conditions.push({ reviewStatus: "CORRECTED" });
      } else if (status === "locked") {
        conditions.push({ locked: true });
      } else if (status === "resolved") {
        conditions.push({ flagResolved: true });
      } else if (status === "answered") {
        // All completed questions (has a non-empty response)
        conditions.push({ status: "COMPLETED" });
      }
      // "all" - no status filter

      // Add user filter (by askedById only - new rows will have this populated)
      if (userId) {
        conditions.push({ askedById: userId });
      }

      // Add search filter
      if (search) {
        conditions.push({
          OR: [
            { question: { contains: search, mode: "insensitive" } },
            { response: { contains: search, mode: "insensitive" } },
          ],
        });
      }

      return conditions.length > 0 ? { AND: conditions } : {};
    };

    // Build where clauses for QuestionHistory
    const buildQuestionWhereClause = () => {
      const conditions: Record<string, unknown>[] = [];

      // Status-based filtering
      if (status === "verified") {
        conditions.push({ reviewStatus: "APPROVED" });
      } else if (status === "corrected") {
        conditions.push({ reviewStatus: "CORRECTED" });
      } else if (status === "locked") {
        // No locked for QuestionHistory - return nothing
        return { id: "impossible-match" };
      } else if (status === "resolved") {
        conditions.push({ flagResolved: true });
      } else if (status === "answered") {
        // All questions with responses (QuestionHistory entries always have responses)
        conditions.push({ response: { not: "" } });
      }
      // "all" - no status filter

      // Add user filter
      if (userId) {
        conditions.push({ userId });
      }

      // Add search filter
      if (search) {
        conditions.push({
          OR: [
            { question: { contains: search, mode: "insensitive" } },
            { response: { contains: search, mode: "insensitive" } },
          ],
        });
      }

      return conditions.length > 0 ? { AND: conditions } : {};
    };

    const shouldFetchRows = source === "all" || source === "project";
    const shouldFetchQuestions = source === "all" || source === "questions";

    // Fetch from BulkRow (project questions) with safety limit
    // We fetch more than the page limit since we merge two sources and sort in memory
    const fetchLimit = Math.min(limit * 10, 1000); // Cap at 1000 per source

    const rows = shouldFetchRows
      ? await prisma.bulkRow.findMany({
          where: buildRowWhereClause(),
          take: fetchLimit,
          orderBy: { createdAt: "desc" },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                customerName: true,
                ownerId: true,
                ownerName: true,
                createdAt: true,
              },
            },
          },
        })
      : [];

    // Fetch from QuestionHistory with safety limit
    const questions = shouldFetchQuestions
      ? await prisma.questionHistory.findMany({
          where: buildQuestionWhereClause(),
          take: fetchLimit,
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Helper to determine status of an entry
    const getStatus = (item: {
      reviewStatus?: string | null;
      locked?: boolean;
      flagResolved?: boolean;
      status?: string; // BulkRow status
      response?: string;
    }): QuestionLogStatus => {
      // Formal review statuses take precedence
      if (item.reviewStatus === "APPROVED") return "verified";
      if (item.reviewStatus === "CORRECTED") return "corrected";
      if (item.locked) return "locked";
      if (item.flagResolved) return "resolved";
      // For completed/answered items without formal review
      if (item.status === "COMPLETED" || (item.response && item.response.trim() !== "")) {
        return "answered";
      }
      return "pending"; // In progress or not yet answered
    };

    // Helper to get finalized date
    const getFinalizedAt = (item: {
      reviewedAt?: Date | null;
      flagResolvedAt?: Date | null;
      createdAt?: Date | null;
    }): string => {
      if (item.reviewedAt) return item.reviewedAt.toISOString();
      if (item.flagResolvedAt) return item.flagResolvedAt.toISOString();
      return item.createdAt?.toISOString() || new Date().toISOString();
    };

    // Helper to get created date (for BulkRow, use project's lastModifiedAt or fallback)
    const getCreatedAt = (item: {
      createdAt?: Date | null;
      reviewedAt?: Date | null;
      flagResolvedAt?: Date | null;
    }): string => {
      if (item.createdAt) return item.createdAt.toISOString();
      // Fallback for BulkRow which doesn't have createdAt
      if (item.reviewedAt) return item.reviewedAt.toISOString();
      if (item.flagResolvedAt) return item.flagResolvedAt.toISOString();
      return new Date().toISOString();
    };

    // Transform rows to QuestionLogEntry
    const rowEntries: QuestionLogEntry[] = rows.map((row) => ({
      id: row.id,
      source: "project" as const,
      projectId: row.project?.id,
      projectName: row.project?.name || row.project?.customerName || "Unknown Project",
      customerName: row.project?.customerName || undefined,
      question: row.question,
      response: row.response,
      confidence: row.confidence || undefined,
      sources: row.sources || undefined,
      reasoning: row.reasoning || undefined,
      inference: row.inference || undefined,
      status: getStatus(row),
      // Who asked (prefer row-level user, fall back to project owner)
      askedById: row.askedById || row.project?.ownerId || undefined,
      askedBy: row.askedByName || row.project?.ownerName || undefined,
      askedByEmail: row.askedByEmail || undefined,
      // Who finalized
      finalizedById: row.reviewedBy || row.flagResolvedBy || undefined,
      finalizedBy: row.reviewedBy || row.flagResolvedBy || undefined,
      finalizedByEmail: undefined,
      finalizedAt: getFinalizedAt(row),
      createdAt: row.createdAt?.toISOString() || row.project?.createdAt?.toISOString() || getCreatedAt(row),
      // Additional metadata
      reviewRequestedBy: row.reviewRequestedBy || undefined,
      reviewRequestedAt: row.reviewRequestedAt?.toISOString() || undefined,
      flaggedBy: row.flaggedBy || undefined,
      flaggedAt: row.flaggedAt?.toISOString() || undefined,
      flagNote: row.flagNote || undefined,
      flagResolutionNote: row.flagResolutionNote || undefined,
      userEditedAnswer: row.userEditedAnswer || undefined,
    }));

    // Transform questions to QuestionLogEntry
    const questionEntries: QuestionLogEntry[] = questions.map((q) => ({
      id: q.id,
      source: "questions" as const,
      projectId: undefined,
      projectName: undefined,
      customerName: undefined,
      question: q.question,
      response: q.response,
      confidence: q.confidence || undefined,
      sources: q.sources || undefined,
      reasoning: q.reasoning || undefined,
      inference: q.inference || undefined,
      status: getStatus(q),
      // Who asked
      askedById: q.userId || undefined,
      askedBy: undefined,
      askedByEmail: q.userEmail || undefined,
      // Who finalized
      finalizedById: q.reviewedBy || q.flagResolvedBy || undefined,
      finalizedBy: q.reviewedBy || q.flagResolvedBy || undefined,
      finalizedByEmail: undefined,
      finalizedAt: getFinalizedAt(q),
      createdAt: q.createdAt.toISOString(),
      // Additional metadata
      reviewRequestedBy: q.reviewRequestedBy || undefined,
      reviewRequestedAt: q.reviewRequestedAt?.toISOString() || undefined,
      flaggedBy: q.flaggedBy || undefined,
      flaggedAt: q.flaggedAt?.toISOString() || undefined,
      flagNote: q.flagNote || undefined,
      flagResolutionNote: q.flagResolutionNote || undefined,
      userEditedAnswer: q.userEditedAnswer || undefined,
    }));

    // Combine and sort by finalizedAt
    const allEntries = [...rowEntries, ...questionEntries].sort(
      (a, b) => new Date(b.finalizedAt).getTime() - new Date(a.finalizedAt).getTime()
    );

    // Paginate
    const total = allEntries.length;
    const paginatedEntries = allEntries.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // Calculate stats
    const stats: QuestionLogStats = {
      total: allEntries.length,
      answered: allEntries.filter((e) => e.status === "answered").length,
      verified: allEntries.filter((e) => e.status === "verified").length,
      corrected: allEntries.filter((e) => e.status === "corrected").length,
      locked: allEntries.filter((e) => e.status === "locked").length,
      resolved: allEntries.filter((e) => e.status === "resolved").length,
      pending: allEntries.filter((e) => e.status === "pending").length,
    };

    return apiSuccess({
      entries: paginatedEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats,
    });
  } catch (error) {
    logger.error("Error fetching question log", error, { route: "/api/question-log" });
    return errors.internal("Failed to fetch question log");
  }
}

// DELETE /api/question-log - Delete a question entry (admin only)
// Query params: id, source (project or questions)
export async function DELETE(request: NextRequest) {
  try {
    // Check admin auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized("Authentication required");
    }
    const userCapabilities = session.user.capabilities || [];
    const hasDeleteAccess = userCapabilities.includes("ADMIN") || userCapabilities.includes("VIEW_ORG_DATA");
    if (!hasDeleteAccess) {
      // Fall back to legacy role check
      const userRole = (session.user as { role?: string }).role;
      if (userRole !== "ADMIN" && userRole !== "PROMPT_ADMIN") {
        return errors.forbidden("Admin access required to delete questions");
      }
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const source = searchParams.get("source"); // "project" or "questions"

    if (!id || !source) {
      return errors.badRequest("Missing required parameters: id and source");
    }

    if (source !== "project" && source !== "questions") {
      return errors.badRequest("Invalid source. Must be 'project' or 'questions'");
    }

    // Delete from appropriate table
    if (source === "project") {
      // Delete from BulkRow
      const row = await prisma.bulkRow.findUnique({ where: { id } });
      if (!row) {
        return errors.notFound("Question not found");
      }

      await prisma.bulkRow.delete({ where: { id } });
      logger.info("Deleted BulkRow question", { id, deletedBy: session.user.email });
    } else {
      // Delete from QuestionHistory
      const question = await prisma.questionHistory.findUnique({ where: { id } });
      if (!question) {
        return errors.notFound("Question not found");
      }

      await prisma.questionHistory.delete({ where: { id } });
      logger.info("Deleted QuestionHistory question", { id, deletedBy: session.user.email });
    }

    return apiSuccess({ deleted: true, id, source });
  } catch (error) {
    logger.error("Error deleting question", error, { route: "/api/question-log DELETE" });
    return errors.internal("Failed to delete question");
  }
}
