"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import { exportQuestionLog } from "@/lib/exportUtils";
import type {
  QuestionLogEntry,
  QuestionLogStats,
  QuestionLogStatus,
  QuestionLogSource,
  Pagination,
} from "@/app/admin/question-log/types";
import { statusConfig } from "@/app/admin/question-log/types";

type ActiveTab = "accuracy" | "question-log";

type AccuracyData = {
  summary: {
    totalAnswers: number;
    totalCorrected: number;
    overallAccuracy: number | null;
    flaggedCount: number;
    reviewsPending: number;
    reviewsApproved: number;
    reviewsCorrected: number;
  };
  confidenceDistribution: {
    High: number;
    Medium: number;
    Low: number;
    Unknown: number;
  };
  correctionRates: {
    confidence: string;
    total: number;
    corrected: number;
    correctionRate: number | null;
  }[];
  skillsNeedingAttention: {
    skillId: string;
    title: string;
    corrections: number;
    total: number;
    correctionRate: number;
  }[];
  daily: {
    date: string;
    high: number;
    medium: number;
    low: number;
    corrected: number;
    total: number;
    accuracyRate: number | null;
  }[];
  recentCorrections: {
    id: string;
    question: string;
    response: string;
    userEditedAnswer: string | null;
    confidence: string | null;
    usedSkills: { id: string; title: string }[] | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    project: { id: string; name: string };
  }[];
  period: { days: number; startDate: string };
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High: "#16a34a",
  Medium: "#eab308",
  Low: "#dc2626",
  Unknown: "#94a3b8",
};

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

