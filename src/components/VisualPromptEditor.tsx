"use client";

import { useState, useMemo, useCallback } from "react";

type ParsedSection = {
  title: string;
  content: string;
};

type VisualPromptEditorProps = {
  prompt: string;
  onChange: (prompt: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Parse a prompt string into sections based on ## headers
 */
function parsePromptSections(prompt: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = prompt.split("\n");

  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        sections.push(currentSection);
      }
      // Start new section
      currentSection = { title: line.slice(3).trim(), content: "" };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    } else {
      // Content before any header - create an intro section
      if (line.trim()) {
        if (!currentSection) {
          currentSection = { title: "Introduction", content: "" };
        }
        contentLines.push(line);
      }
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Rebuild prompt string from sections
 */
function buildPromptFromSections(sections: ParsedSection[]): string {
  return sections
    .filter(s => s.content.trim())
    .map(s => `## ${s.title}\n${s.content}`)
    .join("\n\n");
}

export default function VisualPromptEditor({
  prompt,
  onChange,
  disabled = false,
  placeholder = "Enter prompt content...",
}: VisualPromptEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  const sections = useMemo(() => parsePromptSections(prompt), [prompt]);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(sections.map(s => s.title)));
  const collapseAll = () => setExpandedSections(new Set());

  const updateSection = useCallback((index: number, newContent: string) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], content: newContent };
    onChange(buildPromptFromSections(updated));
  }, [sections, onChange]);

  const updateSectionTitle = useCallback((index: number, newTitle: string) => {
    const updated = [...sections];
    const oldTitle = updated[index].title;
    updated[index] = { ...updated[index], title: newTitle };
    onChange(buildPromptFromSections(updated));
    // Update expanded state to track new title
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(oldTitle)) {
        next.delete(oldTitle);
        next.add(newTitle);
      }
      return next;
    });
    setEditingTitle(null);
  }, [sections, onChange]);

  const addSection = useCallback(() => {
    const newSection: ParsedSection = { title: "New Section", content: "" };
    const updated = [...sections, newSection];
    onChange(buildPromptFromSections(updated));
    setExpandedSections(prev => new Set(prev).add("New Section"));
    setEditingTitle("New Section");
  }, [sections, onChange]);

  const deleteSection = useCallback((index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    onChange(buildPromptFromSections(updated));
  }, [sections, onChange]);

  const moveSection = useCallback((index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const updated = [...sections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(buildPromptFromSections(updated));
  }, [sections, onChange]);

  if (sections.length === 0) {
    return (
      <div style={{
        padding: "20px",
        border: "1px dashed #cbd5e1",
        borderRadius: "8px",
        textAlign: "center",
        color: "#64748b",
      }}>
        <p style={{ margin: "0 0 12px 0" }}>No sections yet. Add your first section to get started.</p>
        <button
          onClick={addSection}
          disabled={disabled}
          style={{
            padding: "8px 16px",
            backgroundColor: "#0ea5e9",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          + Add Section
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "12px",
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={expandAll}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "4px",
              cursor: "pointer",
              color: "#475569",
            }}
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "4px",
              cursor: "pointer",
              color: "#475569",
            }}
          >
            Collapse All
          </button>
        </div>
        <button
          onClick={addSection}
          disabled={disabled}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            backgroundColor: "#0ea5e9",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          + Add Section
        </button>
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {sections.map((section, idx) => {
          const isExpanded = expandedSections.has(section.title);
          const isEditingThisTitle = editingTitle === section.title;

          return (
            <div
              key={`${section.title}-${idx}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              {/* Section Header */}
              <div
                onClick={() => !isEditingThisTitle && toggleSection(section.title)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  backgroundColor: "#f8fafc",
                  cursor: isEditingThisTitle ? "default" : "pointer",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                  {isEditingThisTitle ? (
                    <input
                      type="text"
                      defaultValue={section.title}
                      autoFocus
                      onBlur={(e) => updateSectionTitle(idx, e.target.value || section.title)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateSectionTitle(idx, e.currentTarget.value || section.title);
                        } else if (e.key === "Escape") {
                          setEditingTitle(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: "4px 8px",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "1px solid #0ea5e9",
                        borderRadius: "4px",
                        outline: "none",
                        width: "200px",
                      }}
                    />
                  ) : (
                    <span
                      style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) setEditingTitle(section.title);
                      }}
                      title="Double-click to rename"
                    >
                      {section.title}
                    </span>
                  )}
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    ({section.content.split("\n").length} lines)
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {/* Move buttons */}
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSection(idx, "up"); }}
                    disabled={idx === 0 || disabled}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      backgroundColor: "transparent",
                      border: "1px solid #e2e8f0",
                      borderRadius: "3px",
                      cursor: idx === 0 || disabled ? "not-allowed" : "pointer",
                      opacity: idx === 0 ? 0.4 : 1,
                    }}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSection(idx, "down"); }}
                    disabled={idx === sections.length - 1 || disabled}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      backgroundColor: "transparent",
                      border: "1px solid #e2e8f0",
                      borderRadius: "3px",
                      cursor: idx === sections.length - 1 || disabled ? "not-allowed" : "pointer",
                      opacity: idx === sections.length - 1 ? 0.4 : 1,
                    }}
                    title="Move down"
                  >
                    ↓
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${section.title}" section?`)) {
                        deleteSection(idx);
                      }
                    }}
                    disabled={disabled}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      backgroundColor: "transparent",
                      border: "1px solid #fecaca",
                      borderRadius: "3px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      color: "#dc2626",
                    }}
                    title="Delete section"
                  >
                    ×
                  </button>
                  {/* Expand indicator */}
                  <span style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginLeft: "8px",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Section Content */}
              {isExpanded && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8f0" }}>
                  <textarea
                    value={section.content}
                    onChange={(e) => updateSection(idx, e.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    style={{
                      width: "100%",
                      minHeight: "120px",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      lineHeight: 1.5,
                      resize: "vertical",
                      backgroundColor: disabled ? "#f1f5f9" : "#fff",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
