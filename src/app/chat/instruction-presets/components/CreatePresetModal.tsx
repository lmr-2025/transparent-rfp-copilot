"use client";

import { useRef } from "react";
import SnippetPicker from "@/components/SnippetPicker";
import { styles, insertAtCursor } from "./types";

type CreatePresetModalProps = {
  newName: string;
  newDescription: string;
  newContent: string;
  onSetNewName: (value: string) => void;
  onSetNewDescription: (value: string) => void;
  onSetNewContent: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
  actionInProgress: string | null;
};

export default function CreatePresetModal({
  newName,
  newDescription,
  newContent,
  onSetNewName,
  onSetNewDescription,
  onSetNewContent,
  onCreate,
  onClose,
  actionInProgress,
}: CreatePresetModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = () => {
    onSetNewName("");
    onSetNewDescription("");
    onSetNewContent("");
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        padding: "24px",
        width: "90%",
        maxWidth: "600px",
        maxHeight: "90vh",
        overflow: "auto",
      }}>
        <h3 style={{ margin: "0 0 16px 0" }}>Create Org Preset</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
          This preset will be immediately available to all users.
        </p>
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
            Name *
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => onSetNewName(e.target.value)}
            placeholder="e.g., Security Questionnaire Expert"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
            Description
          </label>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => onSetNewDescription(e.target.value)}
            placeholder="Brief description of when to use this preset"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500 }}>
              Instructions *
            </label>
            <SnippetPicker
              onInsert={(snippet) => insertAtCursor(textareaRef, snippet, onSetNewContent, newContent)}
            />
          </div>
          <textarea
            ref={textareaRef}
            value={newContent}
            onChange={(e) => onSetNewContent(e.target.value)}
            placeholder="Enter the instruction text that will guide the AI's behavior..."
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "13px",
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
          <p style={{ marginTop: "4px", fontSize: "11px", color: "#94a3b8" }}>
            Use {"{{snippet_key}}"} to insert context snippets. They&apos;ll be expanded when the preset is applied.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={handleClose}
            style={{
              ...styles.button,
              backgroundColor: "#f1f5f9",
              color: "#475569",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={actionInProgress === "create" || !newName.trim() || !newContent.trim()}
            style={{
              ...styles.button,
              backgroundColor: "#6366f1",
              color: "#fff",
              opacity: (actionInProgress === "create" || !newName.trim() || !newContent.trim()) ? 0.6 : 1,
            }}
          >
            {actionInProgress === "create" ? "Creating..." : "Create Preset"}
          </button>
        </div>
      </div>
    </div>
  );
}
