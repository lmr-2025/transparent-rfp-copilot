"use client";

import { cn } from "@/lib/utils";
import { BulkProject } from "@/types/bulkProject";

export type StatusFilter = "all" | "draft" | "in_progress" | "needs_review" | "approved" | "has_flagged";

interface FilterCounts {
  all: number;
  draft: number;
  in_progress: number;
  needs_review: number;
  approved: number;
  has_flagged: number;
}

interface StatusFilterProps {
  currentFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  counts: FilterCounts;
}

export function StatusFilter({ currentFilter, onFilterChange, counts }: StatusFilterProps) {
  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "in_progress", label: "In Progress" },
    { key: "needs_review", label: "Needs Review" },
    { key: "approved", label: "Approved" },
  ];

  return (
    <div className="flex gap-1.5 flex-wrap">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
            currentFilter === key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {label} ({counts[key]})
        </button>
      ))}
    </div>
  );
}

interface StatusSummaryCardsProps {
  currentFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  counts: FilterCounts;
}

export function StatusSummaryCards({ currentFilter, onFilterChange, counts }: StatusSummaryCardsProps) {
  const cards: { key: StatusFilter; label: string; color: string; bgActive: string; borderActive: string }[] = [
    { key: "needs_review", label: "Needs Review", color: "text-amber-500", bgActive: "bg-amber-50", borderActive: "border-amber-300" },
    { key: "has_flagged", label: "Has Flagged", color: "text-amber-500", bgActive: "bg-amber-50", borderActive: "border-amber-300" },
    { key: "in_progress", label: "In Progress", color: "text-blue-500", bgActive: "bg-blue-50", borderActive: "border-blue-300" },
    { key: "approved", label: "Approved", color: "text-green-500", bgActive: "bg-green-50", borderActive: "border-green-300" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ key, label, color, bgActive, borderActive }) => {
        const isActive = currentFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilterChange(currentFilter === key ? "all" : key)}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              isActive ? `${bgActive} border-2 ${borderActive}` : "bg-card border-border hover:border-muted-foreground/30"
            )}
          >
            <div className={cn("text-3xl font-bold", counts[key] > 0 ? color : "text-muted-foreground")}>
              {counts[key]}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </button>
        );
      })}
    </div>
  );
}

// Helper to calculate filter counts from projects
export function calculateFilterCounts(projects: BulkProject[]): FilterCounts {
  return {
    all: projects.length,
    draft: projects.filter((p) => p.status === "draft").length,
    in_progress: projects.filter((p) => p.status === "in_progress").length,
    needs_review: projects.filter((p) => p.status === "needs_review").length,
    approved: projects.filter((p) => p.status === "approved").length,
    has_flagged: projects.filter((p) => p.rows.some((r) => r.flaggedForReview)).length,
  };
}
