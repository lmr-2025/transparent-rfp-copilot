"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Flag,
  HelpCircle,
  Loader2,
  ExternalLink,
  FileText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FlagReviewModal, { type FlagReviewData } from "@/components/FlagReviewModal";

type FeedbackRating = "THUMBS_UP" | "THUMBS_DOWN" | null;

interface CollateralOutputData {
  name: string;
  templateId?: string;
  templateName?: string;
  customerId?: string;
  customerName?: string;
  filledContent?: Record<string, string>;
  generatedMarkdown?: string;
  googleSlidesId?: string;
  googleSlidesUrl?: string;
}

interface FinishStepPanelProps {
  data: CollateralOutputData;
  onBack: () => void;
  onNewCollateral: () => void;
}

export function FinishStepPanel({
  data,
  onBack,
  onNewCollateral,
}: FinishStepPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [savedOutputId, setSavedOutputId] = useState<string | null>(null);
  const [rating, setRating] = useState<FeedbackRating>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [initialFlagAction, setInitialFlagAction] = useState<"flag" | "need-help">("flag");

  // Save the collateral output to the database
  const saveOutput = async (additionalData?: Partial<{
    rating: FeedbackRating;
    feedbackComment: string;
    flaggedForReview: boolean;
    flagNote: string;
    queuedForReview: boolean;
    queuedNote: string;
    queuedReviewerId: string;
    queuedReviewerName: string;
    reviewStatus: string;
  }>) => {
    setIsSaving(true);
    try {
      // If we already have a saved output, update it
      if (savedOutputId) {
        const res = await fetch(`/api/collateral/output/${savedOutputId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(additionalData),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Updated successfully");
        return savedOutputId;
      }

      // Create new output
      const res = await fetch("/api/collateral/output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          status: "GENERATED",
          ...additionalData,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const result = await res.json();
      setSavedOutputId(result.output.id);
      toast.success("Collateral saved!");
      return result.output.id;
    } catch {
      toast.error("Failed to save collateral");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRating = async (newRating: FeedbackRating) => {
    setRating(newRating);
    await saveOutput({ rating: newRating });
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackComment.trim()) return;
    await saveOutput({ feedbackComment: feedbackComment.trim() });
    toast.success("Feedback saved!");
  };

  const handleOpenFlag = () => {
    setInitialFlagAction("flag");
    setShowFlagModal(true);
  };

  const handleOpenHelp = () => {
    setInitialFlagAction("need-help");
    setShowFlagModal(true);
  };

  const handleFlagSubmit = async (flagData: FlagReviewData) => {
    setShowFlagModal(false);

    if (flagData.action === "flag") {
      await saveOutput({
        flaggedForReview: true,
        flagNote: flagData.note,
      });
      toast.success("Flagged for attention");
    } else {
      // Need help / request review
      if (flagData.sendTiming === "now") {
        await saveOutput({
          reviewStatus: "REQUESTED",
          queuedReviewerId: flagData.reviewerId,
          queuedReviewerName: flagData.reviewerName,
          queuedNote: flagData.note,
        });
        toast.success("Review requested");
      } else {
        // Queue for later
        await saveOutput({
          queuedForReview: true,
          queuedReviewerId: flagData.reviewerId,
          queuedReviewerName: flagData.reviewerName,
          queuedNote: flagData.note,
        });
        toast.success("Added to review queue");
      }
    }
  };

  const fieldCount = data.filledContent ? Object.keys(data.filledContent).length : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#fafafa",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 20px",
          borderBottom: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
          }}
        >
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
          Collateral Complete!
        </h2>
        <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
          Your collateral has been generated
        </p>
      </div>

      {/* Summary */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {/* Output Details */}
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "12px" }}>
            Summary
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.name && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText className="h-4 w-4 text-slate-400" />
                <span style={{ fontSize: "13px", color: "#475569" }}>{data.name}</span>
              </div>
            )}
            {data.customerName && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users className="h-4 w-4 text-slate-400" />
                <span style={{ fontSize: "13px", color: "#475569" }}>For: {data.customerName}</span>
              </div>
            )}
            {fieldCount > 0 && (
              <div style={{ fontSize: "13px", color: "#64748b" }}>
                {fieldCount} field{fieldCount !== 1 ? "s" : ""} generated
              </div>
            )}
            {data.googleSlidesUrl && (
              <a
                href={data.googleSlidesUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "13px",
                  color: "#2563eb",
                  marginTop: "4px",
                }}
              >
                Open in Google Slides <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Feedback Section */}
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "12px" }}>
            How did it go?
          </h3>

          {/* Thumbs up/down */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button
              onClick={() => handleRating("THUMBS_UP")}
              disabled={isSaving}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: rating === "THUMBS_UP" ? "2px solid #22c55e" : "1px solid #e2e8f0",
                backgroundColor: rating === "THUMBS_UP" ? "#f0fdf4" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.15s",
              }}
            >
              <ThumbsUp
                className={`h-5 w-5 ${rating === "THUMBS_UP" ? "text-green-600" : "text-slate-400"}`}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: rating === "THUMBS_UP" ? "#166534" : "#64748b",
                }}
              >
                Good
              </span>
            </button>
            <button
              onClick={() => handleRating("THUMBS_DOWN")}
              disabled={isSaving}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: rating === "THUMBS_DOWN" ? "2px solid #ef4444" : "1px solid #e2e8f0",
                backgroundColor: rating === "THUMBS_DOWN" ? "#fef2f2" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.15s",
              }}
            >
              <ThumbsDown
                className={`h-5 w-5 ${rating === "THUMBS_DOWN" ? "text-red-600" : "text-slate-400"}`}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: rating === "THUMBS_DOWN" ? "#991b1b" : "#64748b",
                }}
              >
                Needs work
              </span>
            </button>
          </div>

          {/* Feedback comment */}
          <textarea
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            placeholder="Additional feedback (optional)"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "13px",
              resize: "vertical",
              minHeight: "60px",
              marginBottom: "8px",
            }}
          />
          {feedbackComment.trim() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFeedbackSubmit}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Feedback"
              )}
            </Button>
          )}
        </div>

        {/* Flag / Get Help Section */}
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "12px" }}>
            Need attention?
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleOpenFlag}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #fbbf24",
                backgroundColor: "#fffbeb",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s",
              }}
            >
              <Flag className="h-5 w-5 text-amber-500" />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#92400e" }}>
                Flag
              </span>
              <span style={{ fontSize: "11px", color: "#a16207" }}>
                Mark for your attention
              </span>
            </button>
            <button
              onClick={handleOpenHelp}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #60a5fa",
                backgroundColor: "#eff6ff",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s",
              }}
            >
              <HelpCircle className="h-5 w-5 text-blue-500" />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#1e40af" }}>
                Need Help?
              </span>
              <span style={{ fontSize: "11px", color: "#1d4ed8" }}>
                Request a review
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <Button onClick={onNewCollateral} className="w-full">
          Create Another
        </Button>
        <Button variant="outline" onClick={onBack} className="w-full">
          Back to Slides
        </Button>
      </div>

      {/* Flag/Review Modal */}
      <FlagReviewModal
        isOpen={showFlagModal}
        initialAction={initialFlagAction}
        onSubmit={handleFlagSubmit}
        onCancel={() => setShowFlagModal(false)}
        allowQueueing={true}
      />
    </div>
  );
}
