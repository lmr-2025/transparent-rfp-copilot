"use client";

import { AnalysisResult, styles } from "./types";

type SuggestionsReviewStepProps = {
  analysisResult: AnalysisResult;
  selectedSuggestions: Set<number>;
  updateCount: number;
  newCount: number;
  onToggleSuggestion: (index: number) => void;
  onToggleAll: () => void;
  onApply: () => void;
  onCancel: () => void;
};

export default function SuggestionsReviewStep({
  analysisResult,
  selectedSuggestions,
  updateCount,
  newCount,
  onToggleSuggestion,
  onToggleAll,
  onApply,
  onCancel,
}: SuggestionsReviewStepProps) {
  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>Step 4: Review Suggestions</h3>
      <p style={{ color: "#64748b", marginBottom: "16px" }}>
        Select which suggestions to apply. Updates will append content to existing skills.
      </p>

      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
          padding: "12px",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
        }}
      >
        <div>
          <span style={{ color: "#0369a1", fontWeight: 600 }}>{updateCount}</span> skill updates
        </div>
        <div>
          <span style={{ color: "#15803d", fontWeight: 600 }}>{newCount}</span> new skills
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={onToggleAll}
            style={{
              ...styles.button,
              padding: "6px 12px",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              fontSize: "13px",
            }}
          >
            {selectedSuggestions.size === analysisResult.suggestions.length
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {analysisResult.suggestions.map((suggestion, index) => (
          <div
            key={index}
            style={{
              border: `2px solid ${selectedSuggestions.has(index) ? (suggestion.type === "update" ? "#60a5fa" : "#86efac") : "#e2e8f0"}`,
              borderRadius: "8px",
              padding: "16px",
              backgroundColor: selectedSuggestions.has(index)
                ? suggestion.type === "update"
                  ? "#eff6ff"
                  : "#f0fdf4"
                : "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <input
                type="checkbox"
                checked={selectedSuggestions.has(index)}
                onChange={() => onToggleSuggestion(index)}
                style={{ width: "18px", height: "18px", marginTop: "2px" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      backgroundColor: suggestion.type === "update" ? "#dbeafe" : "#dcfce7",
                      color: suggestion.type === "update" ? "#1e40af" : "#166534",
                    }}
                  >
                    {suggestion.type === "update" ? "UPDATE" : "NEW"}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "15px" }}>{suggestion.skillTitle}</span>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <strong style={{ fontSize: "13px", color: "#475569" }}>
                    Content to {suggestion.type === "update" ? "add" : "create"}:
                  </strong>
                  <pre
                    style={{
                      backgroundColor: "#fff",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                      whiteSpace: "pre-wrap",
                      marginTop: "6px",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {suggestion.suggestedAdditions}
                  </pre>
                </div>

                <details style={{ fontSize: "13px", color: "#64748b" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                    Based on {suggestion.relevantQA.length} Q&A pair
                    {suggestion.relevantQA.length !== 1 ? "s" : ""}
                  </summary>
                  <div style={{ marginTop: "8px", paddingLeft: "12px" }}>
                    {suggestion.relevantQA.map((qa, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: "8px",
                          paddingBottom: "8px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>Q: {qa.question}</div>
                        <div style={{ color: "#94a3b8" }}>
                          A: {qa.answer.length > 200 ? qa.answer.substring(0, 200) + "..." : qa.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>
        ))}
      </div>

      {analysisResult.unmatchedEntries.length > 0 && (
        <details style={{ marginTop: "20px" }}>
          <summary style={{ cursor: "pointer", color: "#64748b", fontWeight: 500 }}>
            {analysisResult.unmatchedEntries.length} entries could not be matched to any skill
          </summary>
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "#fef3c7",
              borderRadius: "6px",
              fontSize: "13px",
            }}
          >
            {analysisResult.unmatchedEntries.slice(0, 10).map((entry, i) => (
              <div key={i} style={{ marginBottom: "8px" }}>
                <strong>Q:</strong> {entry.question.substring(0, 100)}...
              </div>
            ))}
            {analysisResult.unmatchedEntries.length > 10 && (
              <p style={{ color: "#92400e" }}>
                ...and {analysisResult.unmatchedEntries.length - 10} more
              </p>
            )}
          </div>
        </details>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <button
          onClick={onApply}
          disabled={selectedSuggestions.size === 0}
          style={{
            ...styles.button,
            backgroundColor: selectedSuggestions.size === 0 ? "#cbd5e1" : "#15803d",
            color: "#fff",
          }}
        >
          Apply {selectedSuggestions.size} Selected
        </button>
        <button
          onClick={onCancel}
          style={{
            ...styles.button,
            backgroundColor: "#f1f5f9",
            color: "#475569",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
