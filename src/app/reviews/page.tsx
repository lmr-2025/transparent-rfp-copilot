"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";

interface ReviewItem {
  id: string;
  rowNumber: number | null;
  question?: string;
  response?: string;
  title?: string;
  content?: string;
  confidence?: string;
  reviewStatus: string;
  // Review workflow fields
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  // Flagging fields
  flaggedForReview?: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
  // Flag resolution fields (already in interface)
  flagResolved?: boolean;
  flagResolvedAt?: string;
  flagResolvedBy?: string;
  flagResolutionNote?: string;
  // Source info
  source: "project" | "questions" | "collateral" | "chat";
  project: {
    id: string;
    name: string;
    customerName?: string;
  } | null;
  userEmail?: string;
  // Collateral-specific
  templateName?: string;
  customerName?: string;
  owner?: { name: string; email: string };
  customer?: { name: string };
}

interface ReviewCounts {
  pending: number;
  approved: number;
  corrected: number;
  flagged: number;
  resolved: number;
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

function getStatusStyle(status: string, isFlagged?: boolean) {
  if (isFlagged) {
    return { backgroundColor: "#fee2e2", color: "#b91c1c" };
  }
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

type TabType = "pending" | "flagged" | "resolved" | "approved" | "corrected" | "all";

function ReviewsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "pending");
  const [sourceFilter, setSourceFilter] = useState<"all" | "projects" | "questions" | "collateral">("all");

