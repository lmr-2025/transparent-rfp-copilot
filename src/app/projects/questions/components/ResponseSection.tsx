"use client";

import { useRef, useEffect, useCallback } from "react";
import { Skill } from "@/types/skill";
import TransparencyDetails from "@/components/TransparencyDetails";
import ReviewStatusBanner, { getEffectiveReviewStatus, getReviewerName } from "@/components/ReviewStatusBanner";

type ResponseSectionProps = {
  questionResponse: string;
  questionConfidence: string;
  questionSources: string;
  questionRemarks: string;
  questionReasoning: string;
  questionInference: string;
  currentUsedSkills: Skill[];
  currentHistoryId: string | null;
  currentFlagged: boolean;
  currentFlagNote: string | null;
  currentReviewStatus: string | null;
  currentReviewedBy: string | null;
  isEditing: boolean;
  editedResponse: string;
  isSaving: boolean;
  isLoggedIn: boolean;
  detailsExpanded: boolean;
  conversationOpen: boolean;
  onSetEditedResponse: (value: string) => void;
  onSetIsEditing: (value: boolean) => void;
  onSetDetailsExpanded: (value: boolean) => void;
  onSetConversationOpen: (value: boolean) => void;
  onSaveCorrection: () => void;
  onApprove: () => void;
  onFlagOrReview: (action: "flag" | "need-help") => void;
  onUnflag: () => void;
};

export default function ResponseSection({
  questionResponse,
  questionConfidence,
  questionSources,
  questionRemarks,
  questionReasoning,
  questionInference,
  currentUsedSkills,
  currentHistoryId,
  currentFlagged,
  currentFlagNote,
  currentReviewStatus,
  currentReviewedBy,
  isEditing,
  editedResponse,
  isSaving,
  isLoggedIn,
  detailsExpanded,
  conversationOpen,
  onSetEditedResponse,
  onSetIsEditing,
  onSetDetailsExpanded,
  onSetConversationOpen,
  onSaveCorrection,
  onApprove,
  onFlagOrReview,
  onUnflag,
}: ResponseSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const autoResize = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Auto-resize when editing starts or content changes
  useEffect(() => {
    if (isEditing) {
      autoResize(textareaRef.current);
    }
  }, [isEditing, editedResponse, autoResize]);

  return (
    <div style={{
      marginTop: "20px",
      padding: "16px",
      backgroundColor: isEditing ? "#fefce8" : "#f8fafc",
      borderRadius: "8px",
      border: isEditing ? "2px solid #fbbf24" : "1px solid #e2e8f0",
    }}>
      {/* Review Status Banner */}
      {!isEditing && (
        <ReviewStatusBanner
          status={getEffectiveReviewStatus(currentReviewStatus, null)}
          reviewedBy={getReviewerName(currentReviewStatus, currentReviewedBy, null)}
        />
      )}
      {currentFlagged && currentReviewStatus !== "REQUESTED" && !isEditing && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          marginBottom: "12px",
          borderRadius: "6px",
          fontSize: "0.85rem",
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
          border: "1px solid #fecaca",
        }}>
          <span>🚩</span>
          <span><strong>Flagged</strong> - This answer has been flagged for investigation</span>
          {currentFlagNote && <span style={{ fontStyle: "italic" }}>: &quot;{currentFlagNote}&quot;</span>}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>
          {isEditing ? "Edit Response" : "Response"}
        </h3>
        {!isEditing && currentHistoryId && (
          <button
            type="button"
            onClick={() => {
              onSetEditedResponse(questionResponse);
              onSetIsEditing(true);
            }}
            style={{
              padding: "4px 10px",
              fontSize: "0.8rem",
              backgroundColor: "#f1f5f9",
              color: "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={editedResponse}
            onChange={(e) => {
              onSetEditedResponse(e.target.value);
              autoResize(e.target);
            }}
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              resize: "none",
              overflow: "hidden",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSaveCorrection}
              disabled={isSaving || !editedResponse.trim()}
              style={{
                padding: "8px 16px",
                fontSize: "0.9rem",
                backgroundColor: isSaving ? "#94a3b8" : "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isSaving ? "not-allowed" : "pointer",
                fontWeight: 500,
              }}
            >
              {isSaving ? "Saving..." : "Save Correction"}
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={isSaving}
              style={{
                padding: "8px 16px",
                fontSize: "0.9rem",
                backgroundColor: isSaving ? "#94a3b8" : "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isSaving ? "not-allowed" : "pointer",
                fontWeight: 500,
              }}
            >
              Verify (No Change Needed)
            </button>
            <button
              type="button"
              onClick={() => {
                onSetIsEditing(false);
                onSetEditedResponse("");
              }}
              style={{
                padding: "8px 16px",
                fontSize: "0.9rem",
                backgroundColor: "#f1f5f9",
                color: "#64748b",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
          color: "#1e293b",
          fontSize: "0.95rem",
        }}>
          {questionResponse}
        </div>
      )}

      {/* Transparency Details */}
      <TransparencyDetails
        data={{
          confidence: questionConfidence,
          reasoning: questionReasoning,
          inference: questionInference,
          remarks: questionRemarks,
          sources: questionSources,
        }}
        defaultExpanded={detailsExpanded}
        onToggle={onSetDetailsExpanded}
        knowledgeReferences={currentUsedSkills.map(skill => ({
          id: skill.id,
          title: skill.title,
          type: "skill" as const,
        }))}
        renderClarifyButton={!conversationOpen ? () => (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onSetConversationOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 12px",
                fontSize: "0.8rem",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Clarify
            </button>
            {isLoggedIn && currentHistoryId && !currentFlagged && currentReviewStatus !== "REQUESTED" && (
              <>
                <button
                  type="button"
                  onClick={() => onFlagOrReview("flag")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    backgroundColor: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  🚩 Flag
                </button>
                <button
                  type="button"
                  onClick={() => onFlagOrReview("need-help")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    backgroundColor: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  🤚 Need Help?
                </button>
              </>
            )}
            {isLoggedIn && currentHistoryId && currentFlagged && currentReviewStatus !== "REQUESTED" && (
              <button
                type="button"
                onClick={onUnflag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                ✕ Unflag
              </button>
            )}
            {isLoggedIn && currentHistoryId && currentReviewStatus === "REQUESTED" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                  backgroundColor: "#dbeafe",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  fontWeight: 500,
                }}
              >
                📨 Review Requested
              </span>
            )}
          </div>
        ) : undefined}
      />
    </div>
  );
}
