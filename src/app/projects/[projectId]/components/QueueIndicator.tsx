"use client";

type QueueIndicatorProps = {
  queuedCount: number;
  isSending: boolean;
  onSendAll: () => void;
  onClear: () => void;
};

export default function QueueIndicator({
  queuedCount,
  isSending,
  onSendAll,
  onClear,
}: QueueIndicatorProps) {
  if (queuedCount === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        backgroundColor: "#8b5cf6",
        color: "#fff",
        borderRadius: "12px",
        padding: "16px 20px",
        boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        zIndex: 1000,
        animation: "pulse 2s infinite",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
          {queuedCount} review{queuedCount === 1 ? "" : "s"} queued
        </div>
        <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>
          Send when ready or finish your review first
        </div>
      </div>
      <button
        type="button"
        onClick={onSendAll}
        disabled={isSending}
        style={{
          padding: "8px 16px",
          backgroundColor: "#fff",
          color: "#8b5cf6",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
          cursor: isSending ? "not-allowed" : "pointer",
          opacity: isSending ? 0.7 : 1,
        }}
      >
        {isSending ? "Sending..." : "Send All"}
      </button>
      <button
        type="button"
        onClick={onClear}
        style={{
          padding: "4px 8px",
          backgroundColor: "transparent",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          opacity: 0.7,
          fontSize: "1.2rem",
        }}
        title="Clear queue"
      >
        &#x2715;
      </button>
    </div>
  );
}
