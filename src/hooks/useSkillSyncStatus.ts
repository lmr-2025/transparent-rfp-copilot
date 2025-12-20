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
  syncedByName: string | null;
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
      // API returns { data: { logs: [...] } }, unwrap the data property
      const json = await response.json();
      return json.data;
    },
    enabled: !!skillId,
  });
}

/**
 * Trigger manual sync from git to database (bulk)
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

/**
 * Manually sync a single skill to Git
 */
export function useSyncSkillToGit() {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string; commitSha?: string; skillId: string; slug: string },
    Error,
    string // skillId
  >({
    mutationFn: async (skillId: string) => {
      const response = await fetch(`/api/skills/${skillId}/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to sync skill to Git");
      }

      return response.json();
    },
    onSuccess: (_, skillId) => {
      // Invalidate sync logs for this skill (partial match covers all limit variants)
      queryClient.invalidateQueries({ queryKey: ["skills", skillId, "sync-logs"] });
      // Invalidate overall sync status
      queryClient.invalidateQueries({ queryKey: ["skills", "sync"] });
      // Invalidate the skills list to update syncStatus in the UI
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
