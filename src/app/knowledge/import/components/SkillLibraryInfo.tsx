"use client";

import { Skill } from "@/types/skill";
import { styles } from "./types";

type SkillLibraryInfoProps = {
  skills: Skill[];
};

export default function SkillLibraryInfo({ skills }: SkillLibraryInfoProps) {
  return (
    <div
      style={{
        ...styles.card,
        backgroundColor: "#f8fafc",
        borderColor: "#e2e8f0",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Current Skill Library</h3>
      <p style={{ color: "#64748b", marginBottom: "12px" }}>
        You have <strong>{skills.length}</strong> skills in your library.
        RFP content will be matched against these to suggest updates.
      </p>
      {skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {skills.slice(0, 10).map((skill) => (
            <span
              key={skill.id}
              style={{
                padding: "4px 10px",
                backgroundColor: skill.isActive ? "#dbeafe" : "#f1f5f9",
                color: skill.isActive ? "#1e40af" : "#94a3b8",
                borderRadius: "4px",
                fontSize: "13px",
              }}
            >
              {skill.title}
            </span>
          ))}
          {skills.length > 10 && (
            <span style={{ color: "#94a3b8", fontSize: "13px", padding: "4px" }}>
              +{skills.length - 10} more
            </span>
          )}
        </div>
      )}
      {skills.length === 0 && (
        <p style={{ color: "#94a3b8", margin: 0 }}>
          No skills yet.{" "}
          <a href="/knowledge" style={{ color: "#2563eb" }}>
            Create some skills first
          </a>{" "}
          to get the most out of RFP import.
        </p>
      )}
    </div>
  );
}
