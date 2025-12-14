"use client";

import { X, Loader2, Check } from "lucide-react";
import { MergePreviewState } from "../types";

interface MergePreviewModalProps {
  mergePreview: MergePreviewState;
  onClose: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateContent: (content: string) => void;
  onRemoveTag: (index: number) => void;
  onSave: () => void;
}

export default function MergePreviewModal({
  mergePreview,
  onClose,
  onUpdateTitle,
  onUpdateContent,
  onRemoveTag,
  onSave,
}: MergePreviewModalProps) {
  const canSave = !mergePreview.isSaving &&
    !mergePreview.isGenerating &&
    mergePreview.mergedTitle.trim() &&
    mergePreview.mergedContent.trim();

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        maxWidth: "900px",
        width: "100%",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#f0f9ff",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#0c4a6e" }}>Review Merged Skill</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Merging {mergePreview.skillsToMerge.length + 1} skills into one. Review and edit before saving.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#64748b",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {/* Skills being merged info */}
          <div style={{
            backgroundColor: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
              <strong>Target skill:</strong> {mergePreview.targetSkill.title}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#92400e" }}>
              <strong>Will merge from:</strong> {mergePreview.skillsToMerge.map(s => s.title).join(", ")}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#a16207" }}>
              The merged skills will be deleted after saving.
            </p>
          </div>

          {/* Title */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              Title
            </label>
            <input
              type="text"
              value={mergePreview.mergedTitle}
              onChange={(e) => onUpdateTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              Tags ({mergePreview.mergedTags.length})
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {mergePreview.mergedTags.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    padding: "4px 10px",
                    backgroundColor: "#e0e7ff",
                    color: "#3730a3",
                    borderRadius: "4px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {tag}
                  <button
                    onClick={() => onRemoveTag(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0",
                      color: "#3730a3",
                      display: "flex",
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Error message */}
          {mergePreview.error && (
            <div style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              padding: "12px 16px",
              marginBottom: "16px",
              color: "#dc2626",
              fontSize: "13px",
            }}>
              {mergePreview.error}
            </div>
          )}

          {/* Content */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              Content
            </label>
            {mergePreview.isGenerating ? (
              <div style={{
                width: "100%",
                padding: "40px 20px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                backgroundColor: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}>
                <div style={{
                  width: "24px",
                  height: "24px",
                  border: "3px solid #e2e8f0",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
                <div style={{ color: "#64748b", fontSize: "14px" }}>
                  AI is intelligently merging content from {mergePreview.skillsToMerge.length + 1} skills...
                </div>
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  Removing duplicates and organizing content
                </div>
              </div>
            ) : (
              <textarea
                value={mergePreview.mergedContent}
                onChange={(e) => onUpdateContent(e.target.value)}
                rows={20}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                  lineHeight: "1.5",
                }}
              />
            )}
          </div>

          {/* Source URLs */}
          {mergePreview.mergedSourceUrls.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                Source URLs ({mergePreview.mergedSourceUrls.length})
              </label>
              <div style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "8px 12px",
                maxHeight: "120px",
                overflow: "auto",
              }}>
                {mergePreview.mergedSourceUrls.map((src, i) => (
                  <div key={i} style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>
                    {src.url}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          backgroundColor: "#f8fafc",
        }}>
          <button
            onClick={onClose}
            disabled={mergePreview.isSaving}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#374151",
              cursor: mergePreview.isSaving ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: canSave ? "#22c55e" : "#94a3b8",
              color: "#fff",
              cursor: canSave ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {mergePreview.isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Merged Skill
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
