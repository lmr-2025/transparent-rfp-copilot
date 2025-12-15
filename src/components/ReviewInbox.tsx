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
    position: "relative" as const,
  },
  badge: {
    position: "absolute" as const,
    top: "-4px",
    right: "-4px",
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    borderRadius: "999px",
    minWidth: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  button: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    color: "#cbd5e1",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    width: "100%",
    textAlign: "left" as const,
    borderLeft: "3px solid transparent",
  },
  dropdown: {
    position: "absolute" as const,
    left: "100%",
    top: 0,
    marginLeft: "8px",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
    width: "400px",
    maxHeight: "500px",
    overflow: "hidden",
    zIndex: 1000,
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
    margin: 0,
  },
  tabs: {
    display: "flex",
    gap: "8px",
  },
  tab: {
    padding: "4px 10px",
    fontSize: "12px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
  },
  list: {
    maxHeight: "380px",
    overflowY: "auto" as const,
  },
  item: {
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  itemHover: {
    backgroundColor: "#f8fafc",
  },
  projectName: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  question: {
    fontSize: "14px",
    color: "#1e293b",
    fontWeight: 500,
    marginBottom: "6px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  },
  meta: {
    display: "flex",
    gap: "12px",
    fontSize: "12px",
    color: "#94a3b8",
  },
  note: {
    fontSize: "12px",
    color: "#64748b",
    fontStyle: "italic",
    marginTop: "6px",
    padding: "6px 8px",
    backgroundColor: "#fefce8",
    borderRadius: "4px",
  },
  empty: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "#64748b",
  },
  footer: {
    padding: "12px 20px",
    borderTop: "1px solid #e2e8f0",
    textAlign: "center" as const,
  },
  viewAllLink: {
    color: "#0ea5e9",
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
  },
  confidenceBadge: {
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 500,
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

export default function ReviewInbox() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({ pending: 0, approved: 0, corrected: 0 });
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  const [loading, setLoading] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === "pending" ? "REQUESTED" : "APPROVED";
      const response = await fetch(`/api/reviews?status=${status}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.data?.reviews || []);
        setCounts(data.data?.counts || { pending: 0, approved: 0, corrected: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch on mount and when tab changes
  useEffect(() => {
    if (isOpen) {
      fetchReviews();
    }
  }, [isOpen, activeTab, fetchReviews]);

  // Fetch counts periodically (every 30 seconds) for badge
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch("/api/reviews?status=REQUESTED&limit=1");
        if (response.ok) {
          const data = await response.json();
          setCounts(data.data?.counts || { pending: 0, approved: 0, corrected: 0 });
        }
      } catch (error) {
        // Silent fail for background fetch
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

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
        fetchReviews(); // Refresh the list
      } else {
        toast.error("Failed to approve");
      }
    } catch (error) {
      toast.error("Failed to approve");
    }
  };

  return (
    <div style={styles.container}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.button,
          backgroundColor: isOpen ? "#334155" : "transparent",
          color: isOpen ? "#fff" : "#cbd5e1",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = "#334155";
            e.currentTarget.style.color = "#fff";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#cbd5e1";
          }
        }}
      >
        <span style={{ position: "relative" }}>
          📥 Review Inbox
          {counts.pending > 0 && (
            <span style={styles.badge}>{counts.pending > 99 ? "99+" : counts.pending}</span>
          )}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Click-outside overlay */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setIsOpen(false)}
          />

          <div style={styles.dropdown}>
            <div style={styles.header}>
              <h3 style={styles.title}>Review Inbox</h3>
              <div style={styles.tabs}>
                <button
                  onClick={() => setActiveTab("pending")}
                  style={{
                    ...styles.tab,
                    backgroundColor: activeTab === "pending" ? "#0ea5e9" : "#f1f5f9",
                    color: activeTab === "pending" ? "#fff" : "#64748b",
                  }}
                >
                  Pending ({counts.pending})
                </button>
                <button
                  onClick={() => setActiveTab("reviewed")}
                  style={{
                    ...styles.tab,
                    backgroundColor: activeTab === "reviewed" ? "#22c55e" : "#f1f5f9",
                    color: activeTab === "reviewed" ? "#fff" : "#64748b",
                  }}
                >
                  Reviewed ({counts.approved + counts.corrected})
                </button>
              </div>
            </div>

            <div style={styles.list}>
              {loading ? (
                <div style={styles.empty}>Loading...</div>
              ) : reviews.length === 0 ? (
                <div style={styles.empty}>
                  {activeTab === "pending"
                    ? "No reviews pending! 🎉"
                    : "No reviewed items yet"}
                </div>
              ) : (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    style={{
                      ...styles.item,
                      ...(hoveredItem === review.id ? styles.itemHover : {}),
                    }}
                    onMouseEnter={() => setHoveredItem(review.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div style={styles.projectName}>
                      {review.project.name}
                      {review.project.customerName && ` • ${review.project.customerName}`}
                    </div>
                    <Link
                      href={`/projects/${review.project.id}?filter=flagged`}
                      style={{ textDecoration: "none" }}
                      onClick={() => setIsOpen(false)}
                    >
                      <div style={styles.question}>{review.question}</div>
                    </Link>
                    <div style={styles.meta}>
                      <span>Row {review.rowNumber}</span>
                      {review.confidence && (
                        <span style={{ ...styles.confidenceBadge, ...getConfidenceStyle(review.confidence) }}>
                          {review.confidence}
                        </span>
                      )}
                      <span>{formatTimeAgo(review.flaggedAt)}</span>
                      {review.flaggedBy && <span>by {review.flaggedBy}</span>}
                    </div>
                    {review.flagNote && (
                      <div style={styles.note}>"{review.flagNote}"</div>
                    )}

                    {/* Quick action buttons for pending reviews */}
                    {activeTab === "pending" && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <Link
                          href={`/projects/${review.project.id}?filter=flagged`}
                          onClick={() => setIsOpen(false)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            borderRadius: "6px",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          View Details
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(review.id, review.project.id);
                          }}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            backgroundColor: "#22c55e",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          ✓ Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={styles.footer}>
              <Link
                href="/reviews"
                style={styles.viewAllLink}
                onClick={() => setIsOpen(false)}
              >
                View all reviews →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Compact badge-only version for the sidebar nav
export function ReviewBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/reviews?status=REQUESTED&limit=1");
        if (response.ok) {
          const data = await response.json();
          setCount(data.data?.counts?.pending || 0);
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span style={{
      backgroundColor: "#ef4444",
      color: "#fff",
      fontSize: "10px",
      fontWeight: 700,
      borderRadius: "999px",
      minWidth: "18px",
      height: "18px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 5px",
      marginLeft: "8px",
    }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
