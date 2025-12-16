"use client";

import { useState } from "react";
import Link from "next/link";

export type TransparencyData = {
  confidence?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  sources?: string;
};

// Skill/document references that can be linked
export type KnowledgeReference = {
  id: string;
  title: string;
  type: "skill" | "document";
};

type TransparencyDetailsProps = {
  data: TransparencyData;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  renderClarifyButton?: () => React.ReactNode;
  // Optional: pass matched skills/documents to enable linking
  knowledgeReferences?: KnowledgeReference[];
};

// Helper to render text with clickable URL links
function renderTextWithUrls(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex since we're reusing it
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline" }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Helper to render text with clickable skill/document references
function renderTextWithKnowledgeLinks(
  text: string,
  references: KnowledgeReference[]
): React.ReactNode {
  if (!references || references.length === 0) {
    return renderTextWithUrls(text);
  }

  // Sort references by title length (longest first) to avoid partial matches
  const sortedRefs = [...references].sort((a, b) => b.title.length - a.title.length);

  // Build a regex that matches any of the skill/document titles (case insensitive)
  const escapedTitles = sortedRefs.map(ref =>
    ref.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const titlePattern = new RegExp(`(${escapedTitles.join("|")})`, "gi");

  const parts = text.split(titlePattern);

  return parts.map((part, index) => {
    // Check if this part matches a reference title
    const matchedRef = sortedRefs.find(
      ref => ref.title.toLowerCase() === part.toLowerCase()
    );

    if (matchedRef) {
      const href = matchedRef.type === "skill"
        ? `/knowledge?highlight=${matchedRef.id}`
        : `/knowledge?highlight=${matchedRef.id}&tab=documents`;

      return (
        <Link
          key={index}
          href={href}
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            fontWeight: 500,
          }}
          title={`View ${matchedRef.type}: ${matchedRef.title}`}
        >
          {part}
        </Link>
      );
    }

    // For non-matching parts, still render URLs as links
    return <span key={index}>{renderTextWithUrls(part)}</span>;
  });
}

// Get confidence level styling - subtle pastel colors
function getConfidenceStyle(confidence: string): { bg: string; border: string; text: string } {
  const lower = confidence.toLowerCase();
  if (lower.includes("high") || lower.includes("confident")) {
    return { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" }; // Subtle green
  }
  if (lower.includes("medium") || lower.includes("moderate")) {
    return { bg: "#fffbeb", border: "#fde68a", text: "#92400e" }; // Subtle amber
  }
  if (lower.includes("low") || lower.includes("uncertain")) {
    return { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }; // Subtle red
  }
  // Default subtle blue for unknown
  return { bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1" };
}

export default function TransparencyDetails({
  data,
  defaultExpanded = false,
  onToggle,
  renderClarifyButton,
  knowledgeReferences = [],
}: TransparencyDetailsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { confidence, reasoning, inference, remarks, sources } = data;

  // Helper to render text with knowledge links
  const renderWithLinks = (text: string) =>
    renderTextWithKnowledgeLinks(text, knowledgeReferences);

  // Don't render anything if no data
  if (!confidence && !reasoning && !inference && !remarks && !sources) {
    return null;
  }

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  const hasExpandableContent = reasoning || inference || remarks || sources || renderClarifyButton;
  const confidenceStyle = getConfidenceStyle(confidence || "");

  // Check if there are non-trivial values for inline display
  const hasInference = inference && inference.toLowerCase() !== "none";
  const hasRemarks = remarks && remarks.toLowerCase() !== "none";
  const hasDetailContent = reasoning || hasInference || hasRemarks || sources;

  return (
    <div style={{ marginTop: "8px" }}>
      {/* Top row: Confidence, Details button, Clarify button */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Confidence Badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            backgroundColor: confidenceStyle.bg,
            border: `1px solid ${confidenceStyle.border}`,
            borderRadius: "6px",
            fontSize: "0.8rem",
            color: confidenceStyle.text,
            fontWeight: 500,
          }}
        >
          <strong style={{ marginRight: "4px" }}>Confidence:</strong> {confidence || "N/A"}
        </span>

        {/* Details Button */}
        {hasDetailContent && (
          <button
            type="button"
            onClick={handleToggle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 12px",
              backgroundColor: "#dbeafe",
              border: "1px solid #93c5fd",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#1e40af",
              fontWeight: 500,
            }}
          >
            {expanded ? "Hide Details" : "Details"}
          </button>
        )}

        {/* Clarify Button - visible at top level */}
        {renderClarifyButton && renderClarifyButton()}
      </div>

      {/* Inline summary: Inference and Remarks always visible if present */}
      {(hasInference || hasRemarks) && (
        <div style={{
          marginTop: "8px",
          padding: "8px 12px",
          backgroundColor: "#fefce8",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          fontSize: "0.82rem",
          lineHeight: "1.5",
          color: "#713f12",
        }}>
          {hasInference && (
            <div style={{ marginBottom: hasRemarks ? "4px" : "0" }}>
              <strong>Inference:</strong>{" "}
              <span style={{ whiteSpace: "pre-wrap" }}>{inference}</span>
            </div>
          )}
          {hasRemarks && (
            <div>
              <strong>Remarks:</strong>{" "}
              <span style={{ whiteSpace: "pre-wrap" }}>{remarks}</span>
            </div>
          )}
        </div>
      )}

      {/* Expanded Details Section - full width below */}
      {expanded && hasDetailContent && (
        <div
          style={{
            width: "100%",
            marginTop: "8px",
            padding: "10px 12px",
            backgroundColor: "#eff6ff",
            border: "1px solid #93c5fd",
            borderRadius: "6px",
            fontSize: "0.78rem",
            lineHeight: "1.5",
            color: "#1e3a5f",
          }}
        >
          {reasoning && (
            <div style={{ marginBottom: "4px" }}>
              <strong style={{ color: "#1e40af" }}>Reasoning:</strong>{" "}
              <span style={{ whiteSpace: "pre-wrap" }}>{reasoning}</span>
            </div>
          )}
          {sources && (
            <div>
              <strong style={{ color: "#1e40af" }}>Sources:</strong>{" "}
              <span style={{ whiteSpace: "pre-wrap" }}>{renderWithLinks(sources)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
