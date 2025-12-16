"use client";

import { useRef } from "react";
import SnippetPicker from "@/components/SnippetPicker";
import { InstructionPreset, styles, insertAtCursor } from "./types";

type EditPresetModalProps = {
  preset: InstructionPreset;
  editName: string;
  editDescription: string;
  editContent: string;
  onSetEditName: (value: string) => void;
  onSetEditDescription: (value: string) => void;
  onSetEditContent: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  actionInProgress: string | null;
};

export default function EditPresetModal({
  preset,
  editName,
  editDescription,
  editContent,
  onSetEditName,
  onSetEditDescription,
  onSetEditContent,
  onSave,
  onClose,
  actionInProgress,
}: EditPresetModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        <h3 style={{ margin: "0 0 16px 0" }}>Edit Preset</h3>
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
            Name
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => onSetEditName(e.target.value)}
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
            value={editDescription}
            onChange={(e) => onSetEditDescription(e.target.value)}
            placeholder="Brief description (optional)"
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
              Instructions
            </label>
            <SnippetPicker
              onInsert={(snippet) => insertAtCursor(textareaRef, snippet, onSetEditContent, editContent)}
            />
          </div>
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => onSetEditContent(e.target.value)}
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
            onClick={onClose}
            style={{
              ...styles.button,
              backgroundColor: "#f1f5f9",
              color: "#475569",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={actionInProgress === preset.id}
            style={{
              ...styles.button,
              backgroundColor: "#6366f1",
              color: "#fff",
              opacity: actionInProgress === preset.id ? 0.6 : 1,
            }}
          >
            {actionInProgress === preset.id ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
