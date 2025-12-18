"use client";

import { useState } from "react";
import { Sparkles, Check, AlertTriangle, ArrowRight, ArrowLeft, Copy, FileText, ClipboardPaste, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Parse placeholders from format: FieldName[Description]
function parsePlaceholderList(text: string): { key: string; description: string }[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const placeholders: { key: string; description: string }[] = [];

  for (const line of lines) {
    // Match: FieldName[Description] or FieldName [Description]
    const match = line.match(/^([^\[\]]+?)\s*\[([^\]]+)\]$/);
    if (match) {
      placeholders.push({
        key: match[1].trim(),
        description: match[2].trim(),
      });
    } else if (line.trim() && !line.includes("[")) {
      // Plain field name without description
      placeholders.push({
        key: line.trim(),
        description: "",
      });
    }
  }

  return placeholders;
}

// Standard collateral types with their expected placeholders
const COLLATERAL_TYPES = [
  {
    id: "bva",
    name: "Business Value Assessment",
    description: "ROI analysis and value proposition for a customer",
    placeholders: [
      { key: "Customer Name", description: "Company name", required: true },
      { key: "Industry", description: "Customer's industry vertical", required: true },
      { key: "Pain Points", description: "Key business challenges", required: true },
      { key: "Current State", description: "How they operate today", required: false },
      { key: "Future State", description: "Desired outcome with solution", required: false },
      { key: "ROI", description: "Expected return on investment", required: true },
      { key: "Time to Value", description: "Implementation timeline", required: false },
      { key: "Key Benefits", description: "Top 3-5 value drivers", required: true },
      { key: "Risk Factors", description: "Potential concerns or blockers", required: false },
      { key: "Next Steps", description: "Recommended action items", required: false },
    ],
  },
  {
    id: "battlecard",
    name: "Competitive Battlecard",
    description: "Comparison against a specific competitor",
    placeholders: [
      { key: "Customer Name", description: "Target customer", required: true },
      { key: "Competitor Name", description: "Competitor being compared", required: true },
      { key: "Our Strengths", description: "Where we win", required: true },
      { key: "Their Weaknesses", description: "Competitor gaps", required: true },
      { key: "Objection Handling", description: "Common objections and responses", required: true },
      { key: "Proof Points", description: "Customer references or data", required: false },
      { key: "Pricing Comparison", description: "TCO or pricing notes", required: false },
      { key: "Talk Track", description: "Key messaging points", required: false },
    ],
  },
  {
    id: "one-pager",
    name: "Executive One-Pager",
    description: "High-level summary for executives",
    placeholders: [
      { key: "Customer Name", description: "Company name", required: true },
      { key: "Executive Summary", description: "2-3 sentence overview", required: true },
      { key: "Business Challenge", description: "The problem being solved", required: true },
      { key: "Proposed Solution", description: "How we address it", required: true },
      { key: "Expected Outcomes", description: "Measurable results", required: true },
      { key: "Investment", description: "Pricing or engagement scope", required: false },
      { key: "Timeline", description: "Key milestones", required: false },
    ],
  },
  {
    id: "qbr",
    name: "QBR Deck",
    description: "Quarterly business review presentation",
    placeholders: [
      { key: "Customer Name", description: "Company name", required: true },
      { key: "Quarter", description: "Q1, Q2, etc.", required: true },
      { key: "Highlights", description: "Key wins this quarter", required: true },
      { key: "Metrics", description: "Usage and adoption stats", required: true },
      { key: "Value Delivered", description: "ROI or outcomes achieved", required: true },
      { key: "Challenges", description: "Issues encountered", required: false },
      { key: "Roadmap", description: "Upcoming features or plans", required: false },
      { key: "Next Quarter Goals", description: "Objectives for next period", required: true },
      { key: "Action Items", description: "Follow-up tasks", required: false },
    ],
  },
  {
    id: "custom",
    name: "Custom Template",
    description: "Start from scratch with your own placeholders",
    placeholders: [],
  },
];

type TemplateBuilderProps = {
  onComplete: (template: {
    name: string;
    description: string;
    content: string;
    category: string;
    placeholders: string[];
  }) => void;
  onCancel: () => void;
};

