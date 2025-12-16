"use client";

import { type WorkflowStep } from "@/stores/bulk-import-store";

type ProcessingIndicatorProps = {
  workflowStep: WorkflowStep;
};

export default function ProcessingIndicator({ workflowStep }: ProcessingIndicatorProps) {
  if (!["analyzing", "generating", "saving"].includes(workflowStep)) {
    return null;
  }

  return (
    <>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#1e293b", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 -4px 12px rgba(0,0,0,0.15)", zIndex: 1000 }}>
        <div style={{ width: "20px", height: "20px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>
            {workflowStep === "analyzing" ? "Analyzing sources..." : workflowStep === "generating" ? "Generating content..." : "Saving skills..."}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
