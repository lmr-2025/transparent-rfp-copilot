"use client";

import { LibraryRecommendation } from "@/types/libraryAnalysis";
import LoadingSpinner from "@/components/LoadingSpinner";
import TransparencyModal from "@/components/TransparencyModal";
import { LibraryAnalysisState, createAnalysisState } from "../types";
import { styles } from "../styles";

interface LibraryAnalysisPanelProps {
  analysisState: LibraryAnalysisState;
  onClose: () => void;
  onShowTransparencyModal: () => void;
  onDismissRecommendation: (index: number) => void;
  onMergeSkills: (rec: LibraryRecommendation, originalIdx: number) => void;
  visibleRecommendations: LibraryRecommendation[];
}

export default function LibraryAnalysisPanel({
  analysisState,
  onClose,
  onShowTransparencyModal,
  onDismissRecommendation,
  onMergeSkills,
  visibleRecommendations,
}: LibraryAnalysisPanelProps) {
  const typeColors: Record<string, { bg: string; text: string; label: string }> = {
    merge: { bg: "#dbeafe", text: "#1e40af", label: "Merge" },
    split: { bg: "#fce7f3", text: "#9d174d", label: "Split" },
    rename: { bg: "#e0e7ff", text: "#3730a3", label: "Rename" },
    retag: { bg: "#d1fae5", text: "#065f46", label: "Retag" },
    gap: { bg: "#fef3c7", text: "#92400e", label: "Gap" },
  };

  const priorityColors: Record<string, { bg: string; text: string }> = {
    high: { bg: "#fee2e2", text: "#991b1b" },
    medium: { bg: "#fef9c3", text: "#854d0e" },
    low: { bg: "#f1f5f9", text: "#475569" },
  };

  return (
    <div style={styles.analysisPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#6d28d9", display: "flex", alignItems: "center", gap: "8px" }}>
            Library Analysis
            {!analysisState.isAnalyzing && analysisState.healthScore > 0 && (
              <span style={{
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: analysisState.healthScore >= 90 ? "#dcfce7" :
                                 analysisState.healthScore >= 70 ? "#fef9c3" :
                                 analysisState.healthScore >= 50 ? "#fed7aa" : "#fecaca",
                color: analysisState.healthScore >= 90 ? "#166534" :
                       analysisState.healthScore >= 70 ? "#854d0e" :
                       analysisState.healthScore >= 50 ? "#9a3412" : "#991b1b",
              }}>
                Health: {analysisState.healthScore}/100
              </span>
            )}
          </h3>
          {!analysisState.isAnalyzing && analysisState.summary && (
            <p style={{ color: "#6b7280", margin: "8px 0 0 0", fontSize: "14px" }}>
              {analysisState.summary}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {!analysisState.isAnalyzing && analysisState.transparency && (
            <button
              type="button"
              onClick={onShowTransparencyModal}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #c4b5fd",
                backgroundColor: "#ede9fe",
                color: "#6d28d9",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              View what was sent
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #c4b5fd",
              backgroundColor: "#fff",
              color: "#6d28d9",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Close
          </button>
        </div>
      </div>

      {analysisState.isAnalyzing && (
        <LoadingSpinner
          title="Analyzing your knowledge library..."
          subtitle="Checking for redundancy, organization issues, and gaps. This may take 15-30 seconds."
        />
      )}

      {analysisState.error && (
        <div style={{
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
          border: "1px solid #fecdd3",
          borderRadius: "6px",
          padding: "8px 12px",
          marginTop: "8px",
        }}>
          {analysisState.error}
        </div>
      )}

      {!analysisState.isAnalyzing && visibleRecommendations.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#475569" }}>
            Recommendations ({visibleRecommendations.length})
          </h4>
          {visibleRecommendations.map((rec, idx) => {
            const originalIdx = analysisState.recommendations.indexOf(rec);
            const typeStyle = typeColors[rec.type] || typeColors.merge;
            const priorityStyle = priorityColors[rec.priority] || priorityColors.medium;

            return (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.text,
                      }}>
                        {typeStyle.label}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: priorityStyle.bg,
                        color: priorityStyle.text,
                      }}>
                        {rec.priority}
                      </span>
                    </div>
                    <strong style={{ fontSize: "14px", color: "#1e293b" }}>{rec.title}</strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#475569" }}>
                      {rec.description}
                    </p>
                    {rec.affectedSkillTitles.length > 0 && (
                      <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        <strong>Affects:</strong> {rec.affectedSkillTitles.join(", ")}
                      </p>
                    )}
                    {rec.suggestedAction && (
                      <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#059669", fontStyle: "italic" }}>
                        {rec.suggestedAction}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    {rec.type === "merge" && rec.affectedSkillIds.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => onMergeSkills(rec, originalIdx)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor: "#2563eb",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        Preview Merge
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDismissRecommendation(originalIdx)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#f8fafc",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!analysisState.isAnalyzing && visibleRecommendations.length === 0 && analysisState.recommendations.length > 0 && (
        <p style={{ color: "#059669", fontSize: "14px", margin: "12px 0 0 0" }}>
          All recommendations addressed!
        </p>
      )}

      {!analysisState.isAnalyzing && analysisState.recommendations.length === 0 && !analysisState.error && (
        <p style={{ color: "#059669", fontSize: "14px", margin: "12px 0 0 0" }}>
          Your knowledge library is well organized. No issues detected.
        </p>
      )}
    </div>
  );
}

// Transparency modal component for analysis
interface AnalysisTransparencyModalProps {
  analysisState: LibraryAnalysisState;
  onClose: () => void;
}

export function AnalysisTransparencyModal({ analysisState, onClose }: AnalysisTransparencyModalProps) {
  if (!analysisState.transparency) return null;

  return (
    <TransparencyModal
      title="Library Analysis - What Was Sent"
      subtitle="Review the prompts and configuration sent to the AI for this analysis"
      systemPrompt={analysisState.transparency.systemPrompt}
      userPrompt={analysisState.transparency.userPrompt}
      configs={[
        { label: "Model", value: analysisState.transparency.model, color: "purple" },
        { label: "Temperature", value: analysisState.transparency.temperature, color: "blue" },
        { label: "Max Tokens", value: analysisState.transparency.maxTokens, color: "yellow" },
        { label: "Skills Analyzed", value: analysisState.transparency.skillCount, color: "green" },
      ]}
      headerColor="purple"
      onClose={onClose}
    />
  );
}
