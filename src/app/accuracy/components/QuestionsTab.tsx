"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  X,
  AlertCircle,
  MessageSquare,
  FileText,
  ExternalLink,
  CheckCircle,
  Edit3,
  Lock,
  Flag,
  Trash2,
  Download,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";
import { InlineLoader } from "@/components/ui/loading";
import { exportQuestionLog } from "@/lib/exportUtils";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { formatLogDate, formatFullDate } from "./constants";
import type {
  QuestionLogEntry,
  QuestionLogStats,
  QuestionLogStatus,
  QuestionLogSource,
  Pagination,
  statusConfig,
} from "./types";

type QuestionsTabProps = {
  isAdmin: boolean;
};

function StatusIcon({ status }: { status: QuestionLogStatus }) {
  switch (status) {
    case "answered":
      return <MessageSquare size={14} />;
    case "verified":
      return <CheckCircle size={14} />;
    case "corrected":
      return <Edit3 size={14} />;
    case "locked":
      return <Lock size={14} />;
    case "resolved":
      return <Flag size={14} />;
    case "pending":
      return <Clock size={14} />;
    default:
      return <MessageSquare size={14} />;
  }
}

export default function QuestionsTab({ isAdmin }: QuestionsTabProps) {
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Delete Question",
    message: "Are you sure you want to delete this question? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<QuestionLogStatus | "all">("answered");
  const [selectedSource, setSelectedSource] = useState<QuestionLogSource | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Import statusConfig at runtime to avoid circular dependency
  const { statusConfig } = require("./types");

  type QuestionLogResponse = {
    entries: QuestionLogEntry[];
    stats: QuestionLogStats;
    pagination: Pagination;
  };

  const {
    data: logData,
    isLoading: logLoading,
    error: logQueryError,
    refetch: fetchQuestionLog,
  } = useApiQuery<QuestionLogResponse>({
    queryKey: ["question-log", page, limit, searchQuery, selectedStatus, selectedSource, selectedUserId],
    url: "/api/question-log",
    params: {
      page,
      limit,
      search: searchQuery || undefined,
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      source: selectedSource !== "all" ? selectedSource : undefined,
      userId: selectedUserId || undefined,
    },
  });

  const logEntries = logData?.entries || [];
  const logStats = logData?.stats || { total: 0, answered: 0, verified: 0, corrected: 0, locked: 0, resolved: 0, pending: 0 };
  const logPagination = logData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };
  const logError = logQueryError?.message || null;

  type UsersResponse = { users: { id: string; name: string | null; email: string | null }[] };
  const { data: usersData } = useApiQuery<UsersResponse>({
    queryKey: ["users-list"],
    url: "/api/users",
    responseKey: "users",
  });
  const users = (usersData as unknown as { id: string; name: string | null; email: string | null }[]) || [];

  const deleteMutation = useApiMutation<void, { id: string; source: string }>({
    url: (vars) => `/api/question-log?id=${vars.id}&source=${vars.source}`,
    method: "DELETE",
    invalidateKeys: [["question-log"]],
  });

  const deletingId = deleteMutation.isPending ? deleteMutation.variables?.id : null;

  const toggleLogExpanded = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("answered");
    setSelectedSource("all");
    setSelectedUserId("");
    setPage(1);
  };

  const hasActiveFilters = searchQuery || selectedStatus !== "answered" || selectedSource !== "all" || selectedUserId;

  const handleDeleteEntry = async (entry: QuestionLogEntry) => {
    const confirmed = await confirm();
    if (!confirmed) return;
    deleteMutation.mutate({ id: entry.id, source: entry.source });
  };

  return (
    <>
      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{logStats.total}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Total</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0369a1" }}>{logStats.answered}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Answered</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{logStats.verified}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Verified</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{logStats.corrected}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Corrected</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#4b5563" }}>{logStats.locked}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Locked</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>{logStats.resolved}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Resolved</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ background: "#f1f5f9", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", gap: "8px", background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 12px" }}>
            <Search size={16} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search questions or responses..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{ flex: 1, border: "none", outline: "none", fontSize: "0.875rem", background: "transparent" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              background: showFilters ? "#0ea5e9" : "white",
              color: showFilters ? "white" : "#64748b",
              border: showFilters ? "none" : "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <Filter size={14} />
            Filters
            {hasActiveFilters && <span style={{ width: "8px", height: "8px", background: "#dc2626", borderRadius: "50%" }} />}
          </button>
          <button
            onClick={() => fetchQuestionLog()}
            disabled={logLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={logLoading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => exportQuestionLog(logEntries, { format: "xlsx" })}
            disabled={logEntries.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: logEntries.length === 0 ? "#f1f5f9" : "#0ea5e9",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: logEntries.length === 0 ? "#94a3b8" : "white",
              cursor: logEntries.length === 0 ? "not-allowed" : "pointer",
            }}
            title="Export current results to Excel"
          >
            <Download size={14} />
            Export
          </button>
        </div>

        {showFilters && (
          <div style={{ display: "flex", gap: "12px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as QuestionLogStatus | "all");
                setPage(1);
              }}
              style={{ padding: "6px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem" }}
            >
              <option value="answered">Answered</option>
              <option value="verified">Verified</option>
              <option value="corrected">Corrected</option>
              <option value="locked">Locked</option>
              <option value="resolved">Resolved</option>
              <option value="pending">Pending</option>
              <option value="all">All (incl. in-progress)</option>
            </select>
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value as QuestionLogSource | "all");
                setPage(1);
              }}
              style={{ padding: "6px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem" }}
            >
              <option value="all">All Sources</option>
              <option value="project">Projects</option>
              <option value="questions">Quick Questions</option>
            </select>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPage(1);
              }}
              style={{ padding: "6px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem" }}
            >
              <option value="">All Team Members</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email || "Unknown User"}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ padding: "6px 12px", color: "#64748b", fontSize: "0.875rem", background: "none", border: "none", cursor: "pointer" }}>
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {(logError || deleteMutation.error) && (
        <div style={{ padding: "12px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} />
          {logError || deleteMutation.error?.message || "An error occurred"}
        </div>
      )}

      {/* Loading */}
      {logLoading && logEntries.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <InlineLoader size="lg" className="text-sky-500" />
          </div>
          Loading question log...
        </div>
      )}

      {/* Empty */}
      {!logLoading && logEntries.length === 0 && !logError && (
        <div style={{ textAlign: "center", padding: "32px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
          <MessageSquare size={32} style={{ margin: "0 auto 8px", color: "#94a3b8" }} />
          <p style={{ color: "#64748b", marginBottom: "4px" }}>No questions found</p>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            {selectedStatus === "answered"
              ? "Questions appear here once they have been answered."
              : selectedStatus === "all"
              ? "No questions in the system yet."
              : `No ${selectedStatus} questions found.`}
          </p>
        </div>
      )}

      {/* Entries */}
      {logEntries.length > 0 && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          {logEntries.map((entry, index) => {
            const statusCfg = statusConfig[entry.status] || { label: entry.status || "Unknown", color: "#64748b", bgColor: "#f1f5f9" };
            const isExpanded = expandedLogIds.has(entry.id);

            return (
              <div key={entry.id} style={{ borderBottom: index < logEntries.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <button
                  onClick={() => toggleLogExpanded(entry.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px",
                    textAlign: "left",
                    background: isExpanded ? "#f8fafc" : "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown size={14} style={{ color: "#94a3b8", marginTop: "4px", flexShrink: 0 }} />
                  ) : (
                    <ChevronRight size={14} style={{ color: "#94a3b8", marginTop: "4px", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          backgroundColor: statusCfg.bgColor,
                          color: statusCfg.color,
                        }}
                      >
                        <StatusIcon status={entry.status} />
                        {statusCfg.label}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        {entry.source === "project" ? <FileText size={12} /> : <MessageSquare size={12} />}
                        {entry.source === "project" ? entry.projectName || "Project" : "Quick Question"}
                      </span>
                      {entry.userEditedAnswer && (
                        <span style={{ fontSize: "0.75rem", fontWeight: 500, padding: "2px 8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#fef2f2", color: "#dc2626" }}>
                          <Edit3 size={12} />
                          Edited
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.question}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                      {entry.response}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {entry.finalizedBy && (
                      <div style={{ fontSize: "0.875rem", color: "#475569" }}>{entry.finalizedBy}</div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }} title={formatFullDate(entry.finalizedAt)}>
                      {formatLogDate(entry.finalizedAt)}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ padding: "0 12px 16px 38px", background: "#f8fafc" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "0.75rem", color: "#64748b", marginBottom: "12px", padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        <span>Created: {formatFullDate(entry.createdAt)}</span>
                      </div>
                      {entry.finalizedAt !== entry.createdAt && (
                        <div>
                          <span>Finalized: {formatFullDate(entry.finalizedAt)}</span>
                        </div>
                      )}
                      {(entry.askedBy || entry.askedByEmail) && (
                        <div>
                          <span>Asked by: {entry.askedBy || entry.askedByEmail}</span>
                        </div>
                      )}
                      {entry.finalizedBy && (
                        <div>
                          <span>Finalized by: {entry.finalizedBy}</span>
                        </div>
                      )}
                    </div>

                    {(entry.customerName || entry.projectName) && entry.source === "project" && (
                      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "0.875rem" }}>
                        {entry.customerName && (
                          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "8px 12px" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Customer: </span>
                            <span style={{ color: "#166534", fontWeight: 500 }}>{entry.customerName}</span>
                          </div>
                        )}
                        {entry.projectName && (
                          <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "8px 12px" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Project: </span>
                            <span style={{ color: "#854d0e", fontWeight: 500 }}>{entry.projectName}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.reviewRequestedBy && (
                      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "0.875rem" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Review requested by: </span>
                        <span style={{ color: "#0369a1" }}>{entry.reviewRequestedBy}</span>
                        {entry.reviewRequestedAt && (
                          <span style={{ color: "#64748b", marginLeft: "8px" }}>on {formatFullDate(entry.reviewRequestedAt)}</span>
                        )}
                      </div>
                    )}

                    {entry.flaggedBy && (
                      <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "0.875rem" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Flagged by: </span>
                        <span style={{ color: "#92400e" }}>{entry.flaggedBy}</span>
                        {entry.flaggedAt && (
                          <span style={{ color: "#64748b", marginLeft: "8px" }}>on {formatFullDate(entry.flaggedAt)}</span>
                        )}
                        {entry.flagNote && (
                          <div style={{ marginTop: "4px", color: "#78350f" }}>Note: {entry.flagNote}</div>
                        )}
                        {entry.flagResolutionNote && (
                          <div style={{ marginTop: "4px", color: "#166534", background: "#dcfce7", padding: "4px 8px", borderRadius: "4px" }}>
                            Resolution: {entry.flagResolutionNote}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: "12px" }}>
                      <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "4px", textTransform: "uppercase" }}>Question</h5>
                      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                        {entry.question}
                      </div>
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: entry.userEditedAnswer ? "#dc2626" : "#64748b", marginBottom: "4px", textTransform: "uppercase" }}>
                        {entry.userEditedAnswer ? "Original Response" : "Response"}
                      </h5>
                      <div style={{ background: "white", border: entry.userEditedAnswer ? "1px solid #fecaca" : "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
                        {entry.response}
                      </div>
                    </div>

                    {entry.userEditedAnswer && (
                      <div style={{ marginBottom: "12px" }}>
                        <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: "#059669", marginBottom: "4px", textTransform: "uppercase" }}>Corrected Answer</h5>
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "12px", fontSize: "0.875rem", color: "#166534", whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
                          {entry.userEditedAnswer}
                        </div>
                      </div>
                    )}

                    {(entry.reasoning || entry.inference || entry.sources || entry.confidence) && (
                      <div style={{ marginBottom: "12px" }}>
                        <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "4px", textTransform: "uppercase" }}>Transparency</h5>
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "12px", fontSize: "0.875rem" }}>
                          {entry.confidence && (
                            <div style={{ marginBottom: "8px" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>Confidence: </span>
                              <span style={{ color: "#1e293b" }}>{entry.confidence}</span>
                            </div>
                          )}
                          {entry.reasoning && (
                            <div style={{ marginBottom: "8px" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>Reasoning: </span>
                              <span style={{ color: "#1e293b" }}>{entry.reasoning}</span>
                            </div>
                          )}
                          {entry.inference && (
                            <div style={{ marginBottom: "8px" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>Inference: </span>
                              <span style={{ color: entry.inference.toLowerCase() === "none" ? "#059669" : "#d97706", fontWeight: 500 }}>
                                {entry.inference}
                              </span>
                            </div>
                          )}
                          {entry.sources && (
                            <div>
                              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>Sources: </span>
                              <span style={{ color: "#1e293b" }}>{entry.sources}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      {entry.source === "project" && entry.projectId && (
                        <Link
                          href={`/projects/${entry.projectId}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.875rem", color: "#0ea5e9", textDecoration: "none" }}
                        >
                          <ExternalLink size={14} />
                          View in Project
                        </Link>
                      )}

                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(entry);
                          }}
                          disabled={deletingId === entry.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.875rem",
                            color: deletingId === entry.id ? "#94a3b8" : "#dc2626",
                            background: "none",
                            border: "none",
                            cursor: deletingId === entry.id ? "not-allowed" : "pointer",
                            padding: 0,
                          }}
                          title="Delete this question (cannot be undone)"
                        >
                          {deletingId === entry.id ? (
                            <InlineLoader size="sm" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          {deletingId === entry.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {logPagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", padding: "12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
          <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
            {(logPagination.page - 1) * logPagination.limit + 1} -{" "}
            {Math.min(logPagination.page * logPagination.limit, logPagination.total)} of {logPagination.total}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={logPagination.page === 1}
              style={{
                padding: "6px 12px",
                background: logPagination.page === 1 ? "#e2e8f0" : "#0ea5e9",
                color: logPagination.page === 1 ? "#94a3b8" : "white",
                borderRadius: "6px",
                fontSize: "0.875rem",
                border: "none",
                cursor: logPagination.page === 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logPagination.page === logPagination.totalPages}
              style={{
                padding: "6px 12px",
                background: logPagination.page === logPagination.totalPages ? "#e2e8f0" : "#0ea5e9",
                color: logPagination.page === logPagination.totalPages ? "#94a3b8" : "white",
                borderRadius: "6px",
                fontSize: "0.875rem",
                border: "none",
                cursor: logPagination.page === logPagination.totalPages ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </>
  );
}
