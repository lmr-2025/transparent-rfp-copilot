"use client";

type Props = {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
  title?: string;
  compact?: boolean;
};

export default function SuggestedPrompts({
  prompts,
  onSelectPrompt,
  disabled = false,
  title = "Suggested questions",
  compact = false,
}: Props) {
  if (prompts.length === 0) return null;

  if (compact) {
    // Compact inline display for after messages
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "12px",
        }}
      >
        {prompts.slice(0, 3).map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => !disabled && onSelectPrompt(prompt)}
            disabled={disabled}
            style={{
              background: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: "16px",
              padding: "6px 12px",
              fontSize: "12px",
              color: disabled ? "#adb5bd" : "#495057",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            onMouseOver={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = "#667eea";
                e.currentTarget.style.background = "#f0f4ff";
                e.currentTarget.style.color = "#667eea";
              }
            }}
            onMouseOut={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = "#e9ecef";
                e.currentTarget.style.background = "#f8f9fa";
                e.currentTarget.style.color = "#495057";
              }
            }}
          >
            {prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt}
          </button>
        ))}
      </div>
    );
  }

  // Full display with title
  return (
    <div
      style={{
        background: "#fafbff",
        border: "1px solid #e9ecef",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#667eea"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="10" r="1" fill="#667eea" />
          <circle cx="12" cy="10" r="1" fill="#667eea" />
          <circle cx="15" cy="10" r="1" fill="#667eea" />
        </svg>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#495057",
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {prompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => !disabled && onSelectPrompt(prompt)}
            disabled={disabled}
            style={{
              background: "#fff",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              color: disabled ? "#adb5bd" : "#495057",
              cursor: disabled ? "not-allowed" : "pointer",
              textAlign: "left",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
            onMouseOver={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = "#667eea";
                e.currentTarget.style.background = "#f8f9ff";
              }
            }}
            onMouseOut={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = "#dee2e6";
                e.currentTarget.style.background = "#fff";
              }
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ flexShrink: 0, opacity: 0.5 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span style={{ flex: 1 }}>{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
