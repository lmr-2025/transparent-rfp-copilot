"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BulkProject } from "@/types/bulkProject";
import { fetchAllProjects, deleteProject as deleteProjectApi } from "@/lib/projectApi";

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

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<BulkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    loadProjects();
  }, []);

  const handleDeleteProject = async (id: string, projectName: string) => {
    if (confirm(`Delete "${projectName}"? This cannot be undone.`)) {
      try {
        await deleteProjectApi(id);
        const updatedProjects = await fetchAllProjects();
        setProjects(updatedProjects);
      } catch (err) {
        console.error("Failed to delete project:", err);
        alert("Failed to delete project. Please try again.");
      }
    }
  };

  const getProgressStats = (project: BulkProject) => {
    const total = project.rows.length;
    const completed = project.rows.filter((row) => row.response && row.response.trim().length > 0).length;
    const high = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes("high")).length;
    const medium = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes("medium")).length;
    const low = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes("low")).length;
    const errors = project.rows.filter((row) => row.status === "error").length;

    return { total, completed, high, medium, low, errors };
  };

  // Sort by most recently modified first
  const sortedProjects = [...projects].sort((a, b) =>
    new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
  );

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Bulk Question Projects</h1>
          <p style={{ color: "#475569", marginTop: "8px" }}>
            Manage multiple RFP questionnaires. Click a project to continue working on it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/questions/bulk/upload")}
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

      {loading ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            Loading projects...
          </div>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "8px" }}>No projects yet</p>
            <p>Upload a CSV or Excel file to create your first project.</p>
            <button
              type="button"
              onClick={() => router.push("/questions/bulk/upload")}
              style={{
                ...styles.button,
                backgroundColor: "#0ea5e9",
                color: "#fff",
                marginTop: "16px",
              }}
            >
              Create First Project
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.card}>
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
              {sortedProjects.map((project) => {
                const stats = getProgressStats(project);
                return (
                  <tr key={project.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/questions/bulk/${project.id}`)}>
                    <td style={styles.td}>
                      <strong>{project.customerName || "—"}</strong>
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
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: "0.85rem" }}>
                        {new Date(project.lastModifiedAt).toLocaleDateString()}
                        <div style={{ color: "#94a3b8" }}>
                          {new Date(project.lastModifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </td>
                    <td style={styles.td} onClick={(e) => e.stopPropagation()}>
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
                          Open
                        </button>
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
  );
}
