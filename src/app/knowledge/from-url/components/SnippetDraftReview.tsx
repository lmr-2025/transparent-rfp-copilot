"use client";

import { SnippetDraft } from "../types";
import { styles } from "../styles";

interface SnippetDraftReviewProps {
  draft: SnippetDraft;
  onSave: () => void;
  onCancel: () => void;
}

export default function SnippetDraftReview({
  draft,
  onSave,
  onCancel,
}: SnippetDraftReviewProps) {
  return (
    <div style={{
      ...styles.card,
      backgroundColor: "#f0fdf4",
      border: "2px solid #10b981",
    }}>
      <h3 style={{ marginTop: 0, color: "#059669" }}>Generated Context Snippet - Review & Save</h3>
      <div style={{ marginBottom: "16px" }}>
        <strong>Name:</strong> {draft.name}
      </div>
      <div style={{ marginBottom: "16px" }}>
        <strong>Key:</strong>{" "}
        <code style={{
          backgroundColor: "#f0f9ff",
          color: "#0ea5e9",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "13px",
        }}>
          {`{{${draft.key}}}`}
        </code>
      </div>
      {draft.category && (
        <div style={{ marginBottom: "16px" }}>
          <strong>Category:</strong>{" "}
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            backgroundColor: "#e0f2fe",
            color: "#0369a1",
            borderRadius: "4px",
            fontSize: "13px",
          }}>
            {draft.category}
          </span>
        </div>
      )}
      {draft.description && (
        <div style={{ marginBottom: "16px" }}>
          <strong>Description:</strong>{" "}
          <span style={{ color: "#64748b" }}>{draft.description}</span>
        </div>
      )}
      <div style={{ marginBottom: "16px" }}>
        <strong>Content:</strong>
        <pre style={{
          backgroundColor: "#fff",
          padding: "12px",
          borderRadius: "6px",
          overflow: "auto",
          maxHeight: "300px",
          fontSize: "13px",
          whiteSpace: "pre-wrap",
          border: "1px solid #e2e8f0",
        }}>
          {draft.content}
        </pre>
      </div>
      {draft._sourceUrls && draft._sourceUrls.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <strong>Sources:</strong>
          <ul style={{ margin: "4px 0 0 20px", fontSize: "13px" }}>
            {draft._sourceUrls.map((url, index) => (
              <li key={index} style={{ marginBottom: "4px" }}>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={onSave}
          style={{
            padding: "10px 20px",
            backgroundColor: "#059669",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save to Snippets Library
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "10px 20px",
            backgroundColor: "#94a3b8",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
