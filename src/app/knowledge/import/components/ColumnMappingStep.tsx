"use client";

import { styles } from "./types";

type ColumnMappingStepProps = {
  columns: string[];
  questionColumn: string;
  answerColumn: string;
  onSetQuestionColumn: (value: string) => void;
  onSetAnswerColumn: (value: string) => void;
  onExtract: () => void;
};

export default function ColumnMappingStep({
  columns,
  questionColumn,
  answerColumn,
  onSetQuestionColumn,
  onSetAnswerColumn,
  onExtract,
}: ColumnMappingStepProps) {
  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>Step 2: Map Columns</h3>
      <p style={{ color: "#64748b", fontSize: "14px" }}>
        Select which columns contain the questions and answers.
      </p>
      <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Question Column
          </label>
          <select
            value={questionColumn}
            onChange={(e) => onSetQuestionColumn(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Answer Column
          </label>
          <select
            value={answerColumn}
            onChange={(e) => onSetAnswerColumn(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={onExtract}
        disabled={!questionColumn || !answerColumn}
        style={{
          ...styles.button,
          marginTop: "16px",
          backgroundColor: !questionColumn || !answerColumn ? "#cbd5e1" : "#2563eb",
          color: "#fff",
        }}
      >
        Extract Q&A Pairs
      </button>
    </div>
  );
}
