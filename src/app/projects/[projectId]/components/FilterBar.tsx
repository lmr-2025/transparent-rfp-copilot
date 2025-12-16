"use client";

const styles = {
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};

export type StatusFilter = "all" | "high" | "medium" | "low" | "error" | "flagged" | "pending-review" | "reviewed" | "queued";

type FilterStats = {
  total: number;
  high: number;
  medium: number;
  low: number;
  errors: number;
  flagged: number;
  pendingReview: number;
  approved: number;
};

type FilterBarProps = {
  statusFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  stats: FilterStats;
  queuedCount: number;
};

const filters: StatusFilter[] = ["all", "high", "medium", "low", "error", "flagged", "pending-review", "reviewed", "queued"];

export default function FilterBar({
  statusFilter,
  onFilterChange,
  stats,
  queuedCount,
}: FilterBarProps) {
  const getFilterStyle = (filter: StatusFilter) => {
    if (statusFilter === filter) return { backgroundColor: "#0ea5e9", color: "#fff" };
    if (filter === "pending-review" && stats.pendingReview > 0) return { backgroundColor: "#fef3c7", color: "#92400e" };
    if (filter === "reviewed" && stats.approved > 0) return { backgroundColor: "#dcfce7", color: "#166534" };
    if (filter === "flagged" && stats.flagged > 0) return { backgroundColor: "#fef3c7", color: "#92400e" };
    if (filter === "queued" && queuedCount > 0) return { backgroundColor: "#ede9fe", color: "#6d28d9" };
    return { backgroundColor: "#f1f5f9", color: "#0f172a" };
  };

  const getFilterLabel = (filter: StatusFilter) => {
    switch (filter) {
      case "all": return `All (${stats.total})`;
      case "high": return `High (${stats.high})`;
      case "medium": return `Medium (${stats.medium})`;
      case "low": return `Low (${stats.low})`;
      case "error": return `Error (${stats.errors})`;
      case "flagged": return `Flagged (${stats.flagged})`;
      case "pending-review": return `Pending Review (${stats.pendingReview})`;
      case "reviewed": return `Reviewed (${stats.approved})`;
      case "queued": return `Queued (${queuedCount})`;
    }
  };

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <strong>Filter:</strong>
        {filters.map((filter) => {
          // Hide queued filter if no items are queued
          if (filter === "queued" && queuedCount === 0) return null;
          return (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              style={{
                ...styles.button,
                padding: "6px 12px",
                ...getFilterStyle(filter),
              }}
            >
              {getFilterLabel(filter)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
