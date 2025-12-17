"use client";

import { useState } from "react";
import { Copy, Check, RotateCcw, Save, ChevronDown, ChevronRight, Info } from "lucide-react";

export type PresetDraft = {
  name: string;
  description: string;
  content: string;
};

type BuilderPreviewPanelProps = {
  draft: PresetDraft;
  onDraftChange: (draft: PresetDraft) => void;
  onStartOver: () => void;
  onSave: () => void;
  saving: boolean;
  hasContent: boolean;
  chatSystemPrompt?: string;
};

export default function BuilderPreviewPanel({
  draft,
  onDraftChange,
  onStartOver,
  onSave,
  saving,
  hasContent,
  chatSystemPrompt,
}: BuilderPreviewPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const handleCopy = async () => {
    if (!draft.content) return;
    try {
      await navigator.clipboard.writeText(draft.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = draft.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      backgroundColor: "#f8fafc",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#fff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#334155" }}>
            Preview
          </h3>
          {hasContent && (
            <span style={{
              fontSize: "11px",
              padding: "2px 8px",
              backgroundColor: "#dcfce7",
              color: "#166534",
              borderRadius: "999px",
            }}>
              Ready to save
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px",
      }}>
        {/* System Prompt Context (Collapsible) */}
        {chatSystemPrompt && (
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                width: "100%",
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#475569",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {showSystemPrompt ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Info size={14} />
              <span style={{ flex: 1 }}>Chat System Prompt (what your instruction will accompany)</span>
            </button>
            {showSystemPrompt && (
              <div style={{
                marginTop: "8px",
                padding: "12px",
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "12px",
                lineHeight: "1.6",
                color: "#64748b",
                whiteSpace: "pre-wrap",
                maxHeight: "200px",
                overflowY: "auto",
              }}>
                {chatSystemPrompt}
              </div>
            )}
          </div>
        )}

        {/* Name Field */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 500,
            color: "#64748b",
            marginBottom: "6px",
          }}>
            Name
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
            placeholder="e.g., Security Expert"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "#fff",
            }}
          />
        </div>

        {/* Description Field */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 500,
            color: "#64748b",
            marginBottom: "6px",
          }}>
            Description
          </label>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
            placeholder="Brief description of the preset"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "#fff",
            }}
          />
        </div>

        {/* Content Field */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 500,
            color: "#64748b",
            marginBottom: "6px",
          }}>
            Instructions
          </label>
          <textarea
            value={draft.content}
            onChange={(e) => onDraftChange({ ...draft, content: e.target.value })}
            placeholder="The AI will help you build this..."
            style={{
              width: "100%",
              minHeight: "300px",
              padding: "12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "13px",
              lineHeight: "1.6",
              fontFamily: "system-ui, -apple-system, sans-serif",
              resize: "vertical",
              backgroundColor: "#fff",
            }}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid #e2e8f0",
        backgroundColor: "#fff",
        display: "flex",
        gap: "8px",
      }}>
        <button
          onClick={onStartOver}
          style={{
            padding: "8px 12px",
            backgroundColor: "#fff",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RotateCcw size={14} />
          Start Over
        </button>
        <button
          onClick={handleCopy}
          disabled={!draft.content}
          style={{
            padding: "8px 12px",
            backgroundColor: "#fff",
            color: draft.content ? "#64748b" : "#cbd5e1",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "13px",
            cursor: draft.content ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={onSave}
          disabled={!draft.name || !draft.content || saving}
          style={{
            flex: 1,
            padding: "8px 16px",
            backgroundColor: draft.name && draft.content ? "#6366f1" : "#e2e8f0",
            color: draft.name && draft.content ? "#fff" : "#94a3b8",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: draft.name && draft.content && !saving ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Save size={14} />
          {saving ? "Saving..." : "Save as Preset"}
        </button>
      </div>
    </div>
  );
}
