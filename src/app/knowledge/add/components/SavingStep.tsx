"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { type SkillGroup } from "@/stores/bulk-import-store";
import { styles, getGroupStatusStyle } from "./styles";

type SavingStepProps = {
  skillGroups: SkillGroup[];
};

export default function SavingStep({ skillGroups }: SavingStepProps) {
  return (
    <div style={styles.card}>
      <LoadingSpinner title="Saving skills..." subtitle="Writing to database" />
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {skillGroups.filter(g => g.status === "reviewed" || g.status === "saving" || g.status === "done" || g.status === "error").map(group => (
          <div key={group.id} style={{ padding: "10px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", ...getGroupStatusStyle(group.status), border: `1px solid ${getGroupStatusStyle(group.status).borderColor}` }}>
            <span style={{ fontWeight: 500 }}>{group.draft?.title || group.skillTitle}</span>
            <span style={{ fontSize: "13px" }}>
              {group.status === "saving" && <span style={{ color: "#2563eb" }}>Saving...</span>}
              {group.status === "done" && <span style={{ color: "#15803d" }}>✓ Saved</span>}
              {group.status === "error" && <span style={{ color: "#dc2626" }}>Failed</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
