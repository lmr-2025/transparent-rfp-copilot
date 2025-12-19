/**
 * Sync Health Bar Component
 *
 * Global header indicator showing overall sync health for git-backed skills
 * Displays counts and health status with click-to-expand details
 */

"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SyncHealthStatus {
  synced: number;
  pending: number;
  failed: number;
  unknown: number;
  total: number;
  recentFailures: number;
  healthy: boolean;
}

interface SyncHealthBarProps {
  status: SyncHealthStatus;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function SyncHealthBar({
  status,
  isLoading = false,
  onRefresh,
  className,
}: SyncHealthBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const syncPercentage = status.total > 0 ? (status.synced / status.total) * 100 : 0;
  const hasSyncIssues = status.failed > 0 || status.pending > 0;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        status.healthy ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50",
        className
      )}
    >
      {/* Main Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3 flex-1">
          {/* Health Icon */}
          {status.healthy ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />
          )}

          {/* Status Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-sm font-medium",
                  status.healthy ? "text-green-900" : "text-amber-900"
                )}
              >
                Git Sync:
              </span>
              <span
                className={cn(
                  "text-sm",
                  status.healthy ? "text-green-700" : "text-amber-700"
                )}
              >
                {status.synced}/{status.total} skills synced
              </span>
              {hasSyncIssues && (
                <span className="text-xs text-amber-600">
                  ({status.pending} pending, {status.failed} failed)
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-1.5 w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500 ease-out",
                  status.healthy ? "bg-green-600" : "bg-amber-600"
                )}
                style={{ width: `${syncPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className={cn(
                "h-8 px-2",
                status.healthy
                  ? "hover:bg-green-100 text-green-700"
                  : "hover:bg-amber-100 text-amber-700"
              )}
              title="Refresh sync status"
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "h-8 px-2",
              status.healthy
                ? "hover:bg-green-100 text-green-700"
                : "hover:bg-amber-100 text-amber-700"
            )}
            title={isExpanded ? "Hide details" : "Show details"}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-current/10 px-4 py-3 bg-white/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusCard
              label="Synced"
              count={status.synced}
              icon={CheckCircle2}
              color="green"
            />
            <StatusCard
              label="Unknown"
              count={status.unknown}
              icon={AlertCircle}
              color="slate"
              tooltip="Skills created before sync tracking"
            />
            <StatusCard
              label="Pending"
              count={status.pending}
              icon={RefreshCw}
              color="amber"
            />
            <StatusCard
              label="Failed"
              count={status.failed}
              icon={AlertCircle}
              color="red"
            />
          </div>

          {status.recentFailures > 0 && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              {status.recentFailures} sync failure{status.recentFailures !== 1 ? "s" : ""} in
              the last 24 hours
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StatusCardProps {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "green" | "amber" | "red" | "slate";
  tooltip?: string;
}

function StatusCard({ label, count, icon: Icon, color, tooltip }: StatusCardProps) {
  const colorClasses = {
    green: "bg-green-100 text-green-700 border-green-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    red: "bg-red-100 text-red-700 border-red-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded border",
        colorClasses[color]
      )}
      title={tooltip}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{label}</div>
        <div className="text-lg font-bold leading-none">{count}</div>
      </div>
    </div>
  );
}
