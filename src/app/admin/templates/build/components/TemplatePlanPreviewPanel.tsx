"use client";

import { FileText, Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TemplatePlanItem = {
  key: string;
  description: string;
};

export type TemplatePlan = {
  name: string;
  description: string;
  category: string;
  placeholders: TemplatePlanItem[];
};

type TemplatePlanPreviewPanelProps = {
  plan: TemplatePlan | null;
  onAccept: () => void;
  onSkip: () => void;
};

export default function TemplatePlanPreviewPanel({
  plan,
  onAccept,
  onSkip,
}: TemplatePlanPreviewPanelProps) {
  const hasValidPlan = plan && plan.placeholders.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
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
            Template Preview
          </h3>
          {hasValidPlan && (
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "#dcfce7",
                color: "#166534",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 500,
              }}
            >
              Ready
            </span>
          )}
        </div>
        {hasValidPlan && (
          <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
            {plan.placeholders.length} placeholder{plan.placeholders.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {hasValidPlan ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Template Info */}
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>
                {plan.name}
              </div>
              {plan.description && (
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
                  {plan.description}
                </div>
              )}
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  backgroundColor: "#dbeafe",
                  color: "#1e40af",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}
              >
                {plan.category}
              </div>
            </div>

            {/* Placeholders */}
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Placeholders
              </span>
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {plan.placeholders.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 10px",
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#1e293b" }}>
                      {p.key}
                    </div>
                    {p.description && (
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
            <FileText size={40} style={{ opacity: 0.3, marginBottom: "16px" }} />
            <p style={{ fontSize: "14px", margin: "0 0 8px 0", color: "#475569" }}>
              No template yet
            </p>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Paste a placeholder list or describe your template to get started
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
          onClick={onAccept}
          disabled={!hasValidPlan}
          className="w-full"
          style={{
            backgroundColor: hasValidPlan ? "#6366f1" : "#e2e8f0",
            color: hasValidPlan ? "#fff" : "#94a3b8",
          }}
        >
          <Check className="h-4 w-4 mr-2" />
          Create Template
        </Button>
        <Button variant="outline" onClick={onSkip} className="w-full">
          <SkipForward className="h-4 w-4 mr-2" />
          Skip & Create Manually
        </Button>
      </div>
    </div>
  );
}
