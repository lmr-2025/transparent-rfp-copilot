"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Edit3,
} from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { useApiQuery } from "@/hooks/use-api";

type ProjectWithFeedback = {
  id: string;
  name: string;
  customerName?: string;
  status: string;
  createdAt: string;
  feedbackStats: {
    totalRows: number;
    completedRows: number;
    editedResponses: number;
    reviewedRows: number;
    flaggedRows: number;
  };
};

type RFPFeedbackItem = {
  id: string;
  rowNumber: number;
  question: string;
  feedbackType: "response_edited" | "confidence_changed";
  original?: string;
  corrected?: string;
  originalConfidence?: string;
  newConfidence?: string;
};

type RFPFeedbackResponse = {
  projectId: string;
  projectName: string;
  customerName?: string;
  stats: {
    totalRows: number;
    completedRows: number;
    editedResponses: number;
    reviewedRows: number;
    flaggedRows: number;
  };
  feedback: RFPFeedbackItem[];
};

export default function RFPsTab() {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Fetch projects list
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useApiQuery<{ projects: ProjectWithFeedback[] }>({
    queryKey: ["projects-with-feedback"],
    url: "/api/projects",
    params: { includeFeedbackStats: true },
  });

  const projects = projectsData?.projects || [];

  // Fetch expanded project's feedback
  const {
    data: feedbackData,
    isLoading: feedbackLoading,
  } = useApiQuery<RFPFeedbackResponse>({
    queryKey: ["project-feedback", expandedProjectId],
    url: `/api/projects/${expandedProjectId}/feedback`,
    enabled: !!expandedProjectId,
  });

  // Calculate totals
  const totals = projects.reduce(
    (acc, p) => ({
      totalRows: acc.totalRows + (p.feedbackStats?.totalRows || 0),
      completedRows: acc.completedRows + (p.feedbackStats?.completedRows || 0),
      editedResponses: acc.editedResponses + (p.feedbackStats?.editedResponses || 0),
      reviewedRows: acc.reviewedRows + (p.feedbackStats?.reviewedRows || 0),
      flaggedRows: acc.flaggedRows + (p.feedbackStats?.flaggedRows || 0),
    }),
    { totalRows: 0, completedRows: 0, editedResponses: 0, reviewedRows: 0, flaggedRows: 0 }
  );

  const projectsWithFeedback = projects.filter(
    (p) => p.feedbackStats && p.feedbackStats.editedResponses > 0
  );

  return (
    <>
      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{totals.totalRows}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Total Rows</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #bbf7d0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#16a34a" }}>{totals.completedRows}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Completed</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #fecaca", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626" }}>{totals.editedResponses}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Responses Edited</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #bfdbfe", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{totals.reviewedRows}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Reviewed</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #fde68a", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>{totals.flaggedRows}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Flagged</div>
        </div>
      </div>

      {/* Refresh button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button
          onClick={() => refetchProjects()}
          disabled={projectsLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            background: "#0ea5e9",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          <RefreshCw size={14} className={projectsLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {projectsLoading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <InlineLoader size="lg" className="text-sky-500" />
          <p style={{ marginTop: "12px" }}>Loading RFP feedback...</p>
        </div>
      )}

      {/* Error */}
      {projectsError && (
        <div style={{ padding: "16px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", marginBottom: "16px" }}>
          {projectsError.message || "Failed to load projects"}
        </div>
      )}

      {/* Empty state */}
      {!projectsLoading && projectsWithFeedback.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
          <FileSpreadsheet size={48} style={{ margin: "0 auto 12px", color: "#94a3b8" }} />
          <p style={{ color: "#64748b", marginBottom: "4px", fontWeight: 500 }}>No feedback yet</p>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
            Review RFP responses and make corrections to generate feedback data.
          </p>
        </div>
      )}

      {/* Projects with feedback */}
      {projectsWithFeedback.length > 0 && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          {projectsWithFeedback.map((project, index) => {
            const isExpanded = expandedProjectId === project.id;
            const stats = project.feedbackStats;

            return (
              <div key={project.id} style={{ borderBottom: index < projectsWithFeedback.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <button
                  onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px",
                    textAlign: "left",
                    background: isExpanded ? "#f8fafc" : "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  ) : (
                    <ChevronRight size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  )}
                  <FileSpreadsheet size={18} style={{ color: "#64748b", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "#1e293b" }}>{project.name}</div>
                    {project.customerName && (
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{project.customerName}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {stats?.editedResponses > 0 && (
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: "#fef2f2", color: "#dc2626" }}>
                        <Edit3 size={10} style={{ display: "inline", marginRight: "2px" }} />
                        {stats.editedResponses} edited
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {stats?.completedRows || 0} / {stats?.totalRows || 0} rows
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ padding: "0 16px 16px 48px", background: "#f8fafc" }}>
                    {feedbackLoading ? (
                      <div style={{ padding: "24px", textAlign: "center" }}>
                        <InlineLoader size="sm" />
                      </div>
                    ) : feedbackData?.feedback && feedbackData.feedback.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {feedbackData.feedback.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              background: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              padding: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  textTransform: "uppercase",
                                }}
                              >
                                Response Edited
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Row #{item.rowNumber}</span>
                            </div>
                            <div style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "8px", fontWeight: 500 }}>
                              Q: {item.question}
                            </div>
                            {item.original && (
                              <div style={{ marginBottom: "8px" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#dc2626", marginBottom: "4px", textTransform: "uppercase" }}>
                                  Original Answer:
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b", background: "#fef2f2", padding: "8px", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                                  {item.original.length > 300 ? item.original.slice(0, 300) + "..." : item.original}
                                </div>
                              </div>
                            )}
                            {item.corrected && (
                              <div>
                                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#16a34a", marginBottom: "4px", textTransform: "uppercase" }}>
                                  Corrected Answer:
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#1e293b", background: "#f0fdf4", padding: "8px", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                                  {item.corrected.length > 300 ? item.corrected.slice(0, 300) + "..." : item.corrected}
                                </div>
                              </div>
                            )}
                            {item.originalConfidence && item.newConfidence && item.originalConfidence !== item.newConfidence && (
                              <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#64748b" }}>
                                Confidence: <span style={{ color: "#dc2626" }}>{item.originalConfidence}</span> → <span style={{ color: "#16a34a" }}>{item.newConfidence}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                        No feedback details available
                      </div>
                    )}

                    <div style={{ marginTop: "12px" }}>
                      <Link
                        href={`/projects/${project.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.875rem",
                          color: "#0ea5e9",
                          textDecoration: "none",
                        }}
                      >
                        View Project →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
