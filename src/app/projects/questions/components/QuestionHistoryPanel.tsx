"use client";

import Link from "next/link";
import { QuestionHistoryItem, formatHistoryDate } from "./types";

type QuestionHistoryPanelProps = {
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  questionHistory: QuestionHistoryItem[];
  isLoggedIn: boolean;
  loadingHistory: boolean;
  onLoadHistoryItem: (item: QuestionHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
};

export default function QuestionHistoryPanel({
  showHistory,
  setShowHistory,
  questionHistory,
  isLoggedIn,
  loadingHistory,
  onLoadHistoryItem,
  onDeleteHistoryItem,
}: QuestionHistoryPanelProps) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <button
        type="button"
        onClick={() => setShowHistory(!showHistory)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          backgroundColor: showHistory ? "#dbeafe" : "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "0.9rem",
          color: "#475569",
          fontWeight: 500,
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <span>📜 Question History {isLoggedIn ? `(${questionHistory.length})` : ""}</span>
        <span style={{ fontSize: "0.8rem" }}>{showHistory ? "▲" : "▼"}</span>
      </button>

      {showHistory && (
        <div
          style={{
            marginTop: "8px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            backgroundColor: "#fff",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {!isLoggedIn ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
              <Link href="/auth/signin" style={{ color: "#0ea5e9", fontWeight: 500 }}>Sign in</Link> to save and view your question history.
            </div>
          ) : loadingHistory ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
              Loading history...
            </div>
          ) : questionHistory.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
              No question history yet. Ask a question to get started!
            </div>
          ) : (
            questionHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div
                    style={{ flex: 1, cursor: "pointer" }}
                    onClick={() => onLoadHistoryItem(item)}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        color: "#1e293b",
                        marginBottom: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "calc(100% - 100px)",
                      }}
                    >
                      {item.question}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#64748b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "calc(100% - 100px)",
                      }}
                    >
                      {item.response.slice(0, 100)}...
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                      {formatHistoryDate(item.createdAt)}
                      {item.confidence && (
                        <span style={{ marginLeft: "8px" }}>• {item.confidence}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryItem(item.id);
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
                    title="Delete from history"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
