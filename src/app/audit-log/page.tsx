"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  FileText,
  Users,
  FolderKanban,
  Globe,
  FileCheck,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
  MessageSquare,
  Settings,
  Code,
} from "lucide-react";

type AuditEntityType =
  | "SKILL"
  | "CUSTOMER"
  | "PROJECT"
  | "DOCUMENT"
  | "REFERENCE_URL"
  | "CONTRACT"
  | "USER"
  | "SETTING"
  | "PROMPT"
  | "CONTEXT_SNIPPET"
  | "ANSWER";

type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "VIEWED"
  | "EXPORTED"
  | "OWNER_ADDED"
  | "OWNER_REMOVED"
  | "STATUS_CHANGED"
  | "REFRESHED"
  | "MERGED"
  | "CORRECTED"
  | "APPROVED"
  | "REVIEW_REQUESTED";

type AuditLogEntry = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityTitle: string | null;
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const entityTypeConfig: Record<
  AuditEntityType,
  { label: string; icon: typeof FileText; color: string }
> = {
  SKILL: { label: "Skill", icon: FileText, color: "#0ea5e9" },
  CUSTOMER: { label: "Customer", icon: Users, color: "#8b5cf6" },
  PROJECT: { label: "Project", icon: FolderKanban, color: "#f97316" },
  DOCUMENT: { label: "Document", icon: FileText, color: "#10b981" },
  REFERENCE_URL: { label: "URL", icon: Globe, color: "#6366f1" },
  CONTRACT: { label: "Contract", icon: FileCheck, color: "#ec4899" },
  USER: { label: "User", icon: User, color: "#64748b" },
  SETTING: { label: "Setting", icon: Settings, color: "#94a3b8" },
  PROMPT: { label: "Prompt", icon: Code, color: "#f59e0b" },
  CONTEXT_SNIPPET: { label: "Snippet", icon: Code, color: "#84cc16" },
  ANSWER: { label: "Answer", icon: MessageSquare, color: "#14b8a6" },
};

const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "#10b981" },
  UPDATED: { label: "Updated", color: "#0ea5e9" },
  DELETED: { label: "Deleted", color: "#ef4444" },
  VIEWED: { label: "Viewed", color: "#64748b" },
  EXPORTED: { label: "Exported", color: "#8b5cf6" },
  OWNER_ADDED: { label: "Owner Added", color: "#10b981" },
  OWNER_REMOVED: { label: "Owner Removed", color: "#f97316" },
  STATUS_CHANGED: { label: "Status Changed", color: "#0ea5e9" },
  REFRESHED: { label: "Refreshed", color: "#6366f1" },
  MERGED: { label: "Merged", color: "#ec4899" },
  CORRECTED: { label: "Corrected", color: "#f59e0b" },
  APPROVED: { label: "Approved", color: "#10b981" },
  REVIEW_REQUESTED: { label: "Review Requested", color: "#8b5cf6" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    if (value.length <= 3) return value.map(v => formatValue(v)).join(", ");
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value).slice(0, 100) + "...";
  }
  const str = String(value);
  return str.length > 100 ? str.slice(0, 100) + "..." : str;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | "">("");
  const [selectedAction, setSelectedAction] = useState<AuditAction | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Expanded entries
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (searchQuery) params.set("search", searchQuery);
      if (selectedEntityType) params.set("entityType", selectedEntityType);
      if (selectedAction) params.set("action", selectedAction);

      const response = await fetch(`/api/audit-log?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch audit log");
      }

      const data = await response.json();
      setEntries(data.entries);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, selectedEntityType, selectedAction]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedEntityType("");
    setSelectedAction("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery || selectedEntityType || selectedAction;

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#1e293b",
            marginBottom: "8px",
          }}
        >
          Audit Log
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Track all changes across skills, customers, projects, and more
        </p>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
              minWidth: "200px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "8px 12px",
            }}
          >
            <Search size={18} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search by entity name, user..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                fontSize: "0.9rem",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  padding: "2px",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              backgroundColor: showFilters ? "#0ea5e9" : "#f8fafc",
              border: `1px solid ${showFilters ? "#0ea5e9" : "#e2e8f0"}`,
              borderRadius: "8px",
              color: showFilters ? "#fff" : "#475569",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && (
              <span
                style={{
                  backgroundColor: showFilters ? "#fff" : "#0ea5e9",
                  color: showFilters ? "#0ea5e9" : "#fff",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                !
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchAuditLog}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              color: "#475569",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
            }}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #e2e8f0",
              flexWrap: "wrap",
            }}
          >
            {/* Entity Type */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "#64748b",
                  marginBottom: "4px",
                }}
              >
                Entity Type
              </label>
              <select
                value={selectedEntityType}
                onChange={(e) => {
                  setSelectedEntityType(e.target.value as AuditEntityType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.9rem",
                  minWidth: "150px",
                }}
              >
                <option value="">All Types</option>
                {Object.entries(entityTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "#64748b",
                  marginBottom: "4px",
                }}
              >
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value as AuditAction | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.9rem",
                  minWidth: "150px",
                }}
              >
                <option value="">All Actions</option>
                {Object.entries(actionConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "transparent",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  alignSelf: "flex-end",
                }}
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#dc2626",
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && entries.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            color: "#64748b",
          }}
        >
          <Loader2 size={40} className="animate-spin" style={{ color: "#0ea5e9", marginBottom: "16px" }} />
          <p>Loading audit log...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && entries.length === 0 && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
            border: "1px dashed #e2e8f0",
          }}
        >
          <Clock size={48} style={{ color: "#94a3b8", marginBottom: "16px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#475569", marginBottom: "8px" }}>
            No audit log entries yet
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            {hasActiveFilters
              ? "No entries match your filters. Try adjusting your search criteria."
              : "Changes to skills, customers, and other items will appear here."}
          </p>
        </div>
      )}

      {/* Audit Log Entries */}
      {entries.length > 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {entries.map((entry, index) => {
            const entityConfig = entityTypeConfig[entry.entityType];
            const actConfig = actionConfig[entry.action];
            const isExpanded = expandedIds.has(entry.id);
            const EntityIcon = entityConfig.icon;

            return (
              <div
                key={entry.id}
                style={{
                  borderBottom: index < entries.length - 1 ? "1px solid #f1f5f9" : "none",
                }}
              >
                {/* Entry Header */}
                <button
                  onClick={() => toggleExpanded(entry.id)}
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
                  <div
                    style={{
                      padding: "0 16px 16px 64px",
                      backgroundColor: "#f8fafc",
                    }}
                  >
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
                        <h4
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: "#475569",
                            marginBottom: "8px",
                          }}
                        >
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
                                borderBottom:
                                  i < Object.keys(entry.changes!).length - 1
                                    ? "1px solid #f1f5f9"
                                    : "none",
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
                        <h4
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: "#475569",
                            marginBottom: "8px",
                          }}
                        >
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
                    <div
                      style={{
                        marginTop: "12px",
                        fontSize: "0.8rem",
                        color: "#94a3b8",
                      }}
                    >
                      ID: {entry.entityId}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "20px",
            padding: "12px 16px",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              style={{
                padding: "8px 16px",
                backgroundColor: pagination.page === 1 ? "#f1f5f9" : "#0ea5e9",
                color: pagination.page === 1 ? "#94a3b8" : "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: pagination.page === 1 ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              style={{
                padding: "8px 16px",
                backgroundColor: pagination.page === pagination.totalPages ? "#f1f5f9" : "#0ea5e9",
                color: pagination.page === pagination.totalPages ? "#94a3b8" : "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: pagination.page === pagination.totalPages ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
