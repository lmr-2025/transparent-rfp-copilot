"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BulkProject } from "@/types/bulkProject";
import { fetchAllProjects, updateProject } from "@/lib/projectApi";

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

export default function ReviewQueuePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<BulkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const data = await fetchAllProjects();
      // Filter to only show projects needing review
      const needsReview = data.filter((p) => p.status === "needs_review");
      setProjects(needsReview);
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

  const handleApprove = async (project: BulkProject) => {
    // Use session user name, or prompt if not signed in
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

    return { total, completed, high, medium, low };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Sort by review requested time (oldest first - FIFO queue)
  const sortedProjects = [...projects].sort((a, b) => {
    const aTime = a.reviewRequestedAt ? new Date(a.reviewRequestedAt).getTime() : 0;
    const bTime = b.reviewRequestedAt ? new Date(b.reviewRequestedAt).getTime() : 0;
    return aTime - bTime;
  });

  return (
    <div style={styles.container}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Review Queue</h1>
        <p style={{ color: "#475569", marginTop: "8px" }}>
          Projects awaiting your review. Approve or open to review responses.
        </p>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            Loading review queue...
          </div>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "8px" }}>No projects awaiting review</p>
            <p>Projects will appear here when team members request a review.</p>
          </div>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={{ marginBottom: "12px", color: "#475569", fontSize: "0.9rem" }}>
            {sortedProjects.length} project{sortedProjects.length !== 1 ? "s" : ""} awaiting review
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Project Name</th>
                <th style={styles.th}>Requested By</th>
                <th style={styles.th}>Requested At</th>
                <th style={styles.th}>Progress</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map((project) => {
                const stats = getProgressStats(project);
                const isApproving = approvingId === project.id;
                return (
                  <tr key={project.id}>
                    <td style={styles.td}>
                      <strong>{project.customerName || "—"}</strong>
                    </td>
                    <td style={styles.td}>{project.name}</td>
                    <td style={styles.td}>{project.reviewRequestedBy || "—"}</td>
                    <td style={styles.td}>{formatDate(project.reviewRequestedAt)}</td>
                    <td style={styles.td}>
                      <div style={{ fontSize: "0.85rem" }}>
                        <div>{stats.completed}/{stats.total} answered</div>
                        {stats.completed > 0 && (
                          <div style={{ color: "#64748b", marginTop: "2px" }}>
                            H:{stats.high} M:{stats.medium} L:{stats.low}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => router.push(`/questions/bulk/${project.id}`)}
                          style={{
                            ...styles.button,
                            padding: "6px 12px",
                            backgroundColor: "#0ea5e9",
                            color: "#fff",
                            fontSize: "0.85rem",
                          }}
                        >
                          Review
                        </button>
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
                          {isApproving ? "Approving..." : "Approve"}
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
  );
}
