import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getSkillSyncLogs } from "@/lib/skillSyncLog";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/skills/[id]/sync-logs - Get sync logs for a specific skill
 *
 * @description Returns recent sync operations for a skill, ordered by most recent first
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @param {string} id - Skill ID
 * @query {number} [limit=10] - Maximum number of logs to return
 *
 * @returns {object[]} 200 - Array of sync log entries
 * @returns {{ error: string }} 404 - Skill not found
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * GET /api/skills/abc123/sync-logs?limit=5
 * Response: {
 *   "logs": [
 *     {
 *       "id": "log123",
 *       "operation": "update",
 *       "direction": "db-to-git",
 *       "status": "success",
 *       "startedAt": "2025-12-19T12:00:00Z",
 *       "completedAt": "2025-12-19T12:00:02Z",
 *       "gitCommitSha": "abc123def456",
 *       "syncedBy": "user123"
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 100);

    // Check if skill exists
    const skill = await prisma.skill.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!skill) {
      return errors.notFound("Skill");
    }

    // Get sync logs
    const logs = await getSkillSyncLogs(id, limit);

    return apiSuccess({ logs });
  } catch (error) {
    logger.error("Failed to fetch skill sync logs", error, {
      route: "/api/skills/[id]/sync-logs",
    });
    return errors.internal("Failed to fetch skill sync logs");
  }
}
