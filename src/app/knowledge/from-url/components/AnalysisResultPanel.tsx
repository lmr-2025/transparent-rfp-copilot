"use client";

import { AnalysisResult, SplitSuggestion } from "../types";

interface AnalysisResultPanelProps {
  analysisResult: AnalysisResult;
  selectedSplitIndex: number | null;
  onBuildFromUrls: (urls?: string[], options?: { skillId: string }) => void;
  onSkipAnalysis: () => void;
  onBuildSplitSkill: (split: SplitSuggestion, index: number) => void;
  onCancel: () => void;
}

export default function AnalysisResultPanel({
  analysisResult,
  selectedSplitIndex,
  onBuildFromUrls,
  onSkipAnalysis,
  onBuildSplitSkill,
  onCancel,
}: AnalysisResultPanelProps) {
  return (
    <div style={{ marginTop: "16px" }}>
      {/* URL Already Used Notice */}
      {analysisResult.urlAlreadyUsed && (
        <div style={{
          padding: "12px",
          backgroundColor: "#fef9c3",
          borderRadius: "8px",
          border: "1px solid #fde047",
          marginBottom: "16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
        }}>
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <div>
            <strong style={{ fontSize: "13px", color: "#854d0e" }}>
              URL already used in &quot;{analysisResult.urlAlreadyUsed.skillTitle}&quot;
            </strong>
            <p style={{ margin: "4px 0 0 0", color: "#a16207", fontSize: "12px" }}>
              {analysisResult.urlAlreadyUsed.matchedUrls.length === 1
                ? "This URL was"
                : `${analysisResult.urlAlreadyUsed.matchedUrls.length} URLs were`} previously used to build that skill.
              Updating will refresh the content from the source.
            </p>
          </div>
        </div>
      )}

      {/* Source Preview */}
      <div style={{
        padding: "12px",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        marginBottom: "16px",
      }}>
        <strong style={{ fontSize: "13px", color: "#475569" }}>Content detected:</strong>
        <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
          {analysisResult.sourcePreview}
        </p>
      </div>

      {/* Recommendation based on action type */}
      {analysisResult.suggestion.action === "update_existing" && (
        <UpdateExistingPanel
          analysisResult={analysisResult}
          onBuildFromUrls={onBuildFromUrls}
          onSkipAnalysis={onSkipAnalysis}
          onCancel={onCancel}
        />
      )}

      {analysisResult.suggestion.action === "create_new" && (
        <CreateNewPanel
          analysisResult={analysisResult}
          onBuildFromUrls={onBuildFromUrls}
          onCancel={onCancel}
        />
      )}

      {analysisResult.suggestion.action === "split_topics" && analysisResult.suggestion.splitSuggestions && (
        <SplitTopicsPanel
          analysisResult={analysisResult}
          selectedSplitIndex={selectedSplitIndex}
          onBuildSplitSkill={onBuildSplitSkill}
          onSkipAnalysis={onSkipAnalysis}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

// Sub-component for "Update Existing" action
function UpdateExistingPanel({
  analysisResult,
  onBuildFromUrls,
  onSkipAnalysis,
  onCancel,
}: {
  analysisResult: AnalysisResult;
  onBuildFromUrls: (urls?: string[], options?: { skillId: string }) => void;
  onSkipAnalysis: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      padding: "16px",
      backgroundColor: "#fef3c7",
      borderRadius: "8px",
      border: "1px solid #fcd34d",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "18px" }}>📝</span>
        <strong style={{ color: "#92400e" }}>Suggested: Update existing skill</strong>
      </div>
      <p style={{ margin: "0 0 12px 0", color: "#78350f", fontSize: "14px" }}>
        This content looks related to <strong>&quot;{analysisResult.suggestion.existingSkillTitle}&quot;</strong>.
      </p>
      <p style={{ margin: "0 0 12px 0", color: "#92400e", fontSize: "13px" }}>
        {analysisResult.suggestion.reason}
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={() => onBuildFromUrls(undefined, { skillId: analysisResult.suggestion.existingSkillId! })}
          style={{
            padding: "10px 16px",
            backgroundColor: "#f59e0b",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Update &quot;{analysisResult.suggestion.existingSkillTitle}&quot;
        </button>
        <button
          onClick={onSkipAnalysis}
          style={{
            padding: "10px 16px",
            backgroundColor: "#fff",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create New Skill Instead
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "10px 16px",
            backgroundColor: "#fff",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Sub-component for "Create New" action
function CreateNewPanel({
  analysisResult,
  onBuildFromUrls,
  onCancel,
}: {
  analysisResult: AnalysisResult;
  onBuildFromUrls: (urls?: string[], options?: { skillId: string }) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      padding: "16px",
      backgroundColor: "#dcfce7",
      borderRadius: "8px",
      border: "1px solid #86efac",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "18px" }}>✨</span>
        <strong style={{ color: "#166534" }}>Ready to create new skill</strong>
      </div>
      <p style={{ margin: "0 0 8px 0", color: "#15803d", fontSize: "14px" }}>
        Suggested title: <strong>&quot;{analysisResult.suggestion.suggestedTitle}&quot;</strong>
      </p>
      <p style={{ margin: "0 0 12px 0", color: "#166534", fontSize: "13px" }}>
        {analysisResult.suggestion.reason}
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={() => onBuildFromUrls()}
          style={{
            padding: "10px 16px",
            backgroundColor: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Build Skill
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "10px 16px",
            backgroundColor: "#fff",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Sub-component for "Split Topics" action
function SplitTopicsPanel({
  analysisResult,
  selectedSplitIndex,
  onBuildSplitSkill,
  onSkipAnalysis,
  onCancel,
}: {
  analysisResult: AnalysisResult;
  selectedSplitIndex: number | null;
  onBuildSplitSkill: (split: SplitSuggestion, index: number) => void;
  onSkipAnalysis: () => void;
  onCancel: () => void;
}) {
  const splitSuggestions = analysisResult.suggestion.splitSuggestions!;

  return (
    <div style={{
      padding: "16px",
      backgroundColor: "#ede9fe",
      borderRadius: "8px",
      border: "1px solid #c4b5fd",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "18px" }}>🔀</span>
        <strong style={{ color: "#5b21b6" }}>Multiple topics detected</strong>
      </div>
      <p style={{ margin: "0 0 12px 0", color: "#6d28d9", fontSize: "14px" }}>
        {analysisResult.suggestion.reason}
      </p>
      <p style={{ margin: "0 0 12px 0", color: "#7c3aed", fontSize: "13px" }}>
        Consider creating separate, focused skills for each topic:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
        {splitSuggestions.map((split, idx) => (
          <div key={idx} style={{
            padding: "12px",
            backgroundColor: "#fff",
            borderRadius: "6px",
            border: "1px solid #ddd6fe",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: "#5b21b6", fontSize: "14px" }}>{split.title}</strong>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "12px" }}>
                  {split.description}
                </p>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "11px" }}>
                  {split.relevantUrls.length} URL(s)
                </p>
              </div>
              <button
                onClick={() => onBuildSplitSkill(split, idx)}
                disabled={selectedSplitIndex !== null}
                style={{
                  padding: "8px 12px",
                  backgroundColor: selectedSplitIndex === idx ? "#94a3b8" : "#8b5cf6",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: selectedSplitIndex !== null ? "not-allowed" : "pointer",
                  fontSize: "13px",
                }}
              >
                {selectedSplitIndex === idx ? "Building..." : "Build This"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid #ddd6fe" }}>
        <button
          onClick={onSkipAnalysis}
          style={{
            padding: "10px 16px",
            backgroundColor: "#fff",
            color: "#5b21b6",
            border: "1px solid #c4b5fd",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Build All as One Skill Anyway
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "10px 16px",
            backgroundColor: "#fff",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
