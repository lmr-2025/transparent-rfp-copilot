"use client";

import { FileText, Merge, HelpCircle, Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillPlan, SkillPlanItem } from "@/stores/bulk-import-store";

type PlanPreviewPanelProps = {
  plan: SkillPlan | null;
  sourceCount: number;
  existingSkillCount: number;
  onAccept: () => void;
  onSkip: () => void;
};

export default function PlanPreviewPanel({
  plan,
  sourceCount,
  existingSkillCount,
  onAccept,
  onSkip,
}: PlanPreviewPanelProps) {
  const hasValidPlan = plan && plan.skills.length > 0;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
            Skill Plan
          </h3>
          {hasValidPlan && (
            <span style={{
              fontSize: "11px",
              backgroundColor: "#dcfce7",
              color: "#166534",
              padding: "2px 8px",
              borderRadius: "10px",
              fontWeight: 500,
            }}>
              Ready
            </span>
          )}
        </div>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
          {sourceCount} source{sourceCount !== 1 ? "s" : ""} • {existingSkillCount} existing skill{existingSkillCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 20px",
      }}>
        {hasValidPlan ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>
              Proposed skills:
            </p>
            {plan.skills.map((skill, idx) => (
              <SkillPlanCard key={idx} skill={skill} />
            ))}
          </div>
        ) : (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            textAlign: "center",
            color: "#64748b",
            padding: "20px",
          }}>
            <FileText size={40} style={{ opacity: 0.3, marginBottom: "16px" }} />
            <p style={{ fontSize: "14px", margin: "0 0 8px 0", color: "#475569" }}>
              No plan yet
            </p>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Chat with the AI to discuss how to organize your sources into skills
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}>
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
          Accept Plan
        </Button>
        <Button
          variant="outline"
          onClick={onSkip}
          className="w-full"
        >
          <SkipForward className="h-4 w-4 mr-2" />
          Skip & Auto-Analyze
        </Button>
      </div>
    </div>
  );
}

function SkillPlanCard({ skill }: { skill: SkillPlanItem }) {
  const hasMerge = skill.mergeWith && skill.mergeWith.toLowerCase() !== "none";

  return (
    <div style={{
      backgroundColor: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "10px",
      padding: "14px",
    }}>
      {/* Title */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "10px",
      }}>
        <FileText size={16} style={{ color: "#6366f1" }} />
        <span style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
          {skill.name}
        </span>
      </div>

      {/* Merge indicator */}
      {hasMerge && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "10px",
          padding: "6px 10px",
          backgroundColor: "#fef3c7",
          borderRadius: "6px",
          fontSize: "12px",
          color: "#92400e",
        }}>
          <Merge size={14} />
          Merge with: {skill.mergeWith}
        </div>
      )}

      {/* Scope */}
      <p style={{
        fontSize: "13px",
        color: "#475569",
        margin: "0 0 10px 0",
        lineHeight: "1.4",
      }}>
        {skill.scope}
      </p>

      {/* Sources */}
      <div style={{ marginBottom: "10px" }}>
        <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 500 }}>
          Sources
        </span>
        <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {skill.sources.map((source, idx) => (
            <span
              key={idx}
              style={{
                fontSize: "11px",
                backgroundColor: "#f1f5f9",
                color: "#475569",
                padding: "2px 8px",
                borderRadius: "4px",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={source}
            >
              {source.length > 30 ? source.slice(0, 30) + "..." : source}
            </span>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div>
        <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 500 }}>
          Key Questions
        </span>
        <div style={{ marginTop: "4px" }}>
          {skill.questions.slice(0, 3).map((q, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "12px",
                color: "#475569",
                marginTop: idx > 0 ? "4px" : 0,
              }}
            >
              <HelpCircle size={12} style={{ flexShrink: 0, marginTop: "2px", color: "#94a3b8" }} />
              <span>{q}</span>
            </div>
          ))}
          {skill.questions.length > 3 && (
            <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "block" }}>
              +{skill.questions.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