  // Handle tab change with URL sync
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/reviews?tab=${tab}`, { scroll: false });
  };
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  // Build query params based on active tab and source filter
  const getQueryParams = () => {
    const params: Record<string, string> = { limit: "100" };
    if (activeTab === "pending") {
      params.type = "review";
      params.status = "REQUESTED";
    } else if (activeTab === "flagged") {
      params.type = "flagged";
    } else if (activeTab === "resolved") {
      params.type = "resolved";
    } else if (activeTab === "approved") {
      params.type = "review";
      params.status = "APPROVED";
    } else if (activeTab === "corrected") {
      params.type = "review";
      params.status = "CORRECTED";
    }
    // Add source filter
    if (sourceFilter !== "all") {
      params.source = sourceFilter;
    }
    return params;
  };

  // Fetch reviews with useApiQuery
  const {
    data: reviewsData,
    isLoading: loading,
  } = useApiQuery<{ reviews: ReviewItem[]; counts: ReviewCounts }>({
    queryKey: ["reviews", activeTab, sourceFilter],
    url: "/api/reviews",
    params: getQueryParams(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const reviews = reviewsData?.reviews || [];
  const counts = reviewsData?.counts || { pending: 0, approved: 0, corrected: 0, flagged: 0, resolved: 0 };

  // Approve mutation
  type ApproveInput = {
    reviewId: string;
    projectId: string;
    data: {
      reviewStatus: string;
      reviewedAt: string;
      reviewedBy: string;
    };
  };

  const approveMutation = useApiMutation<void, ApproveInput>({
    url: (vars) => `/api/projects/${vars.projectId}/rows/${vars.reviewId}`,
    method: "PATCH",
    invalidateKeys: [["reviews"]],
    onSuccess: () => {
      toast.success("Answer approved!");
    },
    onError: () => {
      toast.error("Failed to approve");
    },
  });

  const handleApprove = (reviewId: string, projectId: string) => {
    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";
    approveMutation.mutate({
      reviewId,
      projectId,
      data: {
        reviewStatus: "APPROVED",
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName,
      },
    });
  };

  // Resolve flag mutation - handles both project rows and question history
  type ResolveFlagInput = {
    url: string;
    data: {
      flagResolved: boolean;
      flagResolutionNote: string | null;
    };
  };

  const resolveFlagMutation = useApiMutation<void, ResolveFlagInput>({
    url: (vars) => vars.url,
    method: "PATCH",
    invalidateKeys: [["reviews"]],
    onSuccess: () => {
      toast.success("Flag resolved!");
      setResolvingId(null);
      setResolutionNote("");
    },
    onError: () => {
      toast.error("Failed to resolve flag");
    },
  });

  const handleResolveFlag = (review: ReviewItem) => {
    const url = review.source === "project" && review.project
      ? `/api/projects/${review.project.id}/rows/${review.id}`
      : review.source === "collateral"
      ? `/api/collateral/output/${review.id}`
      : `/api/question-history/${review.id}`;

    resolveFlagMutation.mutate({
      url,
      data: {
        flagResolved: true,
        flagResolutionNote: resolutionNote || null,
      },
    });
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
          <div style={styles.statLabel}>Need Help</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "4px solid #ef4444" }}>
          <div style={styles.statValue}>{counts.flagged}</div>
          <div style={styles.statLabel}>Flagged</div>
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
        {(["pending", "flagged", "resolved", "approved", "corrected", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            style={{
              ...styles.tab,
              backgroundColor: activeTab === tab ? "#0ea5e9" : "#f1f5f9",
              color: activeTab === tab ? "#fff" : "#64748b",
            }}
          >
            {tab === "pending" && `Need Help (${counts.pending})`}
            {tab === "flagged" && `Flagged (${counts.flagged})`}
            {tab === "resolved" && `Resolved (${counts.resolved})`}
            {tab === "approved" && `Verified (${counts.approved})`}
            {tab === "corrected" && `Corrected (${counts.corrected})`}
            {tab === "all" && `All (${counts.pending + counts.flagged + counts.approved + counts.corrected})`}
          </button>
        ))}
      </div>

      {/* Source Filter */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
          Filter by source:
        </div>
        <div style={styles.tabs}>
          {(["all", "projects", "questions", "collateral"] as const).map((source) => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              style={{
                ...styles.tab,
                backgroundColor: sourceFilter === source ? "#6366f1" : "#f1f5f9",
                color: sourceFilter === source ? "#fff" : "#64748b",
              }}
            >
              {source === "all" && "All Sources"}
              {source === "projects" && "RFP Projects"}
              {source === "questions" && "Quick Questions"}
              {source === "collateral" && "Collateral"}
            </button>
          ))}
        </div>
      </div>

      {/* Review List */}
      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : reviews.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>
            {activeTab === "pending" || activeTab === "flagged" ? "🎉" : activeTab === "resolved" ? "📋" : "📭"}
          </div>
          <p style={{ fontSize: "16px", fontWeight: 500, color: "#1e293b", marginBottom: "8px" }}>
            {activeTab === "pending" && "No items needing help!"}
            {activeTab === "flagged" && "No flagged items!"}
            {activeTab === "resolved" && "No resolved flags yet"}
            {activeTab !== "pending" && activeTab !== "flagged" && activeTab !== "resolved" && "No reviews found"}
          </p>
          <p>
            {activeTab === "pending"
              ? "All caught up. Check back later for new review requests."
              : activeTab === "flagged"
              ? "No answers have been flagged for investigation."
              : activeTab === "resolved"
              ? "Resolved flags will appear here for record-keeping."
              : "Try switching tabs to see other reviews."}
          </p>
        </div>
      ) : (
        reviews.map((review) => (
          <div key={review.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                {review.source === "project" && review.project ? (
                  <>
                    <span style={styles.projectName}>{review.project.name}</span>
                    {review.project.customerName && (
                      <span style={styles.customerName}>• {review.project.customerName}</span>
                    )}
                  </>
                ) : review.source === "collateral" ? (
                  <>
                    <span style={styles.projectName}>Collateral: {review.title || "Untitled"}</span>
                    {review.customerName && (
                      <span style={styles.customerName}>• {review.customerName}</span>
                    )}
                  </>
                ) : (
                  <span style={styles.projectName}>Quick Question</span>
                )}
              </div>
              <div style={styles.meta}>
                {review.flaggedForReview ? (
                  review.flagResolved ? (
                    <span style={{ ...styles.statusBadge, backgroundColor: "#dcfce7", color: "#166534" }}>
                      Resolved
                    </span>
                  ) : (
                    <span style={{ ...styles.statusBadge, ...getStatusStyle("", true) }}>
                      Flagged
                    </span>
                  )
                ) : (
                  <span style={{ ...styles.statusBadge, ...getStatusStyle(review.reviewStatus) }}>
                    {review.reviewStatus === "REQUESTED" && "Need Help"}
                    {review.reviewStatus === "APPROVED" && "Verified"}
                    {review.reviewStatus === "CORRECTED" && "Corrected"}
                  </span>
                )}
                {review.rowNumber !== null && <span>Row {review.rowNumber}</span>}
                {review.confidence && (
                  <span style={{ ...styles.confidenceBadge, ...getConfidenceStyle(review.confidence) }}>
                    {review.confidence}
                  </span>
                )}
                <span>{formatTimeAgo(review.reviewRequestedAt || review.flaggedAt)}</span>
              </div>
            </div>

            <div style={styles.cardBody}>
              {review.source === "collateral" ? (
                <>
                  <div style={styles.question}>{review.title || "Collateral Output"}</div>
                  {review.templateName && (
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                      Template: {review.templateName}
                    </div>
                  )}
                  <div style={styles.response}>{review.content?.substring(0, 500)}{(review.content?.length || 0) > 500 ? "..." : ""}</div>
                </>
              ) : (
                <>
                  <div style={styles.question}>Q: {review.question}</div>
                  <div style={styles.response}>{review.response}</div>
                </>
              )}

              {(review.reviewNote || review.flagNote) && (
                <div style={styles.note}>
                  <strong>Note from {review.reviewRequestedBy || review.flaggedBy}:</strong> &quot;{review.reviewNote || review.flagNote}&quot;
                </div>
              )}

              {review.reviewedBy && (
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  Reviewed by {review.reviewedBy} • {formatTimeAgo(review.reviewedAt)}
                </div>
              )}

              {/* Resolution info for resolved flags */}
              {review.flagResolved && (
                <div style={{
                  fontSize: "13px",
                  padding: "10px 14px",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "8px",
                  border: "1px solid #86efac",
                  marginBottom: "12px",
                }}>
                  <strong style={{ color: "#166534" }}>Resolved</strong>
                  {review.flagResolvedBy && (
                    <span style={{ color: "#64748b" }}> by {review.flagResolvedBy}</span>
                  )}
                  {review.flagResolvedAt && (
                    <span style={{ color: "#94a3b8" }}> • {formatTimeAgo(review.flagResolvedAt)}</span>
                  )}
                  {review.flagResolutionNote && (
                    <div style={{ marginTop: "6px", color: "#475569" }}>
                      {review.flagResolutionNote}
                    </div>
                  )}
                </div>
              )}

              <div style={styles.actions}>
                {/* View action button */}
                {review.source === "project" && review.project ? (
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
                ) : review.source === "collateral" ? (
                  <Link
                    href={`/collateral`}
                    style={{
                      ...styles.button,
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                      textDecoration: "none",
                    }}
                  >
                    View in Collateral
                  </Link>
                ) : (
                  <Link
                    href={`/projects/questions?id=${review.id}`}
                    style={{
                      ...styles.button,
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                      textDecoration: "none",
                    }}
                  >
                    View in Questions
                  </Link>
                )}

                {/* Review actions for REQUESTED status */}
                {review.reviewStatus === "REQUESTED" && (
                  <>
                    {/* Approve button - for projects only */}
                    {review.source === "project" && review.project && (
                      <button
                        onClick={() => handleApprove(review.id, review.project!.id)}
                        style={{
                          ...styles.button,
                          backgroundColor: "#22c55e",
                          color: "#fff",
                        }}
                      >
                        ✓ Approve
                      </button>
                    )}

                    {/* Edit/Correct buttons - different per source */}
                    {review.source === "project" && review.project ? (
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
                    ) : review.source === "collateral" ? (
                      <Link
                        href={`/collateral`}
                        style={{
                          ...styles.button,
                          backgroundColor: "#3b82f6",
                          color: "#fff",
                          textDecoration: "none",
                        }}
                      >
                        Edit Collateral
                      </Link>
                    ) : (
                      <Link
                        href={`/projects/questions?id=${review.id}&edit=true`}
                        style={{
                          ...styles.button,
                          backgroundColor: "#3b82f6",
                          color: "#fff",
                          textDecoration: "none",
                        }}
                      >
                        Edit & Correct
                      </Link>
                    )}
                  </>
                )}

                {/* Resolve Flag button for flagged items */}
                {review.flaggedForReview && !review.flagResolved && review.reviewStatus !== "REQUESTED" && (
                  resolvingId === review.id ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Resolution note (optional)"
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          fontSize: "13px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                        }}
                      />
                      <button
                        onClick={() => handleResolveFlag(review)}
                        style={{
                          ...styles.button,
                          backgroundColor: "#22c55e",
                          color: "#fff",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => {
                          setResolvingId(null);
                          setResolutionNote("");
                        }}
                        style={{
                          ...styles.button,
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolvingId(review.id)}
                      style={{
                        ...styles.button,
                        backgroundColor: "#22c55e",
                        color: "#fff",
                      }}
                    >
                      Resolve Flag
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ReviewsContent />
    </Suspense>
  );
}
