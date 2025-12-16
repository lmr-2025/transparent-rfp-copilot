"use client";

import { InstructionPreset, styles, statusColors } from "./types";

type PresetCardProps = {
  preset: InstructionPreset;
  expanded: boolean;
  onToggleExpand: () => void;
  actionInProgress: string | null;
  variant: "pending" | "approved" | "other";
  // Pending-specific
  rejectingId?: string | null;
  rejectionReason?: string;
  onSetRejectingId?: (id: string | null) => void;
  onSetRejectionReason?: (reason: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  // Approved-specific
  onEdit?: (preset: InstructionPreset) => void;
  onSetDefault?: (id: string, isDefault: boolean) => void;
  // Common
  onDelete?: (id: string) => void;
};

export default function PresetCard({
  preset,
  expanded,
  onToggleExpand,
  actionInProgress,
  variant,
  rejectingId,
  rejectionReason = "",
  onSetRejectingId,
  onSetRejectionReason,
  onApprove,
  onReject,
  onEdit,
  onSetDefault,
  onDelete,
}: PresetCardProps) {
  const isPending = variant === "pending";
  const isApproved = variant === "approved";
  const isOther = variant === "other";

  const cardStyle = {
    ...styles.card,
    ...(isPending && {
      borderColor: statusColors.PENDING_APPROVAL.border,
      backgroundColor: "#fffbeb",
    }),
    ...(isOther && { opacity: 0.7 }),
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <strong style={{ fontSize: "15px" }}>{preset.name}</strong>
            {isPending && (
              <span style={{
                ...styles.badge,
                backgroundColor: statusColors.PENDING_APPROVAL.bg,
                color: statusColors.PENDING_APPROVAL.text,
              }}>
                Pending
              </span>
            )}
            {isApproved && (
              <>
                <span style={{
                  ...styles.badge,
                  backgroundColor: statusColors.APPROVED.bg,
                  color: statusColors.APPROVED.text,
                }}>
                  Shared
                </span>
                {preset.isDefault && (
                  <span style={{
                    ...styles.badge,
                    backgroundColor: "#dbeafe",
                    color: "#1d4ed8",
                  }}>
                    Default
                  </span>
                )}
              </>
            )}
            {isOther && (
              <span style={{
                ...styles.badge,
                backgroundColor: statusColors[preset.shareStatus].bg,
                color: statusColors[preset.shareStatus].text,
              }}>
                {preset.shareStatus === "REJECTED" ? "Rejected" : "Private"}
              </span>
            )}
          </div>
          {preset.description && !isOther && (
            <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              {preset.description}
            </p>
          )}
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            {isPending && (
              <>
                Submitted by {preset.createdByEmail || "Unknown"} on{" "}
                {preset.shareRequestedAt ? new Date(preset.shareRequestedAt).toLocaleDateString() : "N/A"}
              </>
            )}
            {isApproved && (
              <>
                Created by {preset.createdByEmail || "Unknown"}
                {preset.approvedAt && ` · Approved ${new Date(preset.approvedAt).toLocaleDateString()}`}
              </>
            )}
            {isOther && (
              <>
                By {preset.createdByEmail || "Unknown"}
                {preset.rejectionReason && ` · Rejection reason: ${preset.rejectionReason}`}
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={onToggleExpand}
            style={{
              ...styles.button,
              backgroundColor: "#f1f5f9",
              color: "#475569",
            }}
          >
            {expanded ? "Hide" : "Preview"}
          </button>

          {/* Pending actions */}
          {isPending && onApprove && (
            <button
              onClick={() => onApprove(preset.id)}
              disabled={actionInProgress === preset.id}
              style={{
                ...styles.button,
                backgroundColor: "#22c55e",
                color: "#fff",
                opacity: actionInProgress === preset.id ? 0.6 : 1,
              }}
            >
              Approve
            </button>
          )}
          {isPending && rejectingId !== preset.id && onSetRejectingId && (
            <button
              onClick={() => onSetRejectingId(preset.id)}
              style={{
                ...styles.button,
                backgroundColor: "#ef4444",
                color: "#fff",
              }}
            >
              Reject
            </button>
          )}
          {isPending && rejectingId === preset.id && onSetRejectingId && onSetRejectionReason && onReject && (
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => onSetRejectionReason(e.target.value)}
                placeholder="Reason (optional)"
                style={{
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "1px solid #fecaca",
                  borderRadius: "4px",
                  width: "140px",
                }}
              />
              <button
                onClick={() => onReject(preset.id)}
                disabled={actionInProgress === preset.id}
                style={{
                  ...styles.button,
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  padding: "6px 10px",
                  opacity: actionInProgress === preset.id ? 0.6 : 1,
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => { onSetRejectingId(null); onSetRejectionReason(""); }}
                style={{
                  ...styles.button,
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  padding: "6px 10px",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Approved actions */}
          {isApproved && onEdit && (
            <button
              onClick={() => onEdit(preset)}
              style={{
                ...styles.button,
                backgroundColor: "#f0f9ff",
                color: "#0369a1",
              }}
            >
              Edit
            </button>
          )}
          {isApproved && !preset.isDefault && onSetDefault && (
            <button
              onClick={() => onSetDefault(preset.id, true)}
              disabled={actionInProgress === preset.id}
              style={{
                ...styles.button,
                backgroundColor: "#faf5ff",
                color: "#7c3aed",
                opacity: actionInProgress === preset.id ? 0.6 : 1,
              }}
            >
              Set Default
            </button>
          )}
          {isApproved && preset.isDefault && onSetDefault && (
            <button
              onClick={() => onSetDefault(preset.id, false)}
              disabled={actionInProgress === preset.id}
              style={{
                ...styles.button,
                backgroundColor: "#f1f5f9",
                color: "#64748b",
                opacity: actionInProgress === preset.id ? 0.6 : 1,
              }}
            >
              Remove Default
            </button>
          )}

          {/* Delete (approved and other) */}
          {(isApproved || isOther) && onDelete && (
            <button
              onClick={() => onDelete(preset.id)}
              disabled={actionInProgress === preset.id}
              style={{
                ...styles.button,
                backgroundColor: "#fff",
                color: "#dc2626",
                border: "1px solid #fecaca",
                opacity: actionInProgress === preset.id ? 0.6 : 1,
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          marginTop: "12px",
          padding: "12px",
          backgroundColor: isPending ? "#fff" : "#f8fafc",
          borderRadius: "6px",
          border: isPending ? "1px solid #e2e8f0" : undefined,
        }}>
          <pre style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: 1.5,
            color: "#334155",
          }}>
            {preset.content}
          </pre>
        </div>
      )}
    </div>
  );
}
