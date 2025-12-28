"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MessageSquare, FileText, ThumbsUp, ThumbsDown, Flag, HelpCircle, Calendar, User, ExternalLink } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import Link from "next/link";

// Simple relative time formatter
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

type ChatFeedback = {
  id: string;
  messageId: string;
  sessionId: string;
  userId: string;
  rating: string | null;
  comment: string | null;
  flaggedForReview: boolean;
  flagNote: string | null;
  reviewRequested: boolean;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewNote: string | null;
  createdAt: string;
  user?: { name: string; email: string };
};

type CollateralFeedback = {
  id: string;
  title: string;
  status: string;
  flaggedForReview: boolean;
  flagNote: string | null;
  queuedForReview: boolean;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewNote: string | null;
  reviewStatus: string | null;
  createdAt: string;
  owner?: { name: string; email: string };
  customer?: { name: string };
};

type FilterType = "all" | "chat" | "collateral";
type RatingFilter = "all" | "positive" | "negative" | "flagged" | "review-requested";

export default function FeedbackTab() {
  const [chatFeedback, setChatFeedback] = useState<ChatFeedback[]>([]);
  const [collateralFeedback, setCollateralFeedback] = useState<CollateralFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");

  useEffect(() => {
    const loadFeedback = async () => {
      setIsLoading(true);
      try {
        // Load chat feedback
        const chatRes = await fetch("/api/admin/feedback/chat");
        if (chatRes.ok) {
          const data = await chatRes.json();
          setChatFeedback(data.data?.feedbacks || []);
        }

        // Load collateral feedback (outputs with flags/reviews)
        const collateralRes = await fetch("/api/collateral/output?flaggedOnly=true");
        if (collateralRes.ok) {
          const data = await collateralRes.json();
          setCollateralFeedback(data.data?.outputs || []);
        }
      } catch {
        toast.error("Failed to load feedback");
      } finally {
        setIsLoading(false);
      }
    };

    loadFeedback();
  }, []);

  // Filter feedback
  const filteredChatFeedback = chatFeedback.filter((fb) => {
    if (ratingFilter === "positive" && fb.rating !== "THUMBS_UP") return false;
    if (ratingFilter === "negative" && fb.rating !== "THUMBS_DOWN") return false;
    if (ratingFilter === "flagged" && !fb.flaggedForReview) return false;
    if (ratingFilter === "review-requested" && !fb.reviewRequested) return false;
    return true;
  });

  const filteredCollateralFeedback = collateralFeedback.filter((fb) => {
    if (ratingFilter === "flagged" && !fb.flaggedForReview) return false;
    if (ratingFilter === "review-requested" && !fb.queuedForReview) return false;
    // Positive/negative don't apply to collateral
    if (ratingFilter === "positive" || ratingFilter === "negative") return false;
    return true;
  });

  const showChat = filterType === "all" || filterType === "chat";
  const showCollateral = filterType === "all" || filterType === "collateral";

  const totalCount = (showChat ? filteredChatFeedback.length : 0) + (showCollateral ? filteredCollateralFeedback.length : 0);

  // Stats
  const stats = {
    total: chatFeedback.length + collateralFeedback.length,
    positive: chatFeedback.filter(f => f.rating === "THUMBS_UP").length,
    negative: chatFeedback.filter(f => f.rating === "THUMBS_DOWN").length,
    flagged: chatFeedback.filter(f => f.flaggedForReview).length + collateralFeedback.filter(f => f.flaggedForReview).length,
    reviewRequested: chatFeedback.filter(f => f.reviewRequested).length + collateralFeedback.filter(f => f.queuedForReview).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <InlineLoader size="lg" />
          <p className="text-muted-foreground mt-3">Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto overflow-auto h-full">
      <div className="mb-6">
        <p className="text-muted-foreground text-sm">
          Review feedback from Chat and Collateral Builder sessions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.positive}</div>
          <div className="text-sm text-green-600 dark:text-green-400">Positive</div>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.negative}</div>
          <div className="text-sm text-red-600 dark:text-red-400">Negative</div>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.flagged}</div>
          <div className="text-sm text-amber-600 dark:text-amber-400">Flagged</div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.reviewRequested}</div>
          <div className="text-sm text-blue-600 dark:text-blue-400">Review Requested</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filterType === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filterType === "chat" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare size={14} />
            Chat
          </button>
          <button
            onClick={() => setFilterType("collateral")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filterType === "collateral" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText size={14} />
            Collateral
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setRatingFilter("all")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              ratingFilter === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setRatingFilter("positive")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              ratingFilter === "positive" ? "bg-background shadow-sm text-green-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsUp size={14} />
            Positive
          </button>
          <button
            onClick={() => setRatingFilter("negative")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              ratingFilter === "negative" ? "bg-background shadow-sm text-red-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsDown size={14} />
            Negative
          </button>
          <button
            onClick={() => setRatingFilter("flagged")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              ratingFilter === "flagged" ? "bg-background shadow-sm text-amber-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flag size={14} />
            Flagged
          </button>
          <button
            onClick={() => setRatingFilter("review-requested")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              ratingFilter === "review-requested" ? "bg-background shadow-sm text-blue-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HelpCircle size={14} />
            Review Requested
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground mb-4">
        Showing {totalCount} item{totalCount !== 1 ? "s" : ""}
      </div>

      {/* Feedback List */}
      {totalCount === 0 ? (
        <div className="p-10 text-center bg-muted/50 rounded-lg border border-dashed border-border">
          <MessageSquare size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-1">No feedback found</p>
          <p className="text-muted-foreground/70 text-sm">
            Feedback will appear here as users interact with Chat and Collateral Builder
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Chat Feedback */}
          {showChat && filteredChatFeedback.map((fb) => (
            <div
              key={fb.id}
              className="p-4 bg-background rounded-lg border border-border"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <MessageSquare size={18} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Chat Session</span>
                      {fb.rating === "THUMBS_UP" && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                          <ThumbsUp size={12} />
                          Positive
                        </span>
                      )}
                      {fb.rating === "THUMBS_DOWN" && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs">
                          <ThumbsDown size={12} />
                          Negative
                        </span>
                      )}
                      {fb.flaggedForReview && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs">
                          <Flag size={12} />
                          Flagged
                        </span>
                      )}
                      {fb.reviewRequested && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">
                          <HelpCircle size={12} />
                          Review Requested
                        </span>
                      )}
                    </div>
                    {fb.comment && (
                      <p className="text-sm text-foreground mb-2">&ldquo;{fb.comment}&rdquo;</p>
                    )}
                    {fb.flagNote && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                        <strong>Flag note:</strong> {fb.flagNote}
                      </p>
                    )}
                    {fb.reviewNote && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                        <strong>Review note:</strong> {fb.reviewNote}
                        {fb.reviewerName && ` (requested from ${fb.reviewerName})`}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {fb.user && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {fb.user.name || fb.user.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatRelativeTime(new Date(fb.createdAt))}
                      </span>
                      {fb.sessionId && fb.sessionId !== "no-session" && (
                        <Link
                          href={`/chat-v2?session=${fb.sessionId}`}
                          target="_blank"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink size={12} />
                          View Chat
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Collateral Feedback */}
          {showCollateral && filteredCollateralFeedback.map((fb) => (
            <div
              key={fb.id}
              className="p-4 bg-background rounded-lg border border-border"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{fb.title || "Collateral Output"}</span>
                      {fb.flaggedForReview && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs">
                          <Flag size={12} />
                          Flagged
                        </span>
                      )}
                      {fb.queuedForReview && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">
                          <HelpCircle size={12} />
                          Review Queued
                        </span>
                      )}
                      {fb.reviewStatus && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          fb.reviewStatus === "APPROVED"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : fb.reviewStatus === "REJECTED"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {fb.reviewStatus}
                        </span>
                      )}
                    </div>
                    {fb.customer && (
                      <p className="text-sm text-muted-foreground mb-1">
                        Customer: {fb.customer.name}
                      </p>
                    )}
                    {fb.flagNote && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                        <strong>Flag note:</strong> {fb.flagNote}
                      </p>
                    )}
                    {fb.reviewNote && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                        <strong>Review note:</strong> {fb.reviewNote}
                        {fb.reviewerName && ` (assigned to ${fb.reviewerName})`}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {fb.owner && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {fb.owner.name || fb.owner.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatRelativeTime(new Date(fb.createdAt))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
