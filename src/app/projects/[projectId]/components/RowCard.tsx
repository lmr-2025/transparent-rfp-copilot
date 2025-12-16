"use client";

import { useState } from "react";
import { BulkRow } from "@/types/bulkProject";
import { Skill } from "@/types/skill";
import { parseAnswerSections } from "@/lib/questionHelpers";
import ConversationalRefinement from "@/components/ConversationalRefinement";
import SkillRecommendation from "@/components/SkillRecommendation";
import TransparencyDetails from "@/components/TransparencyDetails";
import ReviewStatusBanner, { getEffectiveReviewStatus, getReviewerName } from "@/components/ReviewStatusBanner";
import { BulkProject } from "@/types/bulkProject";

const styles = {
  statusPill: {
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  button: {
    padding: "10px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5f5",
    marginTop: "4px",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginTop: "12px",
  },
};

type RowCardProps = {
  row: BulkRow;
  projectStatus: BulkProject["status"];
  projectReviewedBy?: string;
  promptText: string;
  sendingReviewRowId: string | null;
  onUpdateRow: (rowId: string, updates: Partial<BulkRow>) => void;
  onQuestionEdit: (rowId: string, value: string) => void;
  onFlagOrReview: (rowId: string, initialAction: "flag" | "need-help") => void;
  onResolveFlag: (rowId: string, resolutionNote?: string) => void;
  onReopenFlag: (rowId: string) => void;
  onApproveRow: (rowId: string) => void;
  onCorrectRow: (rowId: string) => void;
};

function renderStatus(status: string) {
  switch (status) {
    case "pending":
      return <span style={{ ...styles.statusPill, backgroundColor: "#f1f5f9", color: "#0f172a" }}>Pending</span>;
    case "generating":
      return <span style={{ ...styles.statusPill, backgroundColor: "#fde68a", color: "#78350f" }}>Generating</span>;
    case "completed":
      return <span style={{ ...styles.statusPill, backgroundColor: "#dcfce7", color: "#166534" }}>Completed</span>;
    case "error":
      return <span style={{ ...styles.statusPill, backgroundColor: "#fee2e2", color: "#b91c1c" }}>Error</span>;
    default:
      return null;
  }
}

export default function RowCard({
  row,
  projectStatus,
  projectReviewedBy,
  promptText,
  sendingReviewRowId,
  onUpdateRow,
  onQuestionEdit,
  onFlagOrReview,
  onResolveFlag,
  onReopenFlag,
  onApproveRow,
  onCorrectRow,
}: RowCardProps) {
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Lock by default when response exists and has been reviewed/approved
  const hasResponse = Boolean(row.response);
  const isReviewed = row.reviewStatus === "APPROVED" || row.reviewStatus === "CORRECTED";
  const locked = hasResponse && !isEditing;

  const handleResolve = () => {
    onResolveFlag(row.id, resolutionNote || undefined);
    setShowResolveForm(false);
    setResolutionNote("");
  };

  // Check if flag is resolved (flagged but marked resolved)
  const isFlagResolved = row.flaggedForReview && row.flagResolved;
  const isFlagActive = row.flaggedForReview && !row.flagResolved;

  return (
    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "12px" }}>
      {/* Header with status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px" }}>
        <div style={{ fontSize: "0.9rem", color: "#475569", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          Row {row.rowNumber} • {renderStatus(row.status)}
          {/* Queued Badge */}
          {row.queuedForReview && (
            <span style={{
              ...styles.statusPill,
              backgroundColor: "#8b5cf6",
              color: "#fff",
            }}>
              Queued
            </span>
          )}
          {/* Review Status Badge */}
          {row.reviewStatus === "REQUESTED" && (
            <span style={{
              ...styles.statusPill,
              backgroundColor: "#fef3c7",
              color: "#92400e",
            }}>
              Review Requested
            </span>
          )}
          {row.reviewStatus === "APPROVED" && (
            <span style={{
              ...styles.statusPill,
              backgroundColor: "#dcfce7",
              color: "#166534",
            }}>
              Approved
            </span>
          )}
          {row.reviewStatus === "CORRECTED" && (
            <span style={{
              ...styles.statusPill,
              backgroundColor: "#dbeafe",
              color: "#1e40af",
            }}>
              Corrected
            </span>
          )}
          {row.reviewedBy && (
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              by {row.reviewedBy}
            </span>
          )}
          {/* Flag Status Badges */}
          {isFlagActive && (
            <span style={{
              ...styles.statusPill,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
            }}>
              Flagged
            </span>
          )}
          {isFlagResolved && (
            <span style={{
              ...styles.statusPill,
              backgroundColor: "#d1fae5",
              color: "#047857",
            }}>
              Flag Resolved
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Edit/Save toggle - only show when there's a response */}
          {hasResponse && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              style={{
                ...styles.button,
                padding: "4px 10px",
                fontSize: "0.8rem",
                backgroundColor: isEditing ? "#22c55e" : "#f1f5f9",
                color: isEditing ? "#fff" : "#64748b",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {isEditing ? (
                <>✓ Done</>
              ) : (
                <>✏️ Edit</>
              )}
            </button>
          )}
          {/* Flag / Need Help buttons - only show if no active flag and not resolved */}
          {row.response && (!row.reviewStatus || row.reviewStatus === "NONE") && !row.flaggedForReview && (
            <>
              <button
                type="button"
                onClick={() => onFlagOrReview(row.id, "flag")}
                disabled={sendingReviewRowId === row.id}
                style={{
                  ...styles.button,
                  padding: "4px 10px",
                  fontSize: "0.8rem",
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  cursor: sendingReviewRowId === row.id ? "not-allowed" : "pointer",
                }}
              >
                Flag
              </button>
              <button
                type="button"
                onClick={() => onFlagOrReview(row.id, "need-help")}
                disabled={sendingReviewRowId === row.id}
                style={{
                  ...styles.button,
                  padding: "4px 10px",
                  fontSize: "0.8rem",
                  backgroundColor: sendingReviewRowId === row.id ? "#94a3b8" : "#0ea5e9",
                  color: "#fff",
                  cursor: sendingReviewRowId === row.id ? "not-allowed" : "pointer",
                }}
              >
                {sendingReviewRowId === row.id ? "Sending..." : "Need Help?"}
              </button>
            </>
          )}
          {/* Resolve Flag button - for active flags */}
          {isFlagActive && row.reviewStatus !== "REQUESTED" && (
            <button
              type="button"
              onClick={() => setShowResolveForm(true)}
              style={{
                ...styles.button,
                padding: "4px 10px",
                fontSize: "0.8rem",
                backgroundColor: "#22c55e",
                color: "#fff",
              }}
            >
              Resolve
            </button>
          )}
          {/* Reopen Flag button - for resolved flags */}
          {isFlagResolved && (
            <button
              type="button"
              onClick={() => onReopenFlag(row.id)}
              style={{
                ...styles.button,
                padding: "4px 10px",
                fontSize: "0.8rem",
                backgroundColor: "#f1f5f9",
                color: "#64748b",
              }}
            >
              Reopen
            </button>
          )}
          {/* Approve/Correct buttons */}
          {row.reviewStatus === "REQUESTED" && (
            <>
              <button
                type="button"
                onClick={() => onApproveRow(row.id)}
                style={{
                  ...styles.button,
                  padding: "4px 10px",
                  fontSize: "0.8rem",
                  backgroundColor: "#22c55e",
                  color: "#fff",
                }}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onCorrectRow(row.id)}
                style={{
                  ...styles.button,
                  padding: "4px 10px",
                  fontSize: "0.8rem",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                }}
                title="Mark current answer as corrected (save your edits)"
              >
                Mark Corrected
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resolve Flag Form */}
      {showResolveForm && (
        <div style={{
          fontSize: "0.85rem",
          backgroundColor: "#f0fdf4",
          padding: "12px",
          borderRadius: "6px",
          marginBottom: "8px",
          border: "1px solid #86efac",
        }}>
          <div style={{ fontWeight: 600, marginBottom: "8px", color: "#166534" }}>
            Resolve Flag
          </div>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Optional: Add a note about how this was resolved..."
            style={{
              ...styles.input,
              minHeight: "60px",
              resize: "vertical",
              fontSize: "0.85rem",
              marginTop: "0",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={handleResolve}
              style={{
                ...styles.button,
                padding: "6px 12px",
                fontSize: "0.8rem",
                backgroundColor: "#22c55e",
                color: "#fff",
              }}
            >
              Confirm Resolve
            </button>
            <button
              type="button"
              onClick={() => {
                setShowResolveForm(false);
                setResolutionNote("");
              }}
              style={{
                ...styles.button,
                padding: "6px 12px",
                fontSize: "0.8rem",
                backgroundColor: "#f1f5f9",
                color: "#64748b",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Flag Note - for active flags */}
      {isFlagActive && row.flagNote && (
        <div style={{
          fontSize: "0.85rem",
          color: "#64748b",
          backgroundColor: "#fefce8",
          padding: "8px 12px",
          borderRadius: "6px",
          marginBottom: "8px",
          border: "1px solid #fef08a",
        }}>
          <strong>Flag note:</strong> {row.flagNote}
          {row.flaggedBy && (
            <span style={{ color: "#94a3b8", marginLeft: "8px" }}>
              — {row.flaggedBy}
            </span>
          )}
        </div>
      )}

      {/* Resolution Info - for resolved flags */}
      {isFlagResolved && (
        <div style={{
          fontSize: "0.85rem",
          color: "#64748b",
          backgroundColor: "#f0fdf4",
          padding: "8px 12px",
          borderRadius: "6px",
          marginBottom: "8px",
          border: "1px solid #86efac",
        }}>
          <div>
            <strong>Flag resolved</strong>
            {row.flagResolvedBy && (
              <span style={{ color: "#94a3b8", marginLeft: "8px" }}>
                by {row.flagResolvedBy}
              </span>
            )}
          </div>
          {row.flagResolutionNote && (
            <div style={{ marginTop: "4px" }}>
              <strong>Resolution:</strong> {row.flagResolutionNote}
            </div>
          )}
          {row.flagNote && (
            <div style={{ marginTop: "4px", color: "#94a3b8" }}>
              <strong>Original note:</strong> {row.flagNote}
            </div>
          )}
        </div>
      )}

      {/* Question */}
      <label style={{ ...styles.label, fontSize: "0.9rem", marginTop: "4px" }}>Question</label>
      <textarea
        value={row.question}
        onChange={(event) => onQuestionEdit(row.id, event.target.value)}
        disabled={locked}
        style={{
          ...styles.input,
          minHeight: "60px",
          resize: "vertical",
          fontSize: "0.9rem",
          backgroundColor: locked ? "#f8fafc" : "#fff",
          cursor: locked ? "not-allowed" : "text",
        }}
      />

      {/* Response Section */}
      {row.response && (
        <div style={{
          marginTop: "8px",
          padding: "12px",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
          border: "1px solid #e2e8f0"
        }}>
          <ReviewStatusBanner
            status={getEffectiveReviewStatus(row.reviewStatus, projectStatus)}
            reviewedBy={getReviewerName(row.reviewStatus, row.reviewedBy, projectReviewedBy)}
          />
          <label style={{
            ...styles.label,
            fontSize: "0.9rem",
            marginTop: "0",
          }}>
            Response
          </label>
          <textarea
            value={row.response}
            onChange={(event) => onUpdateRow(row.id, { response: event.target.value })}
            disabled={locked}
            style={{
              ...styles.input,
              minHeight: "180px",
              fontSize: "0.9rem",
              resize: "vertical",
              backgroundColor: locked ? "#f8fafc" : "#fff",
              cursor: locked ? "not-allowed" : "text",
              marginTop: "6px"
            }}
          />

          {/* Transparency section */}
          <TransparencyDetails
            data={{
              confidence: row.confidence,
              reasoning: row.reasoning,
              inference: row.inference,
              remarks: row.remarks,
              sources: row.sources,
            }}
            defaultExpanded={row.detailsExpanded}
            onToggle={(expanded) => onUpdateRow(row.id, { detailsExpanded: expanded })}
            knowledgeReferences={(row.usedSkills || [])
              .filter((s): s is Skill => typeof s === "object" && s !== null && "id" in s && "title" in s)
              .map(s => ({ id: s.id, title: s.title, type: "skill" as const }))
            }
            renderClarifyButton={!row.conversationOpen ? () => (
              <button
                type="button"
                onClick={() => onUpdateRow(row.id, { conversationOpen: true })}
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
            ) : undefined}
          />
        </div>
      )}

      {row.error && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "8px" }}>{row.error}</p>
      )}

      {/* Skill Recommendations */}
      {row.showRecommendation && row.usedSkills && (
        <SkillRecommendation
          usedSkills={row.usedSkills}
          question={row.question}
          onDismiss={() => onUpdateRow(row.id, { showRecommendation: false })}
        />
      )}

      {/* Conversational Interface */}
      {row.response && row.conversationOpen && (
        <div style={{ marginTop: "8px" }}>
          <ConversationalRefinement
            originalQuestion={row.question}
            currentResponse={`${row.response}\n\nConfidence: ${row.confidence || 'N/A'}\nSources: ${row.sources || 'N/A'}\nReasoning: ${row.reasoning || 'N/A'}\nInference: ${row.inference || 'None'}\nRemarks: ${row.remarks || 'N/A'}`}
            onResponseUpdate={(newResponse) => {
              const parsed = parseAnswerSections(newResponse);
              onUpdateRow(row.id, {
                response: parsed.response,
                confidence: parsed.confidence,
                sources: parsed.sources,
                reasoning: parsed.reasoning,
                inference: parsed.inference,
                remarks: parsed.remarks
              });
            }}
            onClose={() => onUpdateRow(row.id, { conversationOpen: false })}
            promptText={promptText}
            originalConversationHistory={row.conversationHistory}
            clarifyConversation={row.clarifyConversation}
            onConversationChange={(messages) => onUpdateRow(row.id, { clarifyConversation: messages })}
          />
        </div>
      )}
    </div>
  );
}
