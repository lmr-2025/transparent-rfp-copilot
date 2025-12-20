"use client";

import { useRouter } from "next/navigation";
import { type SkillGroup } from "@/stores/bulk-import-store";
import { styles, getGroupStatusStyle } from "./styles";

type DoneStepProps = {
  skillGroups: SkillGroup[];
  onReset: () => void;
};

export default function DoneStep({ skillGroups, onReset }: DoneStepProps) {
  const router = useRouter();

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0 }}>Import Complete</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => router.push("/knowledge")} style={{ padding: "10px 20px", backgroundColor: "#fff", color: "#2563eb", border: "1px solid #2563eb", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
            Go to Library
          </button>
          <button onClick={onReset} style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
            Add More
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {skillGroups.map(group => (
          <div key={group.id} style={{ padding: "10px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", ...getGroupStatusStyle(group.status), border: `1px solid ${getGroupStatusStyle(group.status).borderColor}` }}>
            <div>
              <div style={{ fontWeight: 500 }}>{group.draft?.title || group.skillTitle}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>{group.type === "create" ? "Created" : "Updated"}</div>
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500 }}>
              {group.status === "done" && <span style={{ color: "#15803d" }}>✓ Success</span>}
              {group.status === "error" && <span style={{ color: "#dc2626" }}>Failed</span>}
              {group.status === "rejected" && <span style={{ color: "#64748b" }}>Skipped</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
