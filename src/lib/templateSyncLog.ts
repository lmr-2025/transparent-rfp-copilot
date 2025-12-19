/**
 * Template Sync Logging - Track git sync operations for debugging and UI visibility
 */

import { prisma } from "./prisma";

export type SyncOperation = "create" | "update" | "delete";
export type SyncDirection = "db-to-git" | "git-to-db";
export type SyncStatus = "pending" | "success" | "failed";

export interface CreateTemplateSyncLogParams {
  templateId: string;
  operation: SyncOperation;
  direction: SyncDirection;
  syncedBy?: string; // User ID or "system"
}

export interface CompleteTemplateSyncLogParams {
  logId: string;
  status: "success" | "failed";
  gitCommitSha?: string;
  error?: string;
}

/**
 * Create a new sync log entry (status: pending)
 * Call this before starting a sync operation
 */
export async function createTemplateSyncLog(params: CreateTemplateSyncLogParams) {
  const log = await prisma.templateSyncLog.create({
    data: {
      templateId: params.templateId,
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
export async function completeTemplateSyncLog(params: CompleteTemplateSyncLogParams) {
  const log = await prisma.templateSyncLog.findUnique({
    where: { id: params.logId },
  });

  if (!log) {
    throw new Error(`Sync log not found: ${params.logId}`);
  }

  await prisma.templateSyncLog.update({
    where: { id: params.logId },
    data: {
      status: params.status,
      completedAt: new Date(),
      gitCommitSha: params.gitCommitSha,
      error: params.error,
    },
  });

  // Also update the template's sync status
  if (params.status === "success") {
    await prisma.template.update({
      where: { id: log.templateId },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: "synced",
        gitCommitSha: params.gitCommitSha,
      },
    });
  } else {
    await prisma.template.update({
      where: { id: log.templateId },
      data: {
        syncStatus: "failed",
      },
    });
  }
}

/**
 * Get recent sync logs for a template
 */
export async function getTemplateSyncLogs(templateId: string, limit = 10) {
  return prisma.templateSyncLog.findMany({
    where: { templateId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Get overall sync health status for templates
 * Returns counts of synced/pending/failed templates
 */
export async function getTemplateSyncHealthStatus() {
  const [synced, pending, failed, total] = await Promise.all([
    prisma.template.count({ where: { syncStatus: "synced", isActive: true } }),
    prisma.template.count({ where: { syncStatus: "pending", isActive: true } }),
    prisma.template.count({ where: { syncStatus: "failed", isActive: true } }),
    prisma.template.count({ where: { isActive: true } }),
  ]);

  // Count recently failed sync operations (last 24 hours)
  const recentFailures = await prisma.templateSyncLog.count({
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
export async function getRecentTemplateSyncFailures(limit = 20) {
  return prisma.templateSyncLog.findMany({
    where: { status: "failed" },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Helper function to wrap git sync operations with logging
 * Usage:
 *   const result = await withTemplateSyncLogging({
 *     templateId: template.id,
 *     operation: 'create',
 *     direction: 'db-to-git',
 *     syncedBy: userId,
 *   }, async (logId) => {
 *     const commitSha = await saveTemplateAndCommit(...);
 *     return commitSha;
 *   });
 */
export async function withTemplateSyncLogging<T>(
  params: CreateTemplateSyncLogParams,
  syncFn: (logId: string) => Promise<T>
): Promise<T> {
  const logId = await createTemplateSyncLog(params);

  try {
    const result = await syncFn(logId);

    // If result is a string (commit SHA), log it
    const commitSha = typeof result === "string" ? result : undefined;

    await completeTemplateSyncLog({
      logId,
      status: "success",
      gitCommitSha: commitSha || undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await completeTemplateSyncLog({
      logId,
      status: "failed",
      error: errorMessage,
    });

    // Re-throw error so caller can handle it
    throw error;
  }
}
