"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface ReviewItem {
  id: string;
  rowNumber: number;
  question: string;
  response: string;
  confidence?: string;
  reviewStatus: string;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  project: {
    id: string;
    name: string;
    customerName?: string;
  };
}

interface ReviewCounts {
  pending: number;
  approved: number;
  corrected: number;
}

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "1rem",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
  },
  tab: {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: 500,
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    backgroundColor: "#fff",
    marginBottom: "16px",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "16px 20px",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  projectName: {
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  customerName: {
    fontSize: "12px",
    color: "#94a3b8",
    marginLeft: "8px",
  },
  meta: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    fontSize: "12px",
    color: "#94a3b8",
  },
  cardBody: {
    padding: "20px",
  },
  question: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: "12px",
    lineHeight: 1.5,
  },
  response: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: 1.6,
    backgroundColor: "#f8fafc",
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "12px",
    maxHeight: "200px",
    overflow: "auto",
    whiteSpace: "pre-wrap" as const,
  },
  note: {
    fontSize: "13px",
    color: "#64748b",
    fontStyle: "italic",
    padding: "10px 14px",
    backgroundColor: "#fefce8",
    borderRadius: "8px",
    border: "1px solid #fef08a",
    marginBottom: "12px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    paddingTop: "12px",
    borderTop: "1px solid #e2e8f0",
    marginTop: "12px",
  },
  button: {
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
  },
  confidenceBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 500,
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
  },
  empty: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "#64748b",
  },
  stats: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    flex: 1,
    padding: "16px 20px",
    backgroundColor: "#fff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#0f172a",
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px",
  },
};

function getConfidenceStyle(confidence?: string) {
  if (!confidence) return { backgroundColor: "#f1f5f9", color: "#64748b" };
  const lower = confidence.toLowerCase();
  if (lower.includes("high")) return { backgroundColor: "#dcfce7", color: "#166534" };
  if (lower.includes("medium")) return { backgroundColor: "#fef3c7", color: "#92400e" };
  if (lower.includes("low")) return { backgroundColor: "#fee2e2", color: "#b91c1c" };
  return { backgroundColor: "#f1f5f9", color: "#64748b" };
}

function getStatusStyle(status: string) {
  switch (status) {
    case "REQUESTED":
      return { backgroundColor: "#fef3c7", color: "#92400e" };
    case "APPROVED":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    case "CORRECTED":
      return { backgroundColor: "#dbeafe", color: "#1e40af" };
    default:
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
  }
}

function formatTimeAgo(dateString?: string) {
  if (!dateString) return "";
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
  return date.toLocaleDateString();
}

