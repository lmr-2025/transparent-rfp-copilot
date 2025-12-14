"use client";

import { ChatSessionItem } from "./types";

type Props = {
  chatHistory: ChatSessionItem[];
  currentSessionId: string | null;
  loadingHistory: boolean;
  onLoadSession: (item: ChatSessionItem) => void;
  onDeleteSession: (id: string) => void;
};

const formatSessionDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function ChatHistory({
  chatHistory,
  currentSessionId,
  loadingHistory,
  onLoadSession,
  onDeleteSession,
}: Props) {
  if (loadingHistory) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
        Loading history...
      </div>
    );
  }

  if (chatHistory.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
        No chat history yet. Start a conversation to save it!
      </div>
    );
  }

  return (
    <>
      {chatHistory.map((item) => (
        <div
          key={item.id}
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            cursor: "pointer",
            transition: "background-color 0.15s",
            backgroundColor: currentSessionId === item.id ? "#eff6ff" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (currentSessionId !== item.id) {
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }
          }}
          onMouseLeave={(e) => {
            if (currentSessionId !== item.id) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div
              style={{ flex: 1, cursor: "pointer" }}
              onClick={() => onLoadSession(item)}
            >
              <div
                style={{
                  fontWeight: 500,
                  color: "#1e293b",
                  marginBottom: "4px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "calc(100% - 60px)",
                }}
              >
                {item.title || "Untitled Chat"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {formatSessionDate(item.updatedAt)}
                {item.skillsUsed && item.skillsUsed.length > 0 && (
                  <span style={{ marginLeft: "8px" }}>
                    • {item.skillsUsed.length} skill{item.skillsUsed.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(item.id);
              }}
              style={{
                padding: "4px 8px",
                backgroundColor: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "0.8rem",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              title="Delete chat"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
