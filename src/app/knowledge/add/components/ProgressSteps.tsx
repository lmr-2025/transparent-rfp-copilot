"use client";

import { Check } from "lucide-react";
import { type WorkflowStep } from "@/stores/bulk-import-store";

type ProgressStepsProps = {
  workflowStep: WorkflowStep;
};

const STEPS = ["Add Sources", "Group Sources", "Generate Content", "Review & Approve", "Done"];
const STEP_MAP: Record<WorkflowStep, number> = {
  input: 0,
  analyzing: 1,
  review_groups: 1,
  generating: 2,
  review_drafts: 3,
  saving: 3,
  done: 4,
};

export default function ProgressSteps({ workflowStep }: ProgressStepsProps) {
  const currentIdx = STEP_MAP[workflowStep];

  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "24px", alignItems: "center" }}>
      {STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isComplete = idx < currentIdx;

        return (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: isComplete ? "#22c55e" : isActive ? "#2563eb" : "#e2e8f0",
              color: isComplete || isActive ? "#fff" : "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 600,
            }}>
              {isComplete ? <Check size={14} /> : idx + 1}
            </div>
            <span style={{ fontSize: "13px", color: isActive ? "#2563eb" : "#64748b", fontWeight: isActive ? 600 : 400 }}>
              {step}
            </span>
            {idx < 4 && <div style={{ width: "24px", height: "2px", backgroundColor: isComplete ? "#22c55e" : "#e2e8f0" }} />}
          </div>
        );
      })}
    </div>
  );
}
