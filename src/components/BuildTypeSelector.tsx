"use client";

import { FileText, FileCode } from "lucide-react";

export type BuildType = "skill" | "snippet";

interface BuildTypeSelectorProps {
  value: BuildType;
  onChange: (type: BuildType) => void;
  disabled?: boolean;
}

const styles = {
  container: {
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
  },
  option: {
    flex: 1,
    padding: "16px",
    borderRadius: "8px",
    border: "2px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.15s ease",
    backgroundColor: "#fff",
  },
  optionSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  optionDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  optionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
  },
  optionTitle: {
    fontWeight: 600,
    fontSize: "15px",
    color: "#1e293b",
  },
  optionDescription: {
    fontSize: "13px",
    color: "#64748b",
    lineHeight: 1.4,
  },
  iconSkill: {
    color: "#2563eb",
  },
  iconSnippet: {
    color: "#059669",
  },
};

export default function BuildTypeSelector({ value, onChange, disabled }: BuildTypeSelectorProps) {
  const handleClick = (type: BuildType) => {
    if (!disabled) {
      onChange(type);
    }
  };

  return (
    <div style={styles.container}>
      <div
        onClick={() => handleClick("skill")}
        style={{
          ...styles.option,
          ...(value === "skill" ? styles.optionSelected : {}),
          ...(disabled ? styles.optionDisabled : {}),
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleClick("skill")}
      >
        <div style={styles.optionHeader}>
          <FileText size={20} style={styles.iconSkill} />
          <span style={styles.optionTitle}>Knowledge Skill</span>
        </div>
        <p style={styles.optionDescription}>
          Structured knowledge for answering questions. Includes tags, categories, and source tracking.
        </p>
      </div>

      <div
        onClick={() => handleClick("snippet")}
        style={{
          ...styles.option,
          ...(value === "snippet" ? styles.optionSelected : {}),
          ...(disabled ? styles.optionDisabled : {}),
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleClick("snippet")}
      >
        <div style={styles.optionHeader}>
          <FileCode size={20} style={styles.iconSnippet} />
          <span style={styles.optionTitle}>Context Snippet</span>
        </div>
        <p style={styles.optionDescription}>
          Reusable boilerplate text like company descriptions, value props, or certifications. Uses {`{{key}}`} variables.
        </p>
      </div>
    </div>
  );
}
