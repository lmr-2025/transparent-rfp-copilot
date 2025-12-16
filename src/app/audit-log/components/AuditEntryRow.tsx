"use client";

import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import {
  AuditLogEntry,
  entityTypeConfig,
  actionConfig,
  formatDate,
  formatFullDate,
  formatValue,
} from "./types";

type AuditEntryRowProps = {
  entry: AuditLogEntry;
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
};

export default function AuditEntryRow({
  entry,
  isExpanded,
  isLast,
  onToggle,
}: AuditEntryRowProps) {
  const entityConfig = entityTypeConfig[entry.entityType];
  const actConfig = actionConfig[entry.action];
  const EntityIcon = entityConfig.icon;

  return (
    <div style={{ borderBottom: !isLast ? "1px solid #f1f5f9" : "none" }}>
      {/* Entry Header */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          padding: "14px 16px",
          backgroundColor: isExpanded ? "#f8fafc" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronDown size={16} style={{ color: "#94a3b8" }} />
        ) : (
          <ChevronRight size={16} style={{ color: "#94a3b8" }} />
        )}

        {/* Entity Icon */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            backgroundColor: `${entityConfig.color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EntityIcon size={18} style={{ color: entityConfig.color }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: `${actConfig.color}15`,
                color: actConfig.color,
              }}
            >
              {actConfig.label}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                backgroundColor: "#f1f5f9",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              {entityConfig.label}
            </span>
          </div>
          <div
            style={{
              fontWeight: 500,
              color: "#1e293b",
              marginTop: "4px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.entityTitle || entry.entityId}
          </div>
        </div>

        {/* User & Time */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "0.85rem", color: "#475569" }}>
            {entry.userName || entry.userEmail || "System"}
          </div>
          <div
            style={{ fontSize: "0.8rem", color: "#94a3b8" }}
            title={formatFullDate(entry.createdAt)}
          >
            {formatDate(entry.createdAt)}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{ padding: "0 16px 16px 64px", backgroundColor: "#f8fafc" }}>
          {/* Timestamp */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "12px",
              color: "#64748b",
              fontSize: "0.85rem",
            }}
          >
            <Clock size={14} />
            {formatFullDate(entry.createdAt)}
          </div>

          {/* Changes */}
          {entry.changes && Object.keys(entry.changes).length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "8px" }}>
                Changes
              </h4>
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                {Object.entries(entry.changes).map(([field, change], i) => (
                  <div
                    key={field}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 1fr",
                      gap: "12px",
                      padding: "10px 12px",
                      borderBottom: i < Object.keys(entry.changes!).length - 1 ? "1px solid #f1f5f9" : "none",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "#475569" }}>{field}</div>
                    <div style={{ color: "#ef4444" }}>
                      <span style={{ color: "#94a3b8" }}>From: </span>
                      {formatValue(change.from)}
                    </div>
                    <div style={{ color: "#10b981" }}>
                      <span style={{ color: "#94a3b8" }}>To: </span>
                      {formatValue(change.to)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "8px" }}>
                Additional Info
              </h4>
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "0.85rem",
                  color: "#475569",
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Entity ID */}
          <div style={{ marginTop: "12px", fontSize: "0.8rem", color: "#94a3b8" }}>
            ID: {entry.entityId}
          </div>
        </div>
      )}
    </div>
  );
}