export function TemplateBuilder({ onComplete, onCancel }: TemplateBuilderProps) {
  const [step, setStep] = useState<"type" | "customize" | "preview">("type");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [selectedPlaceholders, setSelectedPlaceholders] = useState<Set<string>>(new Set());
  const [customPlaceholders, setCustomPlaceholders] = useState<{ key: string; description: string }[]>([]);
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const collateralType = COLLATERAL_TYPES.find((t) => t.id === selectedType);

  // Generate template content from selected placeholders
  const generateTemplateContent = () => {
    const allPlaceholders = [
      ...(collateralType?.placeholders.filter((p) => selectedPlaceholders.has(p.key)).map((p) => p.key) || []),
      ...customPlaceholders.map((p) => p.key),
    ];

    const lines = [`# ${customName || collateralType?.name || "Template"}`, ""];

    for (const placeholder of allPlaceholders) {
      lines.push(`## ${placeholder}`);
      lines.push(`{{${placeholder}}}`);
      lines.push("");
    }

    return lines.join("\n");
  };

  // Validate template for collateral builder compatibility
  const validateTemplate = (content: string) => {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const found: string[] = [];
    let match;
    while ((match = placeholderRegex.exec(content)) !== null) {
      found.push(match[1].trim());
    }

    const issues: string[] = [];

    // Check for common issues
    if (found.length === 0) {
      issues.push("No placeholders found. Add {{Placeholder Name}} to your template.");
    }

    // Check for customer name (usually needed)
    const hasCustomerField = found.some(
      (p) => p.toLowerCase().includes("customer") || p.toLowerCase().includes("company")
    );
    if (!hasCustomerField) {
      issues.push("Consider adding a customer/company name placeholder.");
    }

    return { placeholders: found, issues, isValid: issues.length === 0 || found.length > 0 };
  };

  const handleSelectType = (typeId: string) => {
    setSelectedType(typeId);
    const type = COLLATERAL_TYPES.find((t) => t.id === typeId);
    if (type) {
      setCustomName(type.name);
      setCustomDescription(type.description);
      // Pre-select required placeholders
      setSelectedPlaceholders(new Set(type.placeholders.filter((p) => p.required).map((p) => p.key)));
    }
    setStep("customize");
  };

  const handleAddCustomPlaceholder = () => {
    if (newPlaceholder.trim() && !customPlaceholders.some((p) => p.key === newPlaceholder.trim())) {
      setCustomPlaceholders([...customPlaceholders, { key: newPlaceholder.trim(), description: "" }]);
      setNewPlaceholder("");
    }
  };

  const handleRemoveCustomPlaceholder = (key: string) => {
    setCustomPlaceholders(customPlaceholders.filter((p) => p.key !== key));
  };

  const handlePastePlaceholders = () => {
    const parsed = parsePlaceholderList(pasteText);
    if (parsed.length === 0) {
      toast.error("No placeholders found. Use format: FieldName[Description]");
      return;
    }

    // Merge with existing, avoiding duplicates
    const existingKeys = new Set(customPlaceholders.map((p) => p.key));
    const newPlaceholders = parsed.filter((p) => !existingKeys.has(p.key));

    setCustomPlaceholders([...customPlaceholders, ...newPlaceholders]);
    setPasteText("");
    setShowPasteModal(false);
    toast.success(`Added ${newPlaceholders.length} placeholders`);
  };

  const handleComplete = () => {
    const content = generateTemplateContent();
    const validation = validateTemplate(content);

    onComplete({
      name: customName || collateralType?.name || "New Template",
      description: customDescription || collateralType?.description || "",
      content,
      category: collateralType?.id === "custom" ? "other" : collateralType?.id || "other",
      placeholders: validation.placeholders,
    });
  };

  // Step 1: Select collateral type
  if (step === "type") {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Build Template</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Choose a collateral type to get started
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {COLLATERAL_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleSelectType(type.id)}
              style={{
                padding: "16px",
                backgroundColor: selectedType === type.id ? "#eff6ff" : "#fff",
                border: `2px solid ${selectedType === type.id ? "#3b82f6" : "#e2e8f0"}`,
                borderRadius: "10px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>
                {type.name}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>{type.description}</div>
              {type.placeholders.length > 0 && (
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {type.placeholders.length} suggested fields
                </div>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Customize placeholders
  if (step === "customize") {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={() => setStep("type")}
            style={{
              padding: "6px",
              backgroundColor: "#f1f5f9",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Customize Fields</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Select which fields the collateral builder should fill
            </p>
          </div>
        </div>

        {/* Template name and description */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500 }}>
              Template Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g., Q1 BVA Deck"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500 }}>
              Description
            </label>
            <input
              type="text"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Brief description..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            />
          </div>
        </div>

        {/* Suggested placeholders */}
        {collateralType && collateralType.placeholders.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
              Suggested Fields
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {collateralType.placeholders.map((placeholder) => (
                <button
                  key={placeholder.key}
                  onClick={() => {
                    const newSet = new Set(selectedPlaceholders);
                    if (newSet.has(placeholder.key)) {
                      newSet.delete(placeholder.key);
                    } else {
                      newSet.add(placeholder.key);
                    }
                    setSelectedPlaceholders(newSet);
                  }}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: selectedPlaceholders.has(placeholder.key) ? "#dbeafe" : "#f8fafc",
                    border: `1px solid ${selectedPlaceholders.has(placeholder.key) ? "#3b82f6" : "#e2e8f0"}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                  }}
                  title={placeholder.description}
                >
                  {selectedPlaceholders.has(placeholder.key) && <Check size={14} color="#3b82f6" />}
                  {placeholder.key}
                  {placeholder.required && <span style={{ color: "#ef4444" }}>*</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom placeholders */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500 }}>
              Custom Fields
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasteModal(true)}
              style={{ fontSize: "12px", padding: "4px 10px" }}
            >
              <ClipboardPaste size={14} style={{ marginRight: "4px" }} />
              Paste List
            </Button>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={newPlaceholder}
              onChange={(e) => setNewPlaceholder(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomPlaceholder()}
              placeholder="Add custom field name..."
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            />
            <Button onClick={handleAddCustomPlaceholder} disabled={!newPlaceholder.trim()}>
              Add
            </Button>
          </div>
          {customPlaceholders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
              {customPlaceholders.map((p) => (
                <div
                  key={p.key}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{p.key}</span>
                    {p.description && (
                      <span style={{ color: "#64748b", marginLeft: "8px" }}>— {p.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveCustomPlaceholder(p.key)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#64748b",
                      padding: "2px",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paste Modal */}
        {showPasteModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
            onClick={() => setShowPasteModal(false)}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                padding: "24px",
                width: "90%",
                maxWidth: "500px",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Paste Placeholder List</h3>
                <button
                  onClick={() => setShowPasteModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px 0" }}>
                Paste your placeholder list using this format:
              </p>
              <pre style={{
                fontSize: "12px",
                backgroundColor: "#f8fafc",
                padding: "8px 12px",
                borderRadius: "6px",
                marginBottom: "12px",
                color: "#475569",
              }}>
{`Customer[Company name]
Goal 1[Primary initiative]
Summary[Overview in 50 words]`}
              </pre>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your placeholder list here..."
                style={{
                  width: "100%",
                  height: "200px",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <Button variant="outline" onClick={() => setShowPasteModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePastePlaceholders} disabled={!pasteText.trim()}>
                  Import Placeholders
                </Button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => setStep("preview")}
            disabled={selectedPlaceholders.size === 0 && customPlaceholders.length === 0}
          >
            Preview Template
            <ArrowRight size={16} style={{ marginLeft: "6px" }} />
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Preview and validation
  const content = generateTemplateContent();
  const validation = validateTemplate(content);

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button
          onClick={() => setStep("customize")}
          style={{
            padding: "6px",
            backgroundColor: "#f1f5f9",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Preview Template</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Review your template before saving
          </p>
        </div>
      </div>

      {/* Validation */}
      <div
        style={{
          padding: "12px 16px",
          backgroundColor: validation.isValid ? "#f0fdf4" : "#fef3c7",
          border: `1px solid ${validation.isValid ? "#86efac" : "#fde68a"}`,
          borderRadius: "8px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        {validation.isValid ? (
          <Check size={18} color="#16a34a" style={{ marginTop: "2px" }} />
        ) : (
          <AlertTriangle size={18} color="#d97706" style={{ marginTop: "2px" }} />
        )}
        <div>
          <div style={{ fontWeight: 500, fontSize: "13px", color: validation.isValid ? "#166534" : "#92400e" }}>
            {validation.isValid ? "Template is ready!" : "Review these suggestions"}
          </div>
          {validation.issues.length > 0 && (
            <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", fontSize: "12px", color: "#92400e" }}>
              {validation.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          )}
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            {validation.placeholders.length} placeholder{validation.placeholders.length !== 1 ? "s" : ""} detected
          </div>
        </div>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: 500 }}>Template Content</label>
          <button
            onClick={() => {
              navigator.clipboard.writeText(content);
              toast.success("Copied to clipboard");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              backgroundColor: "#f1f5f9",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
        <pre
          style={{
            padding: "16px",
            backgroundColor: "#1e293b",
            color: "#e2e8f0",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: "monospace",
            overflow: "auto",
            maxHeight: "250px",
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </pre>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleComplete}>
          <FileText size={16} style={{ marginRight: "6px" }} />
          Create Template
        </Button>
      </div>
    </div>
  );
}
