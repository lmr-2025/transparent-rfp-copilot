import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getSyncHealthStatus } from "@/lib/skillSyncLog";

/**
 * GET /api/skills/sync/status - Get overall sync health status
 *
 * @description Returns counts of synced/pending/failed skills and overall health
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @returns {object} 200 - Sync health status
 * @returns {number} synced - Count of skills with status "synced"
 * @returns {number} pending - Count of skills with status "pending"
 * @returns {number} failed - Count of skills with status "failed"
 * @returns {number} unknown - Count of skills with null/unknown status
 * @returns {number} total - Total count of active skills
 * @returns {number} recentFailures - Count of failed syncs in last 24 hours
 * @returns {boolean} healthy - True if no failures
 *
 * @example
 * GET /api/skills/sync/status
 * Response: {
 *   "synced": 42,
 *   "pending": 2,
 *   "failed": 0,
 *   "unknown": 1,
 *   "total": 45,
 *   "recentFailures": 0,
 *   "healthy": true
 * }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const status = await getSyncHealthStatus();

    return apiSuccess({
      status,
    });
  } catch (error) {
    logger.error("Failed to get sync health status", error, {
      route: "/api/skills/sync/status",
    });
    return errors.internal("Failed to get sync health status");
  }
}
