"use client";

import { useRouter } from "next/navigation";
import { BulkProject, ProjectCustomerProfileRef } from "@/types/bulkProject";
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
    case "approved":
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
    case "approved":
      return "Approved";
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
}: ProjectHeaderProps) {
  const router = useRouter();

  return (
    <div style={{ ...styles.card, display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
      <div>
        <div style={{ marginBottom: "8px" }}>
          <span style={{ ...styles.statusBadge, ...getStatusColor(project.status) }}>
            {getStatusLabel(project.status)}
          </span>
        </div>
        <strong>Project:</strong> {project.name}
        <br />
        <strong>Worksheet:</strong> {project.sheetName}
        <br />
        <strong>Created:</strong> {new Date(project.createdAt).toLocaleString()}
        {project.reviewRequestedBy && (
          <>
            <br />
            <strong>Review requested by:</strong> {project.reviewRequestedBy}
          </>
        )}
        {project.reviewedBy && (
          <>
            <br />
            <strong>Approved by:</strong> {project.reviewedBy}
          </>
        )}
        <div style={{ marginTop: "8px" }}>
          <strong>Customers:</strong>{" "}
          {project.customerProfiles && project.customerProfiles.length > 0 ? (
            <span>
              {project.customerProfiles.map((cp: ProjectCustomerProfileRef) => (
                <span key={cp.id}>
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
                    {cp.name}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span style={{ color: "#94a3b8" }}>None linked</span>
          )}
          <button
            type="button"
            onClick={onEditCustomers}
            style={{
              marginLeft: "8px",
              padding: "2px 8px",
              fontSize: "0.8rem",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        </div>
      </div>
      <div>
        <strong>Total:</strong> {stats.total} · <strong>High:</strong> {stats.high} ·{" "}
        <strong>Medium:</strong> {stats.medium} · <strong>Low:</strong> {stats.low} ·{" "}
        <strong>Errors:</strong> {stats.errors}
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
          onClick={() => router.push("/projects/upload")}
          style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#0f172a" }}
        >
          Upload new file
        </button>
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
