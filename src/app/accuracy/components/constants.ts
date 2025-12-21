import type { TabId } from "./types";

export const CONFIDENCE_COLORS: Record<string, string> = {
  High: "#16a34a",
  Medium: "#eab308",
  Low: "#dc2626",
  Unknown: "#94a3b8",
};

export const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "questions", label: "Questions" },
  { id: "contracts", label: "Contracts" },
  { id: "rfps", label: "RFPs" },
];

// Helper functions
export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatLogDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}
