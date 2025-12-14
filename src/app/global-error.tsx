"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "40px",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "32px 48px",
              maxWidth: "500px",
            }}
          >
            <h2
              style={{
                color: "#dc2626",
                fontSize: "24px",
                fontWeight: 600,
                margin: "0 0 12px 0",
              }}
            >
              Application Error
            </h2>
            <p
              style={{
                color: "#7f1d1d",
                fontSize: "14px",
                margin: "0 0 24px 0",
                lineHeight: 1.5,
              }}
            >
              A critical error occurred. Please refresh the page or try again later.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "10px 20px",
                backgroundColor: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {error.digest && (
              <p
                style={{
                  color: "#9ca3af",
                  fontSize: "11px",
                  marginTop: "16px",
                  fontFamily: "monospace",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
