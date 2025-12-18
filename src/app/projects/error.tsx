"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Projects page error", error, { route: "/projects" });
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px",
        textAlign: "center",
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
          Project Error
        </h2>
        <p
          style={{
            color: "#7f1d1d",
            fontSize: "14px",
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          Unable to load projects. This might be a temporary issue.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
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
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fff",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Go home
          </button>
        </div>
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
  );
}
