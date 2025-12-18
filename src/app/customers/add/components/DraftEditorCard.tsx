"use client";

import { CustomerProfileDraft } from "@/types/customerProfile";
import { styles } from "./styles";
import { TransparencyData } from "./types";

type DraftEditorCardProps = {
  draft: CustomerProfileDraft;
  buildTransparency: TransparencyData | null;
  isSaving: boolean;
  onUpdateDraft: (field: keyof CustomerProfileDraft, value: unknown) => void;
  onAddConsideration: () => void;
  onUpdateConsideration: (index: number, value: string) => void;
  onRemoveConsideration: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onViewPrompt: () => void;
};

export default function DraftEditorCard({
  draft,
  buildTransparency,
  isSaving,
  onUpdateDraft,
  onAddConsideration,
  onUpdateConsideration,
  onRemoveConsideration,
  onSave,
  onCancel,
  onViewPrompt,
}: DraftEditorCardProps) {
  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0 }}>
          Review & Edit Profile
        </h3>
        {buildTransparency && (
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              fontSize: "12px",
              padding: "6px 10px",
            }}
            onClick={onViewPrompt}
          >
            View Prompt
          </button>
        )}
      </div>

      <label style={styles.label}>Company Name *</label>
      <input
        style={styles.input}
        value={draft.name}
        onChange={(e) => onUpdateDraft("name", e.target.value)}
      />

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Industry</label>
          <input
            style={styles.input}
            value={draft.industry || ""}
            onChange={(e) => onUpdateDraft("industry", e.target.value)}
            placeholder="e.g., Healthcare, FinTech"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Website</label>
          <input
            style={styles.input}
            value={draft.website || ""}
            onChange={(e) => onUpdateDraft("website", e.target.value)}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <label style={styles.label}>
        Profile Content *
        <span style={{ fontWeight: "normal", color: "#64748b", marginLeft: "8px" }}>
          (Markdown supported)
        </span>
      </label>
      <textarea
        style={{ ...styles.textarea, minHeight: "300px", fontFamily: "monospace", fontSize: "13px" }}
        value={draft.content}
        onChange={(e) => onUpdateDraft("content", e.target.value)}
        placeholder={`## Overview
Company overview and background...

## Products & Services
Their main offerings...

## Key Facts
- Founded: [year]
- Headquarters: [location]
- Employees: [count]

## Challenges & Needs
Known priorities and pain points...`}
      />

      <label style={styles.label}>
        Considerations
        <span style={{ fontWeight: "normal", color: "#64748b", marginLeft: "8px" }}>
          (Special notes about this customer)
        </span>
      </label>
      {(draft.considerations || []).map((consideration, idx) => (
        <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input
            style={{ ...styles.input, flex: 1 }}
            value={consideration}
            onChange={(e) => onUpdateConsideration(idx, e.target.value)}
            placeholder="e.g., Highly regulated industry - prioritize compliance topics"
          />
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              padding: "8px 12px",
            }}
            onClick={() => onRemoveConsideration(idx)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        style={{
          ...styles.button,
          ...styles.secondaryButton,
          marginTop: "4px",
        }}
        onClick={onAddConsideration}
      >
        + Add Consideration
      </button>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={onSave}
          disabled={isSaving || !draft.name.trim() || !draft.content?.trim()}
        >
          {isSaving ? <>Saving...</> : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
