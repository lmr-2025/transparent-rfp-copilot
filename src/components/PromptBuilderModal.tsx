"use client";

import { useState } from "react";
import { ModalContainer } from "@/components/ui/modal";

export type PromptSection = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  content: string;
  editable?: boolean;
  editableValue?: string;
  onEdit?: (value: string) => void;
  hint?: string;
  placeholder?: boolean; // If true, content is shown with reduced opacity
};

type PromptBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sections: PromptSection[];
  onReset?: () => void;
};

export default function PromptBuilderModal({
  isOpen,
  onClose,
  title,
  subtitle,
  sections,
  onReset,
}: PromptBuilderModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      width="full"
      padding={false}
      contentStyle={{
        borderRadius: "16px",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      overlayStyle={{ padding: "20px" }}
      ariaLabelledBy="prompt-builder-modal-title"
    >
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}>
          <div>
            <h2 id="prompt-builder-modal-title" style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>{title}</h2>
            {subtitle && (
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              backgroundColor: "transparent",
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
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: Components */}
          <div style={{
            flex: 1,
            padding: "20px 24px",
            overflowY: "auto",
            borderRight: "1px solid #e2e8f0",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                Components
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={expandAll}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "transparent",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "11px",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "transparent",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "11px",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  Collapse All
                </button>
                {onReset && (
                  <button
                    onClick={onReset}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "transparent",
                      border: "1px solid #fecaca",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#dc2626",
                      cursor: "pointer",
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {sections.map((section, idx) => {
              const isExpanded = expandedSections.has(section.id);
              return (
                <div
                  key={section.id}
                  style={{
                    backgroundColor: "#fff",
                    border: `2px solid ${section.borderColor}`,
                    borderRadius: "12px",
                    marginBottom: "12px",
                    overflow: "hidden",
                  }}
                >
                  {/* Dropdown Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`section-content-${section.id}`}
                    onClick={() => toggleSection(section.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSection(section.id);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: isExpanded ? section.bgColor : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        backgroundColor: section.color,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: section.textColor }}>
                          {section.label}
                        </div>
                        {section.hint && (
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{section.hint}</div>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}>
                      ▼
                    </div>
                  </div>

                  {/* Dropdown Content */}
                  {isExpanded && (
                    <div
                      id={`section-content-${section.id}`}
                      style={{
                        padding: "16px",
                        borderTop: `1px solid ${section.borderColor}`,
                        backgroundColor: section.bgColor,
                      }}
                    >
                      {section.editable ? (
                        <textarea
                          value={section.editableValue || ""}
                          onChange={(e) => section.onEdit?.(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "150px",
                            padding: "12px",
                            borderRadius: "8px",
                            border: `1px solid ${section.borderColor}`,
                            backgroundColor: "#fff",
                            fontFamily: "monospace",
                            fontSize: "12px",
                            color: section.textColor,
                            resize: "vertical",
                          }}
                        />
                      ) : (
                        <div style={{
                          backgroundColor: section.placeholder ? "transparent" : "#fff",
                          border: section.placeholder ? "none" : `1px solid ${section.borderColor}`,
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          color: section.textColor,
                          whiteSpace: "pre-wrap",
                          opacity: section.placeholder ? 0.7 : 1,
                        }}>
                          {section.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Assembled Preview */}
          <div style={{
            flex: 1,
            padding: "20px 24px",
            backgroundColor: "#1e293b",
            overflowY: "auto",
          }}>
            <h3 style={{
              margin: "0 0 16px 0",
              fontSize: "12px",
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Assembled Prompt Preview
            </h3>

            {sections.map((section) => (
              <div key={section.id} style={{ marginBottom: "20px" }}>
                <div style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  backgroundColor: section.color,
                  color: "#fff",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  marginBottom: "10px",
                  textTransform: "uppercase",
                }}>
                  {section.label}
                </div>
                <pre style={{
                  margin: 0,
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: section.bgColor,
                  whiteSpace: "pre-wrap",
                  opacity: section.placeholder ? 0.6 : 1,
                  lineHeight: 1.5,
                }}>
                  {section.editable ? (section.editableValue || section.content) : section.content}
                </pre>
              </div>
            ))}
          </div>
        </div>
    </ModalContainer>
  );
}
