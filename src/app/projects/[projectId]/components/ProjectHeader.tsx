"use client";

import { BulkProject } from "@/types/bulkProject";
import ExportDropdown from "./ExportDropdown";

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
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "0.85rem",
    fontWeight: 600,
    display: "inline-block",
  },
};

const getStatusColor = (status: BulkProject["status"]) => {
  switch (status) {
    case "draft":
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
    case "in_progress":
      return { backgroundColor: "#dbeafe", color: "#1e40af" };
    case "needs_review":
      return { backgroundColor: "#fef3c7", color: "#92400e" };
    case "finalized":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    default:
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
  }
};

const getStatusLabel = (status: BulkProject["status"]) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_progress":
      return "In Progress";
    case "needs_review":
      return "Needs Review";
    case "finalized":
      return "Finalized";
    default:
      return status;
  }
};

type ProjectStats = {
  total: number;
  high: number;
  medium: number;
  low: number;
  errors: number;
};

type ProjectHeaderProps = {
  project: BulkProject;
  stats: ProjectStats;
  queuedCount: number;
  isRequestingReview: boolean;
  isApproving: boolean;
  isSendingQueued: boolean;
  onRequestReview: () => void;
  onApprove: () => void;
  onSendAllQueued: () => void;
  onDeleteProject: () => void;
  onEditCustomers: () => void;
  onEditOwner: () => void;
};

export default function ProjectHeader({
  project,
  stats,
  queuedCount,
  isRequestingReview,
  isApproving,
  isSendingQueued,
  onRequestReview,
  onApprove,
  onSendAllQueued,
  onDeleteProject,
  onEditCustomers,
  onEditOwner,
}: ProjectHeaderProps) {
  return (
    <div style={{ ...styles.card, display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 auto", minWidth: "300px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <span style={{ ...styles.statusBadge, ...getStatusColor(project.status) }}>
            {getStatusLabel(project.status)}
          </span>
          <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>{project.name}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "0.9rem", color: "#475569" }}>
          <span><strong>Worksheet:</strong> {project.sheetName}</span>
          <span><strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</span>
          <span>
            <strong>Owner:</strong>{" "}
            {project.owner?.name || project.ownerName || (
              <span style={{ color: "#94a3b8" }}>Not assigned</span>
            )}
            <button
              type="button"
              onClick={onEditOwner}
              style={{
                marginLeft: "6px",
                padding: "1px 6px",
                fontSize: "0.75rem",
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              Change
            </button>
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px", fontSize: "0.9rem" }}>
          <span>
            <strong>Customer:</strong>{" "}
            {project.customer ? (
              <span style={{
                display: "inline-block",
                padding: "2px 8px",
                backgroundColor: "#e0e7ff",
                color: "#4338ca",
                borderRadius: "4px",
                fontSize: "0.8rem",
                fontWeight: 500,
                marginRight: "4px",
              }}>
                {project.customer.name}
                {project.customer.industry && (
                  <span style={{ color: "#6366f1", marginLeft: "4px" }}>({project.customer.industry})</span>
                )}
              </span>
            ) : (
              <span style={{ color: "#94a3b8" }}>None linked</span>
            )}
            <button
              type="button"
              onClick={onEditCustomers}
              style={{
                marginLeft: "6px",
                padding: "1px 6px",
                fontSize: "0.75rem",
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              {project.customer ? "Change" : "Select"}
            </button>
          </span>
          <span style={{ color: "#64748b" }}>
            {stats.total} questions · {stats.high} high · {stats.medium} med · {stats.low} low
            {stats.errors > 0 && <span style={{ color: "#dc2626" }}> · {stats.errors} errors</span>}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Send All Queued */}
        {queuedCount > 0 && (
          <button
            type="button"
            onClick={onSendAllQueued}
            disabled={isSendingQueued}
            style={{
              ...styles.button,
              backgroundColor: isSendingQueued ? "#94a3b8" : "#8b5cf6",
              color: "#fff",
              cursor: isSendingQueued ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isSendingQueued ? "Sending..." : `Send All Queued (${queuedCount})`}
          </button>
        )}
        {(project.status === "draft" || project.status === "in_progress") && (
          <button
            type="button"
            onClick={onRequestReview}
            disabled={isRequestingReview}
            style={{
              ...styles.button,
              backgroundColor: isRequestingReview ? "#94a3b8" : "#f59e0b",
              color: "#fff",
              cursor: isRequestingReview ? "not-allowed" : "pointer",
            }}
          >
            {isRequestingReview
              ? "Submitting..."
              : queuedCount > 0
                ? `Finish & Submit (${queuedCount} queued)`
                : "Finish & Submit"}
          </button>
        )}
        {project.status === "needs_review" && (
          <button
            type="button"
            onClick={onApprove}
            disabled={isApproving}
            style={{
              ...styles.button,
              backgroundColor: isApproving ? "#94a3b8" : "#22c55e",
              color: "#fff",
              cursor: isApproving ? "not-allowed" : "pointer",
            }}
          >
            {isApproving ? "Approving..." : "Approve"}
          </button>
        )}
        <ExportDropdown project={project} />
        <button
          type="button"
          onClick={onDeleteProject}
          style={{ ...styles.button, backgroundColor: "#fee2e2", color: "#b91c1c" }}
        >
          Delete Project
        </button>
      </div>
    </div>
  );
}
