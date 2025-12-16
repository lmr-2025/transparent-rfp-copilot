"use client";

import {
  CustomerProfileDraft,
  CustomerProfileKeyFact,
} from "@/types/customerProfile";
import { styles } from "./styles";
import { TransparencyData } from "./types";

type DraftEditorCardProps = {
  draft: CustomerProfileDraft;
  buildTransparency: TransparencyData | null;
  isSaving: boolean;
  onUpdateDraft: (field: keyof CustomerProfileDraft, value: unknown) => void;
  onAddKeyFact: () => void;
  onUpdateKeyFact: (index: number, field: "label" | "value", value: string) => void;
  onRemoveKeyFact: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onViewPrompt: () => void;
};

export default function DraftEditorCard({
  draft,
  buildTransparency,
  isSaving,
  onUpdateDraft,
  onAddKeyFact,
  onUpdateKeyFact,
  onRemoveKeyFact,
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

      <label style={styles.label}>Overview *</label>
      <textarea
        style={{ ...styles.textarea, minHeight: "150px" }}
        value={draft.overview}
        onChange={(e) => onUpdateDraft("overview", e.target.value)}
      />

      <label style={styles.label}>Products & Services</label>
      <textarea
        style={styles.textarea}
        value={draft.products || ""}
        onChange={(e) => onUpdateDraft("products", e.target.value)}
        placeholder="Description of main products and services..."
      />

      <label style={styles.label}>Challenges & Needs</label>
      <textarea
        style={styles.textarea}
        value={draft.challenges || ""}
        onChange={(e) => onUpdateDraft("challenges", e.target.value)}
        placeholder="Known business challenges, pain points, or focus areas..."
      />

      <label style={styles.label}>Key Facts</label>
      {(draft.keyFacts || []).map((fact, idx) => (
        <div key={idx} style={styles.keyFact}>
          <input
            style={{ ...styles.input, width: "150px" }}
            value={fact.label}
            onChange={(e) => onUpdateKeyFact(idx, "label", e.target.value)}
            placeholder="Label"
          />
          <input
            style={{ ...styles.input, flex: 1 }}
            value={fact.value}
            onChange={(e) => onUpdateKeyFact(idx, "value", e.target.value)}
            placeholder="Value"
          />
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              padding: "8px 12px",
            }}
            onClick={() => onRemoveKeyFact(idx)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        style={{
          ...styles.button,
          ...styles.secondaryButton,
          marginTop: "8px",
        }}
        onClick={onAddKeyFact}
      >
        + Add Fact
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
          disabled={isSaving || !draft.name.trim() || !draft.overview.trim()}
        >
          {isSaving ? <>Saving...</> : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
