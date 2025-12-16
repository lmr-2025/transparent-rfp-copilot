"use client";

import { Skill } from "@/types/skill";
import { styles } from "./styles";

type SkillLibraryInfoProps = {
  skills: Skill[];
};

export default function SkillLibraryInfo({ skills }: SkillLibraryInfoProps) {
  return (
    <div style={{ ...styles.card, backgroundColor: "#f8fafc" }}>
      <h3 style={{ marginTop: 0 }}>Current Skill Library</h3>
      <p style={{ color: "#64748b", marginBottom: "12px" }}>
        <strong>{skills.length}</strong> existing skill{skills.length !== 1 ? "s" : ""}
      </p>
      {skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {skills.slice(0, 12).map((skill) => (
            <span key={skill.id} style={{ padding: "4px 10px", backgroundColor: "#dbeafe", color: "#1e40af", borderRadius: "4px", fontSize: "13px" }}>{skill.title}</span>
          ))}
          {skills.length > 12 && <span style={{ color: "#94a3b8", fontSize: "13px", padding: "4px" }}>+{skills.length - 12} more</span>}
        </div>
      )}
    </div>
  );
}
