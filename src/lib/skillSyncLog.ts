/**
 * Skill Sync Logging - Track git sync operations for debugging and UI visibility
 */

import { prisma } from "./prisma";

export type SyncOperation = "create" | "update" | "delete" | "refresh";
export type SyncDirection = "db-to-git" | "git-to-db";
export type SyncStatus = "pending" | "success" | "failed";

export interface CreateSyncLogParams {
  skillId: string;
  operation: SyncOperation;
  direction: SyncDirection;
  syncedBy?: string; // User ID or "system"
}

export interface CompleteSyncLogParams {
  logId: string;
  status: "success" | "failed";
  gitCommitSha?: string;
  error?: string;
}

/**
 * Create a new sync log entry (status: pending)
 * Call this before starting a sync operation
 */
export async function createSyncLog(params: CreateSyncLogParams) {
  const log = await prisma.skillSyncLog.create({
    data: {
      skillId: params.skillId,
      operation: params.operation,
      direction: params.direction,
      status: "pending",
      syncedBy: params.syncedBy || "system",
    },
  });

  return log.id;
}

/**
 * Mark a sync log as completed (success or failed)
 * Call this after sync operation finishes
 */
export async function completeSyncLog(params: CompleteSyncLogParams) {
  await prisma.skillSyncLog.update({
    where: { id: params.logId },
    data: {
      status: params.status,
      completedAt: new Date(),
      gitCommitSha: params.gitCommitSha,
      error: params.error,
    },
  });

  // Also update the skill's sync status
  if (params.status === "success") {
    await prisma.skill.update({
      where: { id: (await prisma.skillSyncLog.findUnique({ where: { id: params.logId } }))!.skillId },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: "synced",
        gitCommitSha: params.gitCommitSha,
      },
    });
  } else {
    await prisma.skill.update({
      where: { id: (await prisma.skillSyncLog.findUnique({ where: { id: params.logId } }))!.skillId },
      data: {
        syncStatus: "failed",
      },
    });
  }
}

/**
 * Get recent sync logs for a skill
 */
export async function getSkillSyncLogs(skillId: string, limit = 10) {
  return prisma.skillSyncLog.findMany({
    where: { skillId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Get overall sync health status
 * Returns counts of synced/pending/failed skills
 */
export async function getSyncHealthStatus() {
  const [synced, pending, failed, total] = await Promise.all([
    prisma.skill.count({ where: { syncStatus: "synced", isActive: true } }),
    prisma.skill.count({ where: { syncStatus: "pending", isActive: true } }),
    prisma.skill.count({ where: { syncStatus: "failed", isActive: true } }),
    prisma.skill.count({ where: { isActive: true } }),
  ]);

  // Count recently failed sync operations (last 24 hours)
  const recentFailures = await prisma.skillSyncLog.count({
    where: {
      status: "failed",
      startedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    synced,
    pending,
    failed,
    total,
    unknown: total - synced - pending - failed,
    recentFailures,
    healthy: failed === 0 && recentFailures === 0,
  };
}

/**
 * Get recently failed sync operations
 */
export async function getRecentSyncFailures(limit = 20) {
  return prisma.skillSyncLog.findMany({
    where: { status: "failed" },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      skill: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

/**
 * Helper function to wrap git sync operations with logging
 * Usage:
 *   const result = await withSyncLogging({
 *     skillId: skill.id,
 *     operation: 'create',
 *     direction: 'db-to-git',
 *     syncedBy: userId,
 *   }, async (logId) => {
 *     const commitSha = await saveSkillAndCommit(...);
 *     return commitSha;
 *   });
 */
export async function withSyncLogging<T>(
  params: CreateSyncLogParams,
  syncFn: (logId: string) => Promise<T>
): Promise<T> {
  const logId = await createSyncLog(params);

  try {
    const result = await syncFn(logId);

    // If result is a string (commit SHA), log it
    const commitSha = typeof result === "string" ? result : undefined;

    await completeSyncLog({
      logId,
      status: "success",
      gitCommitSha: commitSha || undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await completeSyncLog({
      logId,
      status: "failed",
      error: errorMessage,
    });

    // Re-throw error so caller can handle it
    throw error;
  }
}
