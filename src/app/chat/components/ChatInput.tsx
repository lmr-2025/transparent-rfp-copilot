"use client";

import { RefObject } from "react";
import { TransparencyData } from "./types";
import { chatStyles as styles } from "./styles";

type Props = {
  inputValue: string;
  isLoading: boolean;
  totalKnowledgeSelected: number;
  selectedTransparency: TransparencyData | null;
  showSavePrompt: boolean;
  newPromptTitle: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onPreviewPrompt: () => void;
  onViewTransparency: () => void;
  onShowSavePrompt: (show: boolean) => void;
  onPromptTitleChange: (title: string) => void;
  onSavePrompt: () => void;
};

export function ChatInput({
  inputValue,
  isLoading,
  totalKnowledgeSelected,
  selectedTransparency,
  showSavePrompt,
  newPromptTitle,
  textareaRef,
  onInputChange,
  onKeyDown,
  onSend,
  onPreviewPrompt,
  onViewTransparency,
  onShowSavePrompt,
  onPromptTitleChange,
  onSavePrompt,
}: Props) {
  return (
    <>
      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <div style={{
          padding: "12px 24px",
          backgroundColor: "#f0fdf4",
          borderTop: "1px solid #86efac",
        }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={newPromptTitle}
              onChange={e => onPromptTitleChange(e.target.value.slice(0, 200))}
              placeholder="Enter a name for this prompt..."
              maxLength={200}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #86efac",
                borderRadius: "6px",
                fontSize: "13px",
              }}
            />
            <button
              onClick={onSavePrompt}
              disabled={!newPromptTitle.trim()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: newPromptTitle.trim() ? "pointer" : "not-allowed",
                opacity: newPromptTitle.trim() ? 1 : 0.5,
              }}
            >
              Save
            </button>
            <button
              onClick={() => { onShowSavePrompt(false); onPromptTitleChange(""); }}
              style={{
                padding: "8px 12px",
                backgroundColor: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{
            marginTop: "4px",
            fontSize: "11px",
            color: newPromptTitle.length > 180 ? "#dc2626" : "#94a3b8",
            textAlign: "right",
          }}>
            {newPromptTitle.length} / 200
          </div>
        </div>
      )}

      <div style={styles.inputArea}>
        {/* Transparency status bar */}
        {selectedTransparency && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              padding: "8px 12px",
              backgroundColor: "#f0fdf4",
              borderRadius: "8px",
              border: "1px solid #86efac",
            }}
          >
            <span style={{ fontSize: "12px", color: "#166534" }}>
              Last prompt used: {selectedTransparency.model} • {selectedTransparency.knowledgeContext.length.toLocaleString()} chars of context
            </span>
            <button
              onClick={onViewTransparency}
              style={{
                padding: "4px 10px",
                backgroundColor: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              View Full Prompt
            </button>
          </div>
        )}

        <div style={{ position: "relative" }}>
          <div style={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => onInputChange(e.target.value.slice(0, 10000))}
              onKeyDown={onKeyDown}
              placeholder={
                totalKnowledgeSelected === 0
                  ? "Select at least one knowledge item to start chatting..."
                  : "Ask a question about your knowledge base..."
              }
              disabled={isLoading || totalKnowledgeSelected === 0}
              style={{
                ...styles.textarea,
                opacity: totalKnowledgeSelected === 0 ? 0.6 : 1,
              }}
              maxLength={10000}
            />
            {inputValue.trim() && !showSavePrompt && (
              <button
                onClick={() => onShowSavePrompt(true)}
                style={{
                  padding: "12px",
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
                title="Save as prompt"
              >
                💾
              </button>
            )}
            <button
              onClick={onPreviewPrompt}
              disabled={totalKnowledgeSelected === 0}
              style={{
                padding: "12px 16px",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: "1px solid #86efac",
                borderRadius: "12px",
                fontWeight: 500,
                cursor: totalKnowledgeSelected === 0 ? "not-allowed" : "pointer",
                opacity: totalKnowledgeSelected === 0 ? 0.5 : 1,
                fontSize: "13px",
              }}
              title="Preview the system prompt that will be sent"
            >
              Preview Prompt
            </button>
            <button
              onClick={onSend}
              disabled={!inputValue.trim() || isLoading || totalKnowledgeSelected === 0}
              style={{
                ...styles.sendButton,
                opacity: !inputValue.trim() || isLoading || totalKnowledgeSelected === 0 ? 0.5 : 1,
                cursor: !inputValue.trim() || isLoading || totalKnowledgeSelected === 0 ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </div>
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "4px",
            fontSize: "11px",
            color: inputValue.length > 9000 ? "#dc2626" : "#94a3b8",
          }}>
            {inputValue.length.toLocaleString()} / 10,000
          </div>
        </div>
      </div>
    </>
  );
}
