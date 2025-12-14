"use client";

import { useState, useMemo } from "react";
import {
  ChatProjectTemplate,
  getAllProjectTemplates,
  projectCategoryConfig,
} from "@/lib/chatProjectTemplates";

type Props = {
  onSelectTemplate: (template: ChatProjectTemplate | null) => void;
  selectedTemplateId: string | null;
};

export default function ChatProjectSelector({
  onSelectTemplate,
  selectedTemplateId,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Load templates only on client side using useMemo
  const templates = useMemo(() => getAllProjectTemplates(), []);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const filteredTemplates = filterCategory
    ? templates.filter((t) => t.category === filterCategory)
    : templates;

  const categories = Object.entries(projectCategoryConfig);

  const handleSelect = (template: ChatProjectTemplate) => {
    onSelectTemplate(template);
    setIsExpanded(false);
  };

  const handleClear = () => {
    onSelectTemplate(null);
    setIsExpanded(false);
  };

  if (!isExpanded && selectedTemplate) {
    // Compact view showing selected template
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "12px",
          padding: "12px 16px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>{selectedTemplate.icon}</span>
            <div>
              <div
                style={{
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                {selectedTemplate.name}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "12px",
                }}
              >
                {projectCategoryConfig[selectedTemplate.category].label}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setIsExpanded(true)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                color: "#fff",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Change
            </button>
            <button
              onClick={handleClear}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "6px",
                padding: "6px 12px",
                color: "#fff",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isExpanded) {
    // Button to open selector
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          width: "100%",
          background: "#f8f9fa",
          border: "2px dashed #dee2e6",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          color: "#6c757d",
          fontSize: "14px",
          transition: "all 0.2s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#667eea";
          e.currentTarget.style.color = "#667eea";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#dee2e6";
          e.currentTarget.style.color = "#6c757d";
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d="M14 9l3 3-3 3" />
        </svg>
        Start a Project (choose a system prompt)
      </button>
    );
  }

  // Expanded selector view
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e9ecef",
        borderRadius: "12px",
        marginBottom: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h3 style={{ color: "#fff", margin: 0, fontSize: "16px", fontWeight: 600 }}>
            Choose a Project Template
          </h3>
          <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: "13px" }}>
            Select a template to set the system prompt and get suggested questions
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "6px",
            padding: "6px 12px",
            color: "#fff",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>

      {/* Category filters */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e9ecef",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setFilterCategory(null)}
          style={{
            background: filterCategory === null ? "#667eea" : "#f8f9fa",
            color: filterCategory === null ? "#fff" : "#495057",
            border: "none",
            borderRadius: "16px",
            padding: "6px 14px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: filterCategory === null ? 600 : 400,
          }}
        >
          All
        </button>
        {categories.map(([catId, config]) => (
          <button
            key={catId}
            onClick={() => setFilterCategory(catId)}
            style={{
              background: filterCategory === catId ? "#667eea" : "#f8f9fa",
              color: filterCategory === catId ? "#fff" : "#495057",
              border: "none",
              borderRadius: "16px",
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: filterCategory === catId ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{config.icon}</span>
            {config.label}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div
        style={{
          maxHeight: "400px",
          overflowY: "auto",
          padding: "8px",
        }}
      >
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleSelect(template)}
            style={{
              width: "100%",
              background: selectedTemplateId === template.id ? "#f0f4ff" : "#fff",
              border:
                selectedTemplateId === template.id
                  ? "2px solid #667eea"
                  : "1px solid #e9ecef",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "8px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              if (selectedTemplateId !== template.id) {
                e.currentTarget.style.borderColor = "#667eea";
                e.currentTarget.style.background = "#fafbff";
              }
            }}
            onMouseOut={(e) => {
              if (selectedTemplateId !== template.id) {
                e.currentTarget.style.borderColor = "#e9ecef";
                e.currentTarget.style.background = "#fff";
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>{template.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "#212529",
                    }}
                  >
                    {template.name}
                  </span>
                  <span
                    style={{
                      background: "#e9ecef",
                      color: "#6c757d",
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    {projectCategoryConfig[template.category].label}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "#6c757d",
                    fontSize: "13px",
                    lineHeight: 1.4,
                  }}
                >
                  {template.description}
                </p>
                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#868e96",
                    fontSize: "12px",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {template.suggestedPrompts.length} suggested questions
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