// Question Log helper functions
function formatLogDate(dateString: string): string {
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

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

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

export default function AccuracyPage() {
  const { data: session } = useSession();
  // Check for org data access using capabilities (with legacy fallback)
  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("VIEW_ORG_DATA") ||
    userCapabilities.includes("ADMIN") ||
    (session?.user as { role?: string })?.role === "ADMIN" ||
    (session?.user as { role?: string })?.role === "PROMPT_ADMIN";

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("accuracy");

  // Accuracy tab state
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [expandedCorrection, setExpandedCorrection] = useState<string | null>(null);

  // Question Log tab state
  const [logEntries, setLogEntries] = useState<QuestionLogEntry[]>([]);
  const [logStats, setLogStats] = useState<QuestionLogStats>({ total: 0, answered: 0, verified: 0, corrected: 0, locked: 0, resolved: 0, pending: 0 });
  const [logPagination, setLogPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<QuestionLogStatus | "all">("answered");
  const [selectedSource, setSelectedSource] = useState<QuestionLogSource | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>(""); // User filter for org-wide tracking
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accuracy/stats?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch accuracy data");
      const result = await res.json();
      // Handle both old format (direct data) and new format ({ data: ... })
      setData(result.data || result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Question Log fetch
  const fetchQuestionLog = useCallback(async () => {
    setLogLoading(true);
    setLogError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(logPagination.page));
      params.set("limit", String(logPagination.limit));
      if (searchQuery) params.set("search", searchQuery);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedSource !== "all") params.set("source", selectedSource);
      if (selectedUserId) params.set("userId", selectedUserId);

      const response = await fetch(`/api/question-log?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch question log");
      const result = await response.json();
      const logData = result.data || result;
      setLogEntries(logData.entries || []);
      setLogStats(logData.stats || { total: 0, answered: 0, verified: 0, corrected: 0, locked: 0, resolved: 0, pending: 0 });
      setLogPagination(logData.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to load question log");
    } finally {
      setLogLoading(false);
    }
  }, [logPagination.page, logPagination.limit, searchQuery, selectedStatus, selectedSource, selectedUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch users for the filter dropdown
  useEffect(() => {
    if (activeTab === "question-log" && users.length === 0) {
      fetch("/api/users")
        .then((res) => res.json())
        .then((result) => {
          const data = result.data || result;
          setUsers(data.users || []);
        })
        .catch(() => {
          // Silent fail - users filter won't be populated
        });
    }
  }, [activeTab, users.length]);

  // Fetch question log when switching to that tab or when filters change
  useEffect(() => {
    if (activeTab === "question-log") {
      fetchQuestionLog();
    }
  }, [activeTab, fetchQuestionLog]);

  const maxDaily = data?.daily?.reduce((max, d) => Math.max(max, d.total), 0) || 1;

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
    setLogPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery || selectedStatus !== "answered" || selectedSource !== "all" || selectedUserId;

  const handleDeleteEntry = async (entry: QuestionLogEntry) => {
    if (!confirm(`Delete this question?\n\n"${entry.question.slice(0, 100)}${entry.question.length > 100 ? "..." : ""}"\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/question-log?id=${entry.id}&source=${entry.source}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete");
      }

      // Remove from local state
      setLogEntries((prev) => prev.filter((e) => e.id !== entry.id));
      // Update stats
      setLogStats((prev) => ({
        ...prev,
        total: prev.total - 1,
        [entry.status]: Math.max(0, (prev[entry.status] || 0) - 1),
      }));
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to delete question");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>
          AI Accuracy
        </h1>
        <p style={{ color: "#64748b" }}>
          Track answer quality and review the full question log
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "2px solid #e2e8f0" }}>
        <button
          onClick={() => setActiveTab("accuracy")}
          style={{
            padding: "12px 20px",
            fontSize: "0.95rem",
            fontWeight: activeTab === "accuracy" ? 600 : 400,
            color: activeTab === "accuracy" ? "#0ea5e9" : "#64748b",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "accuracy" ? "2px solid #0ea5e9" : "2px solid transparent",
            marginBottom: "-2px",
            cursor: "pointer",
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("question-log")}
          style={{
            padding: "12px 20px",
            fontSize: "0.95rem",
            fontWeight: activeTab === "question-log" ? 600 : 400,
            color: activeTab === "question-log" ? "#0ea5e9" : "#64748b",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "question-log" ? "2px solid #0ea5e9" : "2px solid transparent",
            marginBottom: "-2px",
            cursor: "pointer",
          }}
        >
          Question Log
        </button>
      </div>

      {/* Accuracy Tab Content */}
      {activeTab === "accuracy" && (
        <>
          {/* Controls */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: "white",
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            <button
              onClick={fetchData}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "#0ea5e9",
                color: "white",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
              Loading accuracy data...
            </div>
          )}

          {error && (
            <div style={{ marginBottom: "24px" }}>
              <InlineError message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {!loading && data && (
            <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Overall Accuracy
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: data.summary.overallAccuracy && data.summary.overallAccuracy >= 90 ? "#16a34a" : "#eab308",
                }}
              >
                {formatPercent(data.summary.overallAccuracy)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                {data.summary.totalAnswers - data.summary.totalCorrected} / {data.summary.totalAnswers} uncorrected
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Total Answers
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>
                {data.summary.totalAnswers.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Last {days} days
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Corrections Made
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626" }}>
                {data.summary.totalCorrected}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Answers that needed fixing
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Flagged for Attention
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f59e0b" }}>
                {data.summary.flaggedCount}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Self-flagged answers
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Reviews Pending
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0ea5e9" }}>
                {data.summary.reviewsPending}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Awaiting review
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            {/* Confidence Distribution */}
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Confidence Distribution</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(["High", "Medium", "Low", "Unknown"] as const).map((level) => {
                  const count = data.confidenceDistribution[level];
                  const total = Object.values(data.confidenceDistribution).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={level}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.875rem", color: CONFIDENCE_COLORS[level], fontWeight: 500 }}>
                          {level}
                        </span>
                        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: CONFIDENCE_COLORS[level],
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Correction Rate by Confidence */}
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Correction Rate by Confidence</h3>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
                How often each confidence level needs correction
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {data.correctionRates.filter(r => r.total > 0).map((rate) => (
                  <div key={rate.confidence}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                        {rate.confidence}
                      </span>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: rate.correctionRate && rate.correctionRate > 20 ? "#dc2626" :
                                 rate.correctionRate && rate.correctionRate > 10 ? "#eab308" : "#16a34a",
                        }}
                      >
                        {formatPercent(rate.correctionRate)} corrected
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {rate.corrected} of {rate.total} answers
                    </div>
                  </div>
                ))}
              </div>
              {data.correctionRates.some(r => r.confidence === "High" && r.correctionRate && r.correctionRate > 5) && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    background: "#fef3c7",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    color: "#92400e",
                  }}
                >
                  High confidence answers are being corrected frequently - review your knowledge base.
                </div>
              )}
            </div>
          </div>

          {/* Daily Trend */}
          <div
            style={{
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              marginBottom: "32px",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Answer Volume & Corrections Over Time</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "120px" }}>
              {data.daily.slice(-30).map((day) => {
                const height = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
                const correctedHeight = maxDaily > 0 ? (day.corrected / maxDaily) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      height: "100%",
                      position: "relative",
                    }}
                    title={`${day.date}: ${day.total} answers, ${day.corrected} corrected`}
                  >
                    {/* Corrected portion */}
                    <div
                      style={{
                        width: "100%",
                        height: `${correctedHeight}px`,
                        minHeight: day.corrected > 0 ? "2px" : "0px",
                        background: "#dc2626",
                        position: "absolute",
                        bottom: 0,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                    {/* Total bar */}
                    <div
                      style={{
                        width: "100%",
                        height: `${height}px`,
                        minHeight: day.total > 0 ? "4px" : "0px",
                        background: "#e2e8f0",
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                fontSize: "0.75rem",
                color: "#94a3b8",
              }}
            >
              <span>{data.daily[0]?.date || ""}</span>
              <span>
                <span style={{ color: "#e2e8f0", background: "#e2e8f0", padding: "0 4px", borderRadius: "2px" }}>__</span> Total{" "}
                <span style={{ color: "#dc2626", background: "#dc2626", padding: "0 4px", borderRadius: "2px", marginLeft: "8px" }}>__</span> Corrected
              </span>
              <span>{data.daily[data.daily.length - 1]?.date || ""}</span>
            </div>
          </div>

          {/* Skills Needing Attention */}
          {data.skillsNeedingAttention.length > 0 && (
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #fecaca",
                marginBottom: "32px",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "8px", color: "#dc2626" }}>
                Skills Needing Attention
              </h3>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
                These skills have high correction rates - consider updating their content
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.skillsNeedingAttention.map((skill) => (
                  <div
                    key={skill.skillId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                      background: "#fef2f2",
                      borderRadius: "6px",
                    }}
                  >
                    <Link
                      href={`/knowledge?edit=${skill.skillId}`}
                      style={{ color: "#1e293b", fontWeight: 500, textDecoration: "none" }}
                    >
                      {skill.title}
                    </Link>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#dc2626", fontWeight: 600 }}>
                        {skill.correctionRate.toFixed(0)}% correction rate
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {skill.corrections} of {skill.total} uses
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Corrections */}
          <div
            style={{
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>
              Recent Corrections
              <span style={{ fontWeight: 400, fontSize: "0.875rem", color: "#64748b", marginLeft: "8px" }}>
                (learn from mistakes)
              </span>
            </h3>
            {data.recentCorrections.length === 0 ? (
              <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
                No corrections yet - great job!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {data.recentCorrections.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "16px",
                      background: "#fef2f2",
                      borderRadius: "8px",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <Link
                        href={`/projects/${item.project.id}`}
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          textDecoration: "none",
                        }}
                      >
                        {item.project.name}
                      </Link>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : ""}
                        {item.reviewedBy && ` by ${item.reviewedBy}`}
                      </span>
                    </div>
                    <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                      Q: {item.question.length > 150 ? item.question.slice(0, 150) + "..." : item.question}
                    </div>
                    {expandedCorrection === item.id ? (
                      <>
                        <div style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 500, marginBottom: "4px" }}>
                            Original Answer:
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", whiteSpace: "pre-wrap" }}>
                            {item.response}
                          </div>
                        </div>
                        {item.userEditedAnswer && (
                          <div style={{ marginBottom: "8px" }}>
                            <div style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 500, marginBottom: "4px" }}>
                              Corrected Answer:
                            </div>
                            <div style={{ fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                              {item.userEditedAnswer}
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "16px", fontSize: "0.75rem", color: "#94a3b8" }}>
                          {item.confidence && <span>Confidence: {item.confidence}</span>}
                          {item.usedSkills && item.usedSkills.length > 0 && (
                            <span>Skills: {item.usedSkills.map((s) => s.title).join(", ")}</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {item.response.length > 100 ? item.response.slice(0, 100) + "..." : item.response}
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedCorrection(expandedCorrection === item.id ? null : item.id)}
                      style={{
                        marginTop: "8px",
                        padding: "4px 8px",
                        fontSize: "0.75rem",
                        background: "transparent",
                        border: "1px solid #e2e8f0",
                        borderRadius: "4px",
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      {expandedCorrection === item.id ? "Show Less" : "Show More"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </>
      )}

      {/* Question Log Tab Content */}
      {activeTab === "question-log" && (
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
                    setLogPagination((p) => ({ ...p, page: 1 }));
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
                onClick={fetchQuestionLog}
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
                    setLogPagination((p) => ({ ...p, page: 1 }));
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
                    setLogPagination((p) => ({ ...p, page: 1 }));
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
                    setLogPagination((p) => ({ ...p, page: 1 }));
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
          {logError && (
            <div style={{ padding: "12px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={16} />
              {logError}
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
                        {/* Status and Source Badges */}
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
                        {/* Question Preview */}
                        <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.question}
                        </div>
                        {/* Response Preview */}
                        <div style={{ fontSize: "0.875rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                          {entry.response}
                        </div>
                      </div>
                      {/* Right Side - Date and Finalizer */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {entry.finalizedBy && (
                          <div style={{ fontSize: "0.875rem", color: "#475569" }}>{entry.finalizedBy}</div>
                        )}
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }} title={formatFullDate(entry.finalizedAt)}>
                          {formatLogDate(entry.finalizedAt)}
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{ padding: "0 12px 16px 38px", background: "#f8fafc" }}>
                        {/* Metadata Row */}
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

                        {/* Customer/Project Context */}
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

                        {/* Review Request Info */}
                        {entry.reviewRequestedBy && (
                          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "0.875rem" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Review requested by: </span>
                            <span style={{ color: "#0369a1" }}>{entry.reviewRequestedBy}</span>
                            {entry.reviewRequestedAt && (
                              <span style={{ color: "#64748b", marginLeft: "8px" }}>on {formatFullDate(entry.reviewRequestedAt)}</span>
                            )}
                          </div>
                        )}

                        {/* Flag Info */}
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

                        {/* Full Question */}
                        <div style={{ marginBottom: "12px" }}>
                          <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "4px", textTransform: "uppercase" }}>Question</h5>
                          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                            {entry.question}
                          </div>
                        </div>

                        {/* Full Response */}
                        <div style={{ marginBottom: "12px" }}>
                          <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: entry.userEditedAnswer ? "#dc2626" : "#64748b", marginBottom: "4px", textTransform: "uppercase" }}>
                            {entry.userEditedAnswer ? "Original Response" : "Response"}
                          </h5>
                          <div style={{ background: "white", border: entry.userEditedAnswer ? "1px solid #fecaca" : "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
                            {entry.response}
                          </div>
                        </div>

                        {/* Corrected Answer */}
                        {entry.userEditedAnswer && (
                          <div style={{ marginBottom: "12px" }}>
                            <h5 style={{ fontSize: "0.7rem", fontWeight: 600, color: "#059669", marginBottom: "4px", textTransform: "uppercase" }}>Corrected Answer</h5>
                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "12px", fontSize: "0.875rem", color: "#166534", whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
                              {entry.userEditedAnswer}
                            </div>
                          </div>
                        )}

                        {/* Transparency Report */}
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

                        {/* Actions Row */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                          {/* Link to Original */}
                          {entry.source === "project" && entry.projectId && (
                            <Link
                              href={`/projects/${entry.projectId}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.875rem", color: "#0ea5e9", textDecoration: "none" }}
                            >
                              <ExternalLink size={14} />
                              View in Project
                            </Link>
                          )}

                          {/* Delete Button (Admin only) */}
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
                  onClick={() => setLogPagination((p) => ({ ...p, page: p.page - 1 }))}
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
                  onClick={() => setLogPagination((p) => ({ ...p, page: p.page + 1 }))}
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
        </>
      )}

      {/* Back Link */}
      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <Link
          href="/"
          style={{
            color: "#0ea5e9",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
