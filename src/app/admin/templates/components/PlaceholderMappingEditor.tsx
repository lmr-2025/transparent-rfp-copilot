"use client";

import { useState, useEffect } from "react";
import { Settings2, Plus, Trash2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import type {
  PlaceholderMapping,
  PlaceholderSource,
} from "@/types/template";
import {
  CUSTOMER_FIELDS,
  SKILL_FIELDS,
  GTM_FIELDS,
  DATE_FIELDS,
} from "@/types/template";

// Simple regex to find {{placeholder}} patterns (any format)
const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

type Props = {
  content: string;
  mappings: PlaceholderMapping[];
  onChange: (mappings: PlaceholderMapping[]) => void;
};

const SOURCE_OPTIONS: { value: PlaceholderSource; label: string; color: string }[] = [
  { value: "customer", label: "Customer", color: "#e0f2fe" },
  { value: "skill", label: "Skill", color: "#dcfce7" },
  { value: "gtm", label: "GTM Data", color: "#fef3c7" },
  { value: "date", label: "Date", color: "#f3e8ff" },
  { value: "llm", label: "AI Generated", color: "#fee2e2" },
  { value: "custom", label: "User Input", color: "#f1f5f9" },
];

export function PlaceholderMappingEditor({ content, mappings, onChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([]);

  // Detect placeholders from content
  useEffect(() => {
    const found = new Set<string>();
    let match;
    while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
      found.add(match[1].trim());
    }
    PLACEHOLDER_REGEX.lastIndex = 0;
    setDetectedPlaceholders(Array.from(found));
  }, [content]);

  // Get unmapped placeholders
  const mappedPlaceholders = new Set(mappings.map((m) => m.placeholder));
  const unmappedPlaceholders = detectedPlaceholders.filter(
    (p) => !mappedPlaceholders.has(p)
  );

  // Add a new mapping
  const addMapping = (placeholder: string) => {
    // Try to auto-detect the source from the placeholder name
    const lowerPlaceholder = placeholder.toLowerCase();
    let source: PlaceholderSource = "custom";
    let field: string | undefined;

    // Check for customer fields
    if (lowerPlaceholder.includes("customer") || lowerPlaceholder.includes("company")) {
      source = "customer";
      if (lowerPlaceholder.includes("name")) field = "name";
      else if (lowerPlaceholder.includes("industry")) field = "industry";
      else if (lowerPlaceholder.includes("region")) field = "region";
      else if (lowerPlaceholder.includes("tier")) field = "tier";
    }
    // Check for date
    else if (lowerPlaceholder.includes("date") || lowerPlaceholder.includes("today")) {
      source = "date";
      field = "today";
    }
    // Check for skill
    else if (lowerPlaceholder.includes("skill")) {
      source = "skill";
      field = "all";
    }
    // Check for LLM patterns
    else if (lowerPlaceholder.startsWith("llm:") || lowerPlaceholder.includes("generate") || lowerPlaceholder.includes("summarize")) {
      source = "llm";
    }

    const newMapping: PlaceholderMapping = {
      placeholder,
      source,
      field,
      required: false,
    };

    onChange([...mappings, newMapping]);
  };

  // Update a mapping
  const updateMapping = (index: number, updates: Partial<PlaceholderMapping>) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  // Remove a mapping
  const removeMapping = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index));
  };

  // Get field options for a source
  const getFieldOptions = (source: PlaceholderSource) => {
    switch (source) {
      case "customer":
        return CUSTOMER_FIELDS;
      case "skill":
        return SKILL_FIELDS;
      case "gtm":
        return GTM_FIELDS;
      case "date":
        return DATE_FIELDS;
      default:
        return [];
    }
  };

  if (detectedPlaceholders.length === 0) {
    return (
      <div
        style={{
          padding: "12px",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
          color: "#64748b",
          fontSize: "0.85rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings2 size={16} />
          <span>No placeholders detected. Use {"{{placeholder}}"} syntax in your template.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          backgroundColor: "#f8fafc",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings2 size={18} style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 600, color: "#1e293b" }}>
            Placeholder Mappings
          </span>
          <span
            style={{
              padding: "2px 8px",
              backgroundColor: mappings.length > 0 ? "#dcfce7" : "#fef3c7",
              color: mappings.length > 0 ? "#166534" : "#92400e",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            {mappings.length}/{detectedPlaceholders.length} mapped
          </span>
        </div>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isExpanded && (
        <div style={{ padding: "16px" }}>
          {/* Unmapped placeholders warning */}
          {unmappedPlaceholders.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "12px",
                backgroundColor: "#fef3c7",
                borderRadius: "6px",
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={16} style={{ color: "#92400e", marginTop: "2px" }} />
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", fontWeight: 500 }}>
                  {unmappedPlaceholders.length} unmapped placeholder{unmappedPlaceholders.length > 1 ? "s" : ""}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {unmappedPlaceholders.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => addMapping(p)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        backgroundColor: "#fff",
                        border: "1px solid #fbbf24",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={12} />
                      {`{{${p}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mapped placeholders */}
          {mappings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {mappings.map((mapping, index) => (
                <MappingRow
                  key={mapping.placeholder}
                  mapping={mapping}
                  onUpdate={(updates) => updateMapping(index, updates)}
                  onRemove={() => removeMapping(index)}
                  fieldOptions={getFieldOptions(mapping.source)}
                />
              ))}
            </div>
          )}

          {/* Add all button */}
          {unmappedPlaceholders.length > 1 && (
            <button
              type="button"
              onClick={() => unmappedPlaceholders.forEach(addMapping)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "12px",
                padding: "8px 12px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "#475569",
              }}
            >
              <Plus size={14} />
              Add all unmapped placeholders
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Individual mapping row component
function MappingRow({
  mapping,
  onUpdate,
  onRemove,
  fieldOptions,
}: {
  mapping: PlaceholderMapping;
  onUpdate: (updates: Partial<PlaceholderMapping>) => void;
  onRemove: () => void;
  fieldOptions: readonly { value: string; label: string }[];
}) {
  const sourceOption = SOURCE_OPTIONS.find((s) => s.value === mapping.source);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "12px",
        padding: "12px",
        backgroundColor: "#f8fafc",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Placeholder name */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              padding: "4px 8px",
              backgroundColor: sourceOption?.color || "#f1f5f9",
              borderRadius: "4px",
              fontSize: "0.8rem",
              fontFamily: "monospace",
              fontWeight: 500,
            }}
          >
            {`{{${mapping.placeholder}}}`}
          </span>
        </div>

        {/* Source and field selectors */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Source select */}
          <select
            value={mapping.source}
            onChange={(e) =>
              onUpdate({
                source: e.target.value as PlaceholderSource,
                field: undefined,
                llmInstruction: undefined,
              })
            }
            style={{
              padding: "6px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              fontSize: "0.85rem",
              backgroundColor: "#fff",
              minWidth: "120px",
            }}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Field select (for sources with predefined fields) */}
          {fieldOptions.length > 0 && mapping.source !== "llm" && (
            <select
              value={mapping.field || ""}
              onChange={(e) => onUpdate({ field: e.target.value || undefined })}
              style={{
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "0.85rem",
                backgroundColor: "#fff",
                minWidth: "150px",
              }}
            >
              <option value="">Select field...</option>
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Skill title input (for skill source with byTitle) */}
          {mapping.source === "skill" && mapping.field === "byTitle" && (
            <input
              type="text"
              value={mapping.skillTitle || ""}
              onChange={(e) => onUpdate({ skillTitle: e.target.value })}
              placeholder="Skill title..."
              style={{
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "0.85rem",
                minWidth: "150px",
              }}
            />
          )}

          {/* LLM instruction input */}
          {mapping.source === "llm" && (
            <input
              type="text"
              value={mapping.llmInstruction || ""}
              onChange={(e) => onUpdate({ llmInstruction: e.target.value })}
              placeholder="Describe what to generate..."
              style={{
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "0.85rem",
                flex: 1,
                minWidth: "200px",
              }}
            />
          )}

          {/* Custom label for user input */}
          {mapping.source === "custom" && (
            <input
              type="text"
              value={mapping.fallback || ""}
              onChange={(e) => onUpdate({ fallback: e.target.value })}
              placeholder="Default value (optional)..."
              style={{
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "0.85rem",
                minWidth: "150px",
              }}
            />
          )}
        </div>

        {/* Required checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            color: "#64748b",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={mapping.required || false}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            style={{ width: "14px", height: "14px" }}
          />
          Required before generating
        </label>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        style={{
          padding: "6px",
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#94a3b8",
          alignSelf: "flex-start",
        }}
        title="Remove mapping"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
