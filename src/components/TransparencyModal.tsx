"use client";

import React from "react";
import { ModalContainer } from "@/components/ui/modal";

export type TransparencyConfig = {
  label: string;
  value: string | number;
  color: "purple" | "blue" | "yellow" | "green";
};

export type TransparencyModalProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  configs: TransparencyConfig[];
  systemPrompt: string;
  systemPromptNote?: React.ReactNode;
  userPrompt?: string;
  userPromptLabel?: string;
  userPromptNote?: React.ReactNode;
  /** Header background color - defaults to gray */
  headerColor?: "purple" | "blue" | "gray";
};

const colorSchemes = {
  purple: { bg: "#faf5ff", border: "#c4b5fd", label: "#6d28d9", value: "#4c1d95" },
  blue: { bg: "#f0f9ff", border: "#bae6fd", label: "#0369a1", value: "#0c4a6e" },
  yellow: { bg: "#fef3c7", border: "#fcd34d", label: "#92400e", value: "#78350f" },
  green: { bg: "#f0fdf4", border: "#86efac", label: "#166534", value: "#14532d" },
};

const headerColors = {
  purple: "#faf5ff",
  blue: "#f0f9ff",
  gray: "#f8fafc",
};

const titleColors = {
  purple: "#6d28d9",
  blue: "#0369a1",
  gray: "#1e293b",
};

export default function TransparencyModal({
  title,
  subtitle,
  onClose,
  configs,
  systemPrompt,
  systemPromptNote,
  userPrompt,
  userPromptLabel = "User Prompt",
  userPromptNote,
  headerColor = "gray",
}: TransparencyModalProps) {
  return (
    <ModalContainer
      isOpen={true}
      onClose={onClose}
      width="large"
      padding={false}
      contentStyle={{
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      }}
      overlayStyle={{ padding: "20px" }}
      ariaLabelledBy="transparency-modal-title"
    >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: headerColors[headerColor],
          }}
        >
          <div>
            <h3 id="transparency-modal-title" style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: titleColors[headerColor] }}>
              {title}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {/* Config Cards */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
              Model Configuration
            </h4>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {configs.map((config, idx) => {
                const scheme = colorSchemes[config.color];
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: scheme.bg,
                      borderRadius: "8px",
                      border: `1px solid ${scheme.border}`,
                    }}
                  >
                    <div style={{ fontSize: "11px", color: scheme.label, fontWeight: 600, marginBottom: "4px" }}>
                      {config.label}
                    </div>
                    <div style={{ fontSize: "14px", color: scheme.value, fontFamily: "monospace" }}>
                      {typeof config.value === "number" ? config.value.toLocaleString() : config.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Prompt */}
          <div style={{ marginBottom: userPrompt ? "24px" : 0 }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
              System Prompt
            </h4>
            <div
              style={{
                backgroundColor: "#1e293b",
                borderRadius: "8px",
                padding: "16px",
                overflow: "auto",
                maxHeight: "300px",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  color: "#e2e8f0",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: 1.6,
                }}
              >
                {systemPrompt}
              </pre>
            </div>
            {systemPromptNote && (
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                {systemPromptNote}
              </p>
            )}
          </div>

          {/* User Prompt / Context */}
          {userPrompt && (
            <div>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
                {userPromptLabel}
              </h4>
              <div
                style={{
                  backgroundColor: "#fafafa",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "16px",
                  maxHeight: "300px",
                  overflow: "auto",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    color: "#475569",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.5,
                  }}
                >
                  {userPrompt.length > 5000
                    ? userPrompt.substring(0, 5000) + "\n\n... (truncated for display)"
                    : userPrompt}
                </pre>
              </div>
              {userPromptNote ? (
                <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  {userPromptNote}
                </p>
              ) : (
                <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  Total: {userPrompt.length.toLocaleString()} characters
                </p>
              )}
            </div>
          )}
        </div>
    </ModalContainer>
  );
}
