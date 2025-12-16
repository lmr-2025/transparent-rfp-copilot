"use client";

import { RFPEntry, styles } from "./types";

type PreviewAnalyzeStepProps = {
  rfpEntries: RFPEntry[];
  skillsCount: number;
  isAnalyzing: boolean;
  onAnalyze: () => void;
};

export default function PreviewAnalyzeStep({
  rfpEntries,
  skillsCount,
  isAnalyzing,
  onAnalyze,
}: PreviewAnalyzeStepProps) {
  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>Step 3: Review & Analyze</h3>
      <p style={{ color: "#166534", fontWeight: 500, marginBottom: "16px" }}>
        Found {rfpEntries.length} Q&A pairs to analyze against {skillsCount} existing skills.
      </p>

      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          marginBottom: "16px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0 }}>
              <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Question
              </th>
              <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Answer (Preview)
              </th>
            </tr>
          </thead>
          <tbody>
            {rfpEntries.slice(0, 20).map((entry, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #f1f5f9",
                    verticalAlign: "top",
                    maxWidth: "300px",
                  }}
                >
                  {entry.question.length > 100
                    ? entry.question.substring(0, 100) + "..."
                    : entry.question}
                </td>
                <td
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #f1f5f9",
                    verticalAlign: "top",
                    color: "#64748b",
                  }}
                >
                  {entry.answer.length > 150
                    ? entry.answer.substring(0, 150) + "..."
                    : entry.answer}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rfpEntries.length > 20 && (
          <p style={{ padding: "10px", color: "#64748b", margin: 0, textAlign: "center" }}>
            ...and {rfpEntries.length - 20} more entries
          </p>
        )}
      </div>

      <button
        onClick={onAnalyze}
        disabled={isAnalyzing}
        style={{
          ...styles.button,
          backgroundColor: isAnalyzing ? "#94a3b8" : "#2563eb",
          color: "#fff",
        }}
      >
        {isAnalyzing ? "Analyzing..." : "Analyze Against Skills"}
      </button>

      {isAnalyzing && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            backgroundColor: "#eff6ff",
            border: "2px solid #60a5fa",
            borderRadius: "8px",
          }}
        >
          <p style={{ margin: 0, color: "#1e40af" }}>
            Analyzing RFP content against your skill library...
            <br />
            <span style={{ fontSize: "13px", color: "#60a5fa" }}>
              This may take 30-60 seconds depending on the number of entries.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
