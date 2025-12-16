"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { type SkillGroup } from "@/stores/bulk-import-store";
import { styles, getGroupStatusStyle } from "./styles";

type GeneratingStepProps = {
  skillGroups: SkillGroup[];
};

export default function GeneratingStep({ skillGroups }: GeneratingStepProps) {
  return (
    <div style={styles.card}>
      <LoadingSpinner
        title="Generating content..."
        subtitle="Creating skill content from sources"
      />
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {skillGroups.filter(g => g.status !== "rejected" && g.status !== "pending").map(group => (
          <div key={group.id} style={{ padding: "10px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", ...getGroupStatusStyle(group.status), border: `1px solid ${getGroupStatusStyle(group.status).borderColor}` }}>
            <span style={{ fontWeight: 500 }}>{group.skillTitle}</span>
            <span style={{ fontSize: "13px", color: group.status === "generating" ? "#2563eb" : group.status === "ready_for_review" ? "#15803d" : group.status === "approved" ? "#64748b" : "#dc2626" }}>
              {group.status === "generating" ? "Generating..." : group.status === "ready_for_review" ? "Ready" : group.status === "approved" ? "Queued" : "Error"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
