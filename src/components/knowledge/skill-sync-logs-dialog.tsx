/**
 * Skill Sync Logs Dialog
 *
 * Displays sync history for a specific skill with filtering and details
 */

"use client";

import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Database,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { useSkillSyncLogs } from "@/hooks/useSkillSyncStatus";
import { cn } from "@/lib/utils";

// Simple date formatting to avoid date-fns dependency
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleString('en-US', options);
}

interface SkillSyncLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string;
  skillTitle: string;
}

export function SkillSyncLogsDialog({
  open,
  onOpenChange,
  skillId,
  skillTitle,
}: SkillSyncLogsDialogProps) {
  const { data, isLoading, error } = useSkillSyncLogs(skillId, 20);

  const logs = data?.logs || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sync History</DialogTitle>
          <DialogDescription>{skillTitle}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <PageLoader message="Loading sync history..." size="md" />
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Failed to load sync history: {error.message}
            </div>
          )}

          {!isLoading && !error && logs.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sync history found</p>
              <p className="text-xs mt-1">
                This skill was created before sync tracking was enabled
              </p>
            </div>
          )}

          {!isLoading && !error && logs.length > 0 && (
            <div className="space-y-3 p-1">
              {logs.map((log, index) => (
                <SyncLogEntry
                  key={log.id}
                  log={log}
                  isLatest={index === 0}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SyncLogEntryProps {
  log: {
    id: string;
    operation: string;
    direction: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    error: string | null;
    gitCommitSha: string | null;
    syncedBy: string | null;
  };
  isLatest: boolean;
}

function SyncLogEntry({ log, isLatest }: SyncLogEntryProps) {
  const isSuccess = log.status === "success";
  const isFailed = log.status === "failed";
  const isPending = log.status === "pending";

  const StatusIcon = isSuccess
    ? CheckCircle2
    : isFailed
    ? AlertCircle
    : isPending
    ? Clock
    : RefreshCw;

  const statusColor = isSuccess
    ? "text-green-600"
    : isFailed
    ? "text-red-600"
    : isPending
    ? "text-amber-600"
    : "text-slate-500";

  const bgColor = isSuccess
    ? "bg-green-50 border-green-200"
    : isFailed
    ? "bg-red-50 border-red-200"
    : isPending
    ? "bg-amber-50 border-amber-200"
    : "bg-slate-50 border-slate-200";

  const duration =
    log.completedAt && log.startedAt
      ? Math.round(
          (new Date(log.completedAt).getTime() -
            new Date(log.startedAt).getTime()) /
            1000
        )
      : null;

  const direction = log.direction === "db-to-git" ? "DB → Git" : "Git → DB";
  const DirectionStartIcon =
    log.direction === "db-to-git" ? Database : GitBranch;
  const DirectionEndIcon =
    log.direction === "db-to-git" ? GitBranch : Database;

  return (
    <div className={cn("border rounded-lg p-4", bgColor)}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <StatusIcon className={cn("h-5 w-5", statusColor)} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm capitalize">
                {log.operation}
              </span>
              {isLatest && (
                <Badge variant="secondary" className="text-xs">
                  Latest
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(log.startedAt)}
            </span>
          </div>

          {/* Direction Indicator */}
          <div className="flex items-center gap-1.5 mb-2">
            <DirectionStartIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <DirectionEndIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground ml-1">
              {direction}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {log.gitCommitSha && (
              <div>
                <span className="text-muted-foreground">Commit: </span>
                <code className="text-xs bg-black/5 px-1 py-0.5 rounded">
                  {log.gitCommitSha.substring(0, 8)}
                </code>
              </div>
            )}

            {log.syncedBy && (
              <div>
                <span className="text-muted-foreground">By: </span>
                <span className="font-medium">{log.syncedBy}</span>
              </div>
            )}

            {duration !== null && (
              <div>
                <span className="text-muted-foreground">Duration: </span>
                <span className="font-medium">{duration}s</span>
              </div>
            )}

            <div>
              <span className="text-muted-foreground">Status: </span>
              <span className={cn("font-medium capitalize", statusColor)}>
                {log.status}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {log.error && (
            <div className="mt-2 p-2 bg-white/60 border border-current/20 rounded text-xs">
              <span className="font-medium">Error: </span>
              <span className="text-muted-foreground">{log.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
