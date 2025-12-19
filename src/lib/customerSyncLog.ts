/**
 * Customer Profile Sync Logging - Track git sync operations for debugging and UI visibility
 *
 * Pattern copied from skillSyncLog.ts for consistency.
 */

import { prisma } from "./prisma";

export type SyncOperation = "create" | "update" | "delete" | "refresh";
export type SyncDirection = "db-to-git" | "git-to-db";
export type SyncStatus = "pending" | "success" | "failed";

export interface CreateCustomerSyncLogParams {
  customerId: string;
  operation: SyncOperation;
  direction: SyncDirection;
  syncedBy?: string; // User ID or "system"
}

export interface CompleteCustomerSyncLogParams {
  logId: string;
  status: "success" | "failed";
  gitCommitSha?: string;
  error?: string;
}

/**
 * Create a new sync log entry (status: pending)
 * Call this before starting a sync operation
 */
export async function createCustomerSyncLog(params: CreateCustomerSyncLogParams) {
  const log = await prisma.customerSyncLog.create({
    data: {
      customerId: params.customerId,
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
export async function completeCustomerSyncLog(params: CompleteCustomerSyncLogParams) {
  await prisma.customerSyncLog.update({
    where: { id: params.logId },
    data: {
      status: params.status,
      completedAt: new Date(),
      gitCommitSha: params.gitCommitSha,
      error: params.error,
    },
  });

  // Also update the customer profile's sync status
  const log = await prisma.customerSyncLog.findUnique({ where: { id: params.logId } });
  if (!log) return;

  if (params.status === "success") {
    await prisma.customerProfile.update({
      where: { id: log.customerId },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: "synced",
        gitCommitSha: params.gitCommitSha,
      },
    });
  } else {
    await prisma.customerProfile.update({
      where: { id: log.customerId },
      data: {
        syncStatus: "failed",
      },
    });
  }
}

/**
 * Get recent sync logs for a customer profile
 */
export async function getCustomerSyncLogs(customerId: string, limit = 10) {
  return prisma.customerSyncLog.findMany({
    where: { customerId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Get overall customer sync health status
 * Returns counts of synced/pending/failed customer profiles
 */
export async function getCustomerSyncHealthStatus() {
  const [synced, pending, failed, total] = await Promise.all([
    prisma.customerProfile.count({ where: { syncStatus: "synced", isActive: true } }),
    prisma.customerProfile.count({ where: { syncStatus: "pending", isActive: true } }),
    prisma.customerProfile.count({ where: { syncStatus: "failed", isActive: true } }),
    prisma.customerProfile.count({ where: { isActive: true } }),
  ]);

  // Count recently failed sync operations (last 24 hours)
  const recentFailures = await prisma.customerSyncLog.count({
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
 * Get recently failed customer sync operations
 */
export async function getRecentCustomerSyncFailures(limit = 20) {
  return prisma.customerSyncLog.findMany({
    where: { status: "failed" },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      customer: {
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
 *   const result = await withCustomerSyncLogging({
 *     customerId: customer.id,
 *     operation: 'create',
 *     direction: 'db-to-git',
 *     syncedBy: userId,
 *   }, async (logId) => {
 *     const commitSha = await saveCustomerAndCommit(...);
 *     return commitSha;
 *   });
 */
export async function withCustomerSyncLogging<T>(
  params: CreateCustomerSyncLogParams,
  syncFn: (logId: string) => Promise<T>
): Promise<T> {
  const logId = await createCustomerSyncLog(params);

  try {
    const result = await syncFn(logId);

    // If result is a string (commit SHA), log it
    const commitSha = typeof result === "string" ? result : undefined;

    await completeCustomerSyncLog({
      logId,
      status: "success",
      gitCommitSha: commitSha || undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await completeCustomerSyncLog({
      logId,
      status: "failed",
      error: errorMessage,
    });

    // Re-throw error so caller can handle it
    throw error;
  }
}
