"use client";

import { Presentation, Table2, Edit3, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type SlideData = Record<string, string>;

type SlideDataPreviewPanelProps = {
  data: SlideData | null;
  onFillSlides: () => void;
  onClear: () => void;
  onUpdateField?: (key: string, value: string) => void;
};

export function SlideDataPreviewPanel({
  data,
  onFillSlides,
  onClear,
  onUpdateField,
}: SlideDataPreviewPanelProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const hasData = data && Object.keys(data).length > 0;
  const fieldCount = data ? Object.keys(data).length : 0;

  const startEditing = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (editingKey && onUpdateField) {
      onUpdateField(editingKey, editValue);
    }
    setEditingKey(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#fafafa",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
            Slide Data
          </h3>
          {hasData && (
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "#dbeafe",
                color: "#1d4ed8",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 500,
              }}
            >
              {fieldCount} field{fieldCount !== 1 ? "s" : ""} ready
            </span>
          )}
        </div>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
          AI-extracted values for your presentation
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {hasData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Object.entries(data).map(([key, value]) => (
              <div
                key={key}
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                {/* Field label */}
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "4px",
                  }}
                >
                  {key}
                </div>

                {/* Field value */}
                {editingKey === key ? (
                  <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        border: "1px solid #3b82f6",
                        borderRadius: "4px",
                        fontSize: "13px",
                        resize: "vertical",
                        minHeight: "60px",
                      }}
                      autoFocus
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <button
                        onClick={saveEdit}
                        style={{
                          padding: "4px",
                          backgroundColor: "#10b981",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          color: "#fff",
                        }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          padding: "4px",
                          backgroundColor: "#ef4444",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          color: "#fff",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#1e293b",
                        margin: 0,
                        lineHeight: "1.4",
                        wordBreak: "break-word",
                      }}
                    >
                      {value.length > 150 ? `${value.slice(0, 150)}...` : value}
                    </p>
                    {onUpdateField && (
                      <button
                        onClick={() => startEditing(key, value)}
                        style={{
                          padding: "4px",
                          backgroundColor: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                          flexShrink: 0,
                        }}
                        title="Edit value"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              color: "#64748b",
              padding: "20px",
            }}
          >
            <Table2 size={40} style={{ opacity: 0.3, marginBottom: "16px" }} />
            <p style={{ fontSize: "14px", margin: "0 0 8px 0", color: "#475569" }}>
              No slide data yet
            </p>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Describe what you need and the AI will extract key-value pairs for your slides
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <Button
          onClick={onFillSlides}
          disabled={!hasData}
          className="w-full"
          style={{
            backgroundColor: hasData ? "#2563eb" : "#e2e8f0",
            color: hasData ? "#fff" : "#94a3b8",
          }}
        >
          <Presentation className="h-4 w-4 mr-2" />
          Fill Google Slides
        </Button>
        {hasData && (
          <Button variant="outline" onClick={onClear} className="w-full">
            Clear Data
          </Button>
        )}
      </div>
    </div>
  );
}
