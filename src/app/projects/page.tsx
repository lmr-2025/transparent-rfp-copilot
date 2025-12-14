"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BulkProject } from "@/types/bulkProject";
import { fetchAllProjects, deleteProject as deleteProjectApi, updateProject } from "@/lib/projectApi";

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginTop: "16px",
  },
  th: {
    textAlign: "left" as const,
    padding: "12px",
    borderBottom: "2px solid #e2e8f0",
    fontWeight: 600,
    fontSize: "0.9rem",
    color: "#475569",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "0.9rem",
  },
  statusBadge: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    fontWeight: 600,
    display: "inline-block",
  },
};

type StatusFilter = "all" | "draft" | "in_progress" | "needs_review" | "approved" | "has_flagged";

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

function ProjectsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<BulkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Handle URL query param for filter
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["all", "draft", "in_progress", "needs_review", "approved", "has_flagged"].includes(filterParam)) {
      setStatusFilter(filterParam as StatusFilter);
    }
  }, [searchParams]);

  const loadProjects = async () => {
    try {
      const data = await fetchAllProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Failed to load projects. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDeleteProject = async (id: string, projectName: string) => {
    if (confirm(`Delete "${projectName}"? This cannot be undone.`)) {
      try {
        await deleteProjectApi(id);
        await loadProjects();
      } catch (err) {
        console.error("Failed to delete project:", err);
        alert("Failed to delete project. Please try again.");
      }
    }
  };

  const handleApprove = async (project: BulkProject) => {
    const reviewerName = session?.user?.name || prompt("Your name (reviewer):");
    if (!reviewerName?.trim()) return;

    setApprovingId(project.id);
    try {
      await updateProject({
        ...project,
        status: "approved",
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName.trim(),
      });
      await loadProjects();
    } catch (err) {
      console.error("Failed to approve project:", err);
      alert("Failed to approve project. Please try again.");
    } finally {
      setApprovingId(null);
    }
  };

  const getProgressStats = (project: BulkProject) => {
    const total = project.rows.length;
    const completed = project.rows.filter((row) => row.response && row.response.trim().length > 0).length;
    const high = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes("high")).length;
    const medium = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes("medium")).length;
    const low = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes("low")).length;
    const errors = project.rows.filter((row) => row.status === "error").length;
    const flagged = project.rows.filter((row) => row.flaggedForReview).length;

    return { total, completed, high, medium, low, errors, flagged };
  };

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    return {
      all: projects.length,
      draft: projects.filter((p) => p.status === "draft").length,
      in_progress: projects.filter((p) => p.status === "in_progress").length,
      needs_review: projects.filter((p) => p.status === "needs_review").length,
      approved: projects.filter((p) => p.status === "approved").length,
      has_flagged: projects.filter((p) => p.rows.some((r) => r.flaggedForReview)).length,
    };
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (statusFilter === "has_flagged") {
      filtered = projects.filter((p) => p.rows.some((r) => r.flaggedForReview));
    } else if (statusFilter !== "all") {
      filtered = projects.filter((p) => p.status === statusFilter);
    }

    // Sort by most recently modified first (for needs_review, sort by review requested time)
    return [...filtered].sort((a, b) => {
      if (statusFilter === "needs_review") {
        const aTime = a.reviewRequestedAt ? new Date(a.reviewRequestedAt).getTime() : 0;
        const bTime = b.reviewRequestedAt ? new Date(b.reviewRequestedAt).getTime() : 0;
        return aTime - bTime; // FIFO for review queue
      }
      return new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime();
    });
  }, [projects, statusFilter]);

  // Projects with flagged questions (for the flagged section)
  const projectsWithFlaggedQuestions = useMemo(() => {
    return projects.filter((p) => p.rows.some((r) => r.flaggedForReview));
  }, [projects]);

  // Get recent projects (top 4 by last modified)
  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime())
      .slice(0, 4);
  }, [projects]);

  // Check if we should show the dashboard view (no filter selected or "all")
  const showDashboard = statusFilter === "all" && !loading;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: "#1e293b" }}>RFP Projects</h1>
          <p style={{ color: "#64748b", marginTop: "8px", fontSize: "0.95rem" }}>
            Upload questionnaires, generate AI responses, and track progress through review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/projects/upload")}
          style={{
            ...styles.button,
            backgroundColor: "#0ea5e9",
            color: "#fff",
            padding: "12px 20px",
            fontSize: "0.95rem",
          }}
        >
          + Upload New
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            Loading projects...
          </div>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div style={{
          ...styles.card,
          textAlign: "center",
          padding: "60px 40px",
          borderStyle: "dashed",
          borderWidth: "2px",
        }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>
            No projects yet
          </div>
          <p style={{ color: "#64748b", marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
            Upload a CSV or Excel questionnaire to create your first project. AI will generate responses that you review and approve.
          </p>
          <button
            type="button"
            onClick={() => router.push("/projects/upload")}
            style={{
              ...styles.button,
              backgroundColor: "#0ea5e9",
              color: "#fff",
              padding: "12px 24px",
            }}
          >
            Upload Your First Questionnaire
          </button>
        </div>
      ) : (
        <>
          {/* Status Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
            {[
              { key: "needs_review" as const, label: "Needs Review", color: "#f59e0b", bgColor: "#fffbeb", borderColor: "#fcd34d" },
              { key: "has_flagged" as const, label: "Has Flagged", color: "#f59e0b", bgColor: "#fffbeb", borderColor: "#fcd34d" },
              { key: "in_progress" as const, label: "In Progress", color: "#0ea5e9", bgColor: "#f0f9ff", borderColor: "#7dd3fc" },
              { key: "approved" as const, label: "Approved", color: "#22c55e", bgColor: "#f0fdf4", borderColor: "#86efac" },
            ].map(({ key, label, color, bgColor, borderColor }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
                style={{
                  padding: "16px",
                  backgroundColor: statusFilter === key ? bgColor : "#fff",
                  border: statusFilter === key ? `2px solid ${borderColor}` : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: filterCounts[key] > 0 ? color : "#94a3b8" }}>
                  {filterCounts[key]}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>
                  {label}
                </div>
              </button>
            ))}
          </div>

          {/* Recent Projects (only show on dashboard view) */}
          {showDashboard && recentProjects.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
                Recent Projects
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                {recentProjects.map((project) => {
                  const stats = getProgressStats(project);
                  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                  return (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      style={{
                        ...styles.card,
                        marginBottom: 0,
                        cursor: "pointer",
                        borderLeft: `4px solid ${
                          project.status === "approved" ? "#22c55e" :
                          project.status === "needs_review" ? "#f59e0b" :
                          project.status === "in_progress" ? "#0ea5e9" :
                          "#94a3b8"
                        }`,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
                            {project.name}
                          </div>
                          {project.customerProfiles && project.customerProfiles.length > 0 ? (
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {project.customerProfiles.slice(0, 2).map((cp) => (
                                <span
                                  key={cp.id}
                                  style={{
                                    fontSize: "0.75rem",
                                    backgroundColor: "#e0e7ff",
                                    color: "#4338ca",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  {cp.name}
                                </span>
                              ))}
                            </div>
                          ) : project.customerName ? (
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{project.customerName}</div>
                          ) : null}
                        </div>
                        <span style={{ ...styles.statusBadge, ...getStatusColor(project.status), flexShrink: 0 }}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#64748b", marginBottom: "4px" }}>
                          <span>{stats.completed} of {stats.total} answered</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div style={{ height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            backgroundColor: progressPercent === 100 ? "#22c55e" : "#0ea5e9",
                            transition: "width 0.3s ease",
                          }} />
                        </div>
                      </div>

                      {/* Footer info */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
                        <span>Modified {new Date(project.lastModifiedAt).toLocaleDateString()}</span>
                        {stats.flagged > 0 && (
                          <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                            {stats.flagged} flagged
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Projects Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
                {statusFilter === "all" ? "All Projects" :
                 statusFilter === "has_flagged" ? "Projects with Flagged Questions" :
                 `${getStatusLabel(statusFilter)} Projects`}
              </h2>

              {/* Filter pills */}
              <div style={{ display: "flex", gap: "6px" }}>
                {(["all", "draft", "in_progress", "needs_review", "approved"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      backgroundColor: statusFilter === key ? "#0ea5e9" : "#f1f5f9",
                      color: statusFilter === key ? "#fff" : "#64748b",
                      border: "none",
                      borderRadius: "16px",
                      cursor: "pointer",
                    }}
                  >
                    {key === "all" ? "All" : getStatusLabel(key)} ({filterCounts[key]})
                  </button>
                ))}
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div style={styles.card}>
                <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                  No {statusFilter === "has_flagged" ? "projects with flagged questions" : statusFilter.replace("_", " ")} projects.
                </div>
              </div>
            ) : (
              <div style={styles.card}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Project</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Progress</th>
                      <th style={styles.th}>Modified</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => {
                      const stats = getProgressStats(project);
                      const isApproving = approvingId === project.id;
                      return (
                        <tr key={project.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/projects/${project.id}`)}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 500, color: "#1e293b" }}>{project.name}</div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                              {project.customerProfiles && project.customerProfiles.length > 0 ? (
                                project.customerProfiles.map((cp) => cp.name).join(", ")
                              ) : (
                                project.customerName || project.ownerName || "—"
                              )}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusBadge, ...getStatusColor(project.status) }}>
                              {getStatusLabel(project.status)}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ fontSize: "0.85rem" }}>
                              <div>{stats.completed}/{stats.total}</div>
                              {stats.flagged > 0 && (
                                <div style={{ color: "#f59e0b", fontWeight: 600 }}>
                                  {stats.flagged} flagged
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                              {new Date(project.lastModifiedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {project.status === "needs_review" && (
                                <button
                                  type="button"
                                  onClick={() => handleApprove(project)}
                                  disabled={isApproving}
                                  style={{
                                    ...styles.button,
                                    padding: "6px 12px",
                                    backgroundColor: isApproving ? "#94a3b8" : "#22c55e",
                                    color: "#fff",
                                    fontSize: "0.85rem",
                                    cursor: isApproving ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {isApproving ? "..." : "Approve"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(project.id, project.name)}
                                style={{
                                  ...styles.button,
                                  padding: "6px 12px",
                                  backgroundColor: "#fee2e2",
                                  color: "#b91c1c",
                                  fontSize: "0.85rem",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Flagged Questions Detail Section - show when has_flagged filter is active */}
          {statusFilter === "has_flagged" && projectsWithFlaggedQuestions.length > 0 && (
            <div style={{ ...styles.card, marginTop: "16px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1rem" }}>Flagged Question Details</h3>
              {projectsWithFlaggedQuestions.map((project) => {
                const flaggedRows = project.rows.filter((r) => r.flaggedForReview);
                return (
                  <div key={project.id} style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                      {project.customerName || "No customer"} — {project.name}
                    </div>
                    {flaggedRows.map((row) => (
                      <div key={row.id} style={{ fontSize: "0.85rem", color: "#64748b", marginLeft: "16px", marginBottom: "4px" }}>
                        • <strong>Row {row.rowNumber}:</strong> {row.question.slice(0, 80)}{row.question.length > 80 ? "..." : ""}
                        {row.flagNote && (
                          <span style={{ color: "#92400e", fontStyle: "italic" }}> — &quot;{row.flagNote}&quot;</span>
                        )}
                        {row.flaggedBy && (
                          <span style={{ color: "#94a3b8" }}> (by {row.flaggedBy})</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ProjectsListPage() {
  return (
    <Suspense fallback={
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            Loading projects...
          </div>
        </div>
      </div>
    }>
      <ProjectsListContent />
    </Suspense>
  );
}
