/**
 * React Query hooks for skill sync status
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SyncHealthStatus {
  synced: number;
  pending: number;
  failed: number;
  unknown: number;
  total: number;
  recentFailures: number;
  healthy: boolean;
}

interface SyncLogEntry {
  id: string;
  skillId: string;
  operation: string;
  direction: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  gitCommitSha: string | null;
  syncedBy: string | null;
}

/**
 * Fetch overall sync health status
 */
export function useSyncHealthStatus() {
  return useQuery<{ status: SyncHealthStatus }>({
    queryKey: ["skills", "sync", "status"],
    queryFn: async () => {
      const response = await fetch("/api/skills/sync/status");
      if (!response.ok) {
        throw new Error("Failed to fetch sync status");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}

/**
 * Fetch sync logs for a specific skill
 */
export function useSkillSyncLogs(skillId: string, limit = 10) {
  return useQuery<{ logs: SyncLogEntry[] }>({
    queryKey: ["skills", skillId, "sync-logs", limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/skills/${skillId}/sync-logs?limit=${limit}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = typeof errorData?.error === 'string'
          ? errorData.error
          : `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }
      return response.json();
    },
    enabled: !!skillId,
  });
}

/**
 * Trigger manual sync from git to database
 */
export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string; output: string; warnings?: string },
    Error
  >({
    mutationFn: async () => {
      const response = await fetch("/api/skills/sync/trigger", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger sync");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch sync status and skills
      queryClient.invalidateQueries({ queryKey: ["skills", "sync"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
