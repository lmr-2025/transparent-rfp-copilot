"use client";

import { useState } from "react";
import { SkillCategoryItem } from "@/types/skill";
import { SkillDraft } from "../types";
import { styles } from "../styles";

interface SkillDraftReviewProps {
  draft: SkillDraft;
  categories: SkillCategoryItem[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function SkillDraftReview({
  draft,
  categories,
  selectedCategories,
  onCategoryChange,
  onSave,
  onCancel,
}: SkillDraftReviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const isUpdate = draft._isUpdate;

  return (
    <div style={{
      ...styles.card,
      backgroundColor: isUpdate ? "#fefce8" : "#f0fdf4",
      border: isUpdate ? "2px solid #fde047" : "2px solid #86efac",
    }}>
      <h3 style={{ marginTop: 0, color: isUpdate ? "#854d0e" : "#15803d" }}>
        {isUpdate ? `Update Skill: "${draft._originalTitle}"` : "Generated Skill"} - Review & Save
      </h3>

      {/* Change highlights for updates */}
      {isUpdate && draft._changeHighlights && draft._changeHighlights.length > 0 && (
        <div style={{
          backgroundColor: "#fef9c3",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px",
          border: "1px solid #fde047",
        }}>
          <strong style={{ color: "#854d0e", fontSize: "14px" }}>📝 Changes detected:</strong>
          {draft._changeSummary && (
            <p style={{ margin: "8px 0", color: "#92400e", fontSize: "13px" }}>
              {draft._changeSummary}
            </p>
          )}
          <ul style={{ margin: "8px 0 0 20px", padding: 0, color: "#78350f", fontSize: "13px" }}>
            {draft._changeHighlights.map((highlight, idx) => (
              <li key={idx} style={{ marginBottom: "4px" }}>{highlight}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ marginBottom: "16px" }}>
        <strong>Title:</strong> {draft.title}
      </div>
      <div style={{ marginBottom: "16px" }}>
        <strong>Categories:</strong>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "8px",
        }}>
          {categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat.name);
            return (
              <label
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: isSelected ? "1px solid #818cf8" : "1px solid #cbd5e1",
                  backgroundColor: isSelected ? "#e0e7ff" : "#fff",
                  color: isSelected ? "#3730a3" : "#475569",
                  cursor: "pointer",
                  fontSize: "13px",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onCategoryChange([...selectedCategories, cat.name]);
                    } else {
                      onCategoryChange(selectedCategories.filter(c => c !== cat.name));
                    }
                  }}
                  style={{ margin: 0 }}
                />
                {cat.name}
              </label>
            );
          })}
        </div>
        {selectedCategories.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
            Select at least one category (optional)
          </p>
        )}
      </div>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <strong>Content:</strong>
          {isUpdate && draft._originalContent && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              style={{
                padding: "4px 10px",
                backgroundColor: showOriginal ? "#e2e8f0" : "#fff",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {showOriginal ? "Show Updated" : "Show Original"}
            </button>
          )}
        </div>
        <pre style={{
          backgroundColor: "#fff",
          padding: "12px",
          borderRadius: "6px",
          overflow: "auto",
          maxHeight: "400px",
          fontSize: "13px",
          whiteSpace: "pre-wrap",
        }}>
          {showOriginal && draft._originalContent ? draft._originalContent : draft.content}
        </pre>
      </div>
      {draft.sourceMapping && draft.sourceMapping.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <strong>Sources:</strong>
          <ul style={{ margin: "4px 0 0 20px", fontSize: "13px" }}>
            {draft.sourceMapping.map((url, index) => (
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
            backgroundColor: isUpdate ? "#d97706" : "#15803d",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isUpdate ? "Apply Update" : "Save to Library"}
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
