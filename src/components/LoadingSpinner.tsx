"use client";

type LoadingSpinnerProps = {
  title: string;
  subtitle?: string;
};

export default function LoadingSpinner({ title, subtitle }: LoadingSpinnerProps) {
  return (
    <>
      <style>
        {`
          @keyframes loadingSpinnerSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{
        marginTop: "16px",
        padding: "16px",
        backgroundColor: "#eff6ff",
        border: "2px solid #60a5fa",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{
          width: "24px",
          height: "24px",
          border: "3px solid #e0e7ff",
          borderTop: "3px solid #2563eb",
          borderRadius: "50%",
          animation: "loadingSpinnerSpin 1s linear infinite",
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: subtitle ? "4px" : 0 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: "14px", color: "#60a5fa" }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
