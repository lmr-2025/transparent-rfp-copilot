"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BulkProject } from "@/types/bulkProject";
import { fetchAllProjects, deleteProject as deleteProjectApi, updateProject } from "@/lib/projectApi";

const styles = {
  container: {
    maxWidth: "1200px",
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
    borderRadius: "4px",
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

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Projects</h1>
          <p style={{ color: "#475569", marginTop: "8px" }}>
            Manage RFP questionnaires. Click a project to continue working on it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/projects/upload")}
          style={{
            ...styles.button,
            backgroundColor: "#0ea5e9",
            color: "#fff",
          }}
        >
          + New Project
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div style={{ ...styles.card, padding: "12px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {([
            { key: "all", label: "All" },
            { key: "draft", label: "Draft" },
            { key: "in_progress", label: "In Progress" },
            { key: "needs_review", label: "Needs Review" },
            { key: "approved", label: "Approved" },
            { key: "has_flagged", label: "🚩 Has Flagged" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                ...styles.button,
                padding: "8px 14px",
                backgroundColor: statusFilter === key
                  ? key === "needs_review" ? "#f59e0b"
                  : key === "has_flagged" ? "#f59e0b"
                  : "#0ea5e9"
                  : key === "needs_review" && filterCounts.needs_review > 0 ? "#fef3c7"
                  : key === "has_flagged" && filterCounts.has_flagged > 0 ? "#fef3c7"
                  : "#f1f5f9",
                color: statusFilter === key
                  ? "#fff"
                  : (key === "needs_review" || key === "has_flagged") && filterCounts[key] > 0 ? "#92400e"
                  : "#0f172a",
              }}
            >
              {label} ({filterCounts[key]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            Loading projects...
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            {statusFilter === "all" ? (
              <>
                <p style={{ fontSize: "1.1rem", marginBottom: "8px" }}>No projects yet</p>
                <p>Upload a CSV or Excel file to create your first project.</p>
                <button
                  type="button"
                  onClick={() => router.push("/projects/upload")}
                  style={{
                    ...styles.button,
                    backgroundColor: "#0ea5e9",
                    color: "#fff",
                    marginTop: "16px",
                  }}
                >
                  Create First Project
                </button>
              </>
            ) : (
              <p>No {statusFilter === "has_flagged" ? "projects with flagged questions" : statusFilter.replace("_", " ")} projects.</p>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={{ marginBottom: "8px", color: "#475569", fontSize: "0.9rem" }}>
            {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
            {statusFilter === "needs_review" && " awaiting review"}
            {statusFilter === "has_flagged" && " with flagged questions"}
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Project Name</th>
                <th style={styles.th}>Owner</th>
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
                      {project.customerProfiles && project.customerProfiles.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {project.customerProfiles.map((cp) => (
                            <span
                              key={cp.id}
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                backgroundColor: "#e0e7ff",
                                color: "#4338ca",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                              }}
                            >
                              {cp.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>{project.customerName || "—"}</span>
                      )}
                    </td>
                    <td style={styles.td}>{project.name}</td>
                    <td style={styles.td}>{project.ownerName || "—"}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, ...getStatusColor(project.status) }}>
                        {getStatusLabel(project.status)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: "0.85rem" }}>
                        <div>{stats.completed}/{stats.total} answered</div>
                        {stats.completed > 0 && (
                          <div style={{ color: "#64748b", marginTop: "2px" }}>
                            H:{stats.high} M:{stats.medium} L:{stats.low}
                            {stats.errors > 0 && ` E:${stats.errors}`}
                          </div>
                        )}
                        {stats.flagged > 0 && (
                          <div style={{ color: "#92400e", marginTop: "2px", fontWeight: 600 }}>
                            🚩 {stats.flagged} flagged
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: "0.85rem" }}>
                        {new Date(project.lastModifiedAt).toLocaleDateString()}
                        <div style={{ color: "#94a3b8" }}>
                          {new Date(project.lastModifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {project.reviewRequestedBy && (
                          <div style={{ color: "#92400e", marginTop: "2px", fontSize: "0.8rem" }}>
                            Review by: {project.reviewRequestedBy}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => router.push(`/projects/${project.id}`)}
                          style={{
                            ...styles.button,
                            padding: "6px 12px",
                            backgroundColor: "#0ea5e9",
                            color: "#fff",
                            fontSize: "0.85rem",
                          }}
                        >
                          Open
                        </button>
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
                        {stats.flagged > 0 && (
                          <button
                            type="button"
                            onClick={() => router.push(`/projects/${project.id}?filter=flagged`)}
                            style={{
                              ...styles.button,
                              padding: "6px 12px",
                              backgroundColor: "#f59e0b",
                              color: "#fff",
                              fontSize: "0.85rem",
                            }}
                          >
                            🚩 Review
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

      {/* Flagged Questions Detail Section - show when has_flagged filter is active */}
      {statusFilter === "has_flagged" && projectsWithFlaggedQuestions.length > 0 && (
        <div style={styles.card}>
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