export default function ReviewsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "corrected" | "all">("pending");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({ pending: 0, approved: 0, corrected: 0 });
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      let status = "REQUESTED";
      if (activeTab === "approved") status = "APPROVED";
      else if (activeTab === "corrected") status = "CORRECTED";
      else if (activeTab === "all") status = "REQUESTED"; // Will fetch all below

      const response = await fetch(`/api/reviews?status=${status}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        let reviewList = data.data?.reviews || [];

        // For "all" tab, fetch all statuses
        if (activeTab === "all") {
          const [approvedRes, correctedRes] = await Promise.all([
            fetch("/api/reviews?status=APPROVED&limit=100"),
            fetch("/api/reviews?status=CORRECTED&limit=100"),
          ]);
          const approvedData = approvedRes.ok ? await approvedRes.json() : { data: { reviews: [] } };
          const correctedData = correctedRes.ok ? await correctedRes.json() : { data: { reviews: [] } };

          reviewList = [
            ...reviewList,
            ...(approvedData.data?.reviews || []),
            ...(correctedData.data?.reviews || []),
          ].sort((a, b) => new Date(b.flaggedAt || 0).getTime() - new Date(a.flaggedAt || 0).getTime());
        }

        setReviews(reviewList);
        setCounts(data.data?.counts || { pending: 0, approved: 0, corrected: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleApprove = async (reviewId: string, projectId: string) => {
    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";

    try {
      const response = await fetch(`/api/projects/${projectId}/rows/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "APPROVED",
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
        }),
      });

      if (response.ok) {
        toast.success("Answer approved!");
        fetchReviews();
      } else {
        toast.error("Failed to approve");
      }
    } catch (error) {
      toast.error("Failed to approve");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Review Inbox</h1>
        <p style={styles.subtitle}>
          Review and approve answers flagged by your team. Approve good answers or edit and mark as corrected.
        </p>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <div style={{ ...styles.statCard, borderLeft: "4px solid #f59e0b" }}>
          <div style={styles.statValue}>{counts.pending}</div>
          <div style={styles.statLabel}>Pending Review</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "4px solid #22c55e" }}>
          <div style={styles.statValue}>{counts.approved}</div>
          <div style={styles.statLabel}>Approved</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "4px solid #3b82f6" }}>
          <div style={styles.statValue}>{counts.corrected}</div>
          <div style={styles.statLabel}>Corrected</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(["pending", "approved", "corrected", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              backgroundColor: activeTab === tab ? "#0ea5e9" : "#f1f5f9",
              color: activeTab === tab ? "#fff" : "#64748b",
            }}
          >
            {tab === "pending" && `📝 Pending (${counts.pending})`}
            {tab === "approved" && `✓ Approved (${counts.approved})`}
            {tab === "corrected" && `✎ Corrected (${counts.corrected})`}
            {tab === "all" && `All (${counts.pending + counts.approved + counts.corrected})`}
          </button>
        ))}
      </div>

      {/* Review List */}
      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : reviews.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>
            {activeTab === "pending" ? "🎉" : "📭"}
          </div>
          <p style={{ fontSize: "16px", fontWeight: 500, color: "#1e293b", marginBottom: "8px" }}>
            {activeTab === "pending" ? "No pending reviews!" : "No reviews found"}
          </p>
          <p>
            {activeTab === "pending"
              ? "All caught up. Check back later for new review requests."
              : "Try switching tabs to see other reviews."}
          </p>
        </div>
      ) : (
        reviews.map((review) => (
          <div key={review.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <span style={styles.projectName}>{review.project.name}</span>
                {review.project.customerName && (
                  <span style={styles.customerName}>• {review.project.customerName}</span>
                )}
              </div>
              <div style={styles.meta}>
                <span style={{ ...styles.statusBadge, ...getStatusStyle(review.reviewStatus) }}>
                  {review.reviewStatus === "REQUESTED" && "📝 Pending"}
                  {review.reviewStatus === "APPROVED" && "✓ Approved"}
                  {review.reviewStatus === "CORRECTED" && "✎ Corrected"}
                </span>
                <span>Row {review.rowNumber}</span>
                {review.confidence && (
                  <span style={{ ...styles.confidenceBadge, ...getConfidenceStyle(review.confidence) }}>
                    {review.confidence}
                  </span>
                )}
                <span>{formatTimeAgo(review.flaggedAt)}</span>
              </div>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.question}>Q: {review.question}</div>
              <div style={styles.response}>{review.response}</div>

              {review.flagNote && (
                <div style={styles.note}>
                  <strong>Note from {review.flaggedBy}:</strong> "{review.flagNote}"
                </div>
              )}

              {review.reviewedBy && (
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  Reviewed by {review.reviewedBy} • {formatTimeAgo(review.reviewedAt)}
                </div>
              )}

              <div style={styles.actions}>
                <Link
                  href={`/projects/${review.project.id}?filter=flagged`}
                  style={{
                    ...styles.button,
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    textDecoration: "none",
                  }}
                >
                  View in Project
                </Link>

                {review.reviewStatus === "REQUESTED" && (
                  <>
                    <button
                      onClick={() => handleApprove(review.id, review.project.id)}
                      style={{
                        ...styles.button,
                        backgroundColor: "#22c55e",
                        color: "#fff",
                      }}
                    >
                      ✓ Approve
                    </button>
                    <Link
                      href={`/projects/${review.project.id}?filter=flagged`}
                      style={{
                        ...styles.button,
                        backgroundColor: "#3b82f6",
                        color: "#fff",
                        textDecoration: "none",
                      }}
                    >
                      Edit & Correct
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
