/**
 * Sync Status Badge Component
 *
 * Displays sync status for git-backed skills with visual indicator
 * Used in skill cards to show sync state at a glance
 */

import { CheckCircle2, Clock, AlertCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/hooks/use-knowledge-data";

// Extended type that includes "unknown" for display purposes
type DisplaySyncStatus = SyncStatus | "unknown";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncedAt?: Date | string | null;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const SYNC_STATUS_CONFIG = {
  synced: {
    icon: CheckCircle2,
    label: "Synced",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  unknown: {
    icon: HelpCircle,
    label: "Unknown",
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
} as const;

function formatTimeSince(date: Date | string): string {
  const now = new Date();
  const syncDate = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - syncDate.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return syncDate.toLocaleDateString();
}

export function SyncStatusBadge({
  status,
  lastSyncedAt,
  className,
  showLabel = true,
  size = "sm",
}: SyncStatusBadgeProps) {
  const effectiveStatus: DisplaySyncStatus = status || "unknown";
  const config = SYNC_STATUS_CONFIG[effectiveStatus];
  const Icon = config.icon;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  const title =
    effectiveStatus === "synced" && lastSyncedAt
      ? `Last synced: ${formatTimeSince(lastSyncedAt)}`
      : `Sync status: ${config.label}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border",
        config.bgColor,
        config.borderColor,
        padding,
        fontSize,
        className
      )}
      title={title}
    >
      <Icon className={cn(iconSize, config.color)} />
      {showLabel && <span className={config.color}>{config.label}</span>}
    </span>
  );
}
