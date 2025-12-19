/**
 * Prompt Sync Logging - Track git sync operations for blocks and modifiers
 * Supports both PromptBlock and PromptModifier entities in a unified log
 */

import { prisma } from "./prisma";

export type PromptEntityType = "block" | "modifier";
export type SyncOperation = "create" | "update" | "delete";
export type SyncDirection = "db-to-git" | "git-to-db";
export type SyncStatus = "pending" | "success" | "failed";

export interface CreatePromptSyncLogParams {
  entityType: PromptEntityType;
  entityId: string; // blockId or modifierId (the unique key)
  entityUuid?: string; // The actual UUID from the database
  operation: SyncOperation;
  direction: SyncDirection;
  syncedBy?: string; // User ID or "system"
}

export interface CompletePromptSyncLogParams {
  logId: string;
  status: "success" | "failed";
  gitCommitSha?: string;
  error?: string;
}

/**
 * Create a new sync log entry (status: pending)
 * Call this before starting a sync operation
 */
export async function createPromptSyncLog(params: CreatePromptSyncLogParams) {
  const log = await prisma.promptSyncLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      blockUuid: params.entityType === "block" ? params.entityUuid : undefined,
      modifierUuid: params.entityType === "modifier" ? params.entityUuid : undefined,
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
 * Also updates the entity's sync status
 */
export async function completePromptSyncLog(params: CompletePromptSyncLogParams) {
  // Get the log to find entity details
  const log = await prisma.promptSyncLog.findUnique({
    where: { id: params.logId },
  });

  if (!log) {
    throw new Error(`Sync log not found: ${params.logId}`);
  }

  // Update the log
  await prisma.promptSyncLog.update({
    where: { id: params.logId },
    data: {
      status: params.status,
      completedAt: new Date(),
      gitCommitSha: params.gitCommitSha,
      error: params.error,
    },
  });

  // Update the entity's sync status
  if (log.entityType === "block" && log.blockUuid) {
    await prisma.promptBlock.update({
      where: { id: log.blockUuid },
      data: {
        lastSyncedAt: params.status === "success" ? new Date() : undefined,
        syncStatus: params.status === "success" ? "synced" : "failed",
        gitCommitSha: params.status === "success" ? params.gitCommitSha : undefined,
      },
    });
  } else if (log.entityType === "modifier" && log.modifierUuid) {
    await prisma.promptModifier.update({
      where: { id: log.modifierUuid },
      data: {
        lastSyncedAt: params.status === "success" ? new Date() : undefined,
        syncStatus: params.status === "success" ? "synced" : "failed",
        gitCommitSha: params.status === "success" ? params.gitCommitSha : undefined,
      },
    });
  }
}

/**
 * Get recent sync logs for a block
 */
export async function getBlockSyncLogs(blockId: string, limit = 10) {
  return prisma.promptSyncLog.findMany({
    where: { entityType: "block", entityId: blockId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Get recent sync logs for a modifier
 */
export async function getModifierSyncLogs(modifierId: string, limit = 10) {
  return prisma.promptSyncLog.findMany({
    where: { entityType: "modifier", entityId: modifierId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Get overall prompt sync health status
 * Returns counts of synced/pending/failed blocks and modifiers
 */
export async function getPromptSyncHealthStatus() {
  const [
    blocksSynced,
    blocksPending,
    blocksFailed,
    blocksTotal,
    modifiersSynced,
    modifiersPending,
    modifiersFailed,
    modifiersTotal,
  ] = await Promise.all([
    prisma.promptBlock.count({ where: { syncStatus: "synced" } }),
    prisma.promptBlock.count({ where: { syncStatus: "pending" } }),
    prisma.promptBlock.count({ where: { syncStatus: "failed" } }),
    prisma.promptBlock.count(),
    prisma.promptModifier.count({ where: { syncStatus: "synced" } }),
    prisma.promptModifier.count({ where: { syncStatus: "pending" } }),
    prisma.promptModifier.count({ where: { syncStatus: "failed" } }),
    prisma.promptModifier.count(),
  ]);

  // Count recently failed sync operations (last 24 hours)
  const recentFailures = await prisma.promptSyncLog.count({
    where: {
      status: "failed",
      startedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    blocks: {
      synced: blocksSynced,
      pending: blocksPending,
      failed: blocksFailed,
      total: blocksTotal,
      unknown: blocksTotal - blocksSynced - blocksPending - blocksFailed,
    },
    modifiers: {
      synced: modifiersSynced,
      pending: modifiersPending,
      failed: modifiersFailed,
      total: modifiersTotal,
      unknown: modifiersTotal - modifiersSynced - modifiersPending - modifiersFailed,
    },
    recentFailures,
    healthy: blocksFailed === 0 && modifiersFailed === 0 && recentFailures === 0,
  };
}

/**
 * Get recently failed sync operations
 */
export async function getRecentPromptSyncFailures(limit = 20) {
  return prisma.promptSyncLog.findMany({
    where: { status: "failed" },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      block: {
        select: {
          id: true,
          blockId: true,
          name: true,
        },
      },
      modifier: {
        select: {
          id: true,
          modifierId: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Helper function to wrap block sync operations with logging
 */
export async function withBlockSyncLogging<T>(
  params: Omit<CreatePromptSyncLogParams, "entityType">,
  syncFn: (logId: string) => Promise<T>
): Promise<T> {
  const logId = await createPromptSyncLog({
    ...params,
    entityType: "block",
  });

  try {
    const result = await syncFn(logId);

    // If result is a string (commit SHA), log it
    const commitSha = typeof result === "string" ? result : undefined;

    await completePromptSyncLog({
      logId,
      status: "success",
      gitCommitSha: commitSha || undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await completePromptSyncLog({
      logId,
      status: "failed",
      error: errorMessage,
    });

    // Re-throw error so caller can handle it
    throw error;
  }
}

/**
 * Helper function to wrap modifier sync operations with logging
 */
export async function withModifierSyncLogging<T>(
  params: Omit<CreatePromptSyncLogParams, "entityType">,
  syncFn: (logId: string) => Promise<T>
): Promise<T> {
  const logId = await createPromptSyncLog({
    ...params,
    entityType: "modifier",
  });

  try {
    const result = await syncFn(logId);

    // If result is a string (commit SHA), log it
    const commitSha = typeof result === "string" ? result : undefined;

    await completePromptSyncLog({
      logId,
      status: "success",
      gitCommitSha: commitSha || undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await completePromptSyncLog({
      logId,
      status: "failed",
      error: errorMessage,
    });

    // Re-throw error so caller can handle it
    throw error;
  }
}
