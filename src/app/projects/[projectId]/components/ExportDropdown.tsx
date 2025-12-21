"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { BulkProject } from "@/types/bulkProject";
import {
  exportProjectToExcel,
  exportCompletedOnly,
  exportHighConfidenceOnly,
  exportLowConfidenceOnly,
} from "@/lib/excelExport";

const styles = {
  button: {
    padding: "10px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};

type ExportOption = {
  label: string;
  description: string;
  action: (project: BulkProject) => void | Promise<void>;
  dividerBefore?: boolean;
};

// Export feedback for AI improvement
const exportFeedback = async (project: BulkProject) => {
  try {
    const response = await fetch(`/api/projects/${project.id}/feedback`);
    if (!response.ok) throw new Error("Failed to export feedback");
    const json = await response.json();
    const data = json.data;

    // Download as JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "project"}-feedback.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show summary
    const { stats } = data;
    if (stats.editedResponses > 0) {
      toast.success(`Exported feedback: ${stats.editedResponses} edited responses`);
    } else {
      toast.info("No feedback to export - no corrections made to this project");
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to export feedback");
  }
};

const exportOptions: ExportOption[] = [
  {
    label: "Full Export",
    description: "All questions with summary",
    action: exportProjectToExcel,
  },
  {
    label: "Completed Only",
    description: "Questions with responses",
    action: exportCompletedOnly,
  },
  {
    label: "High Confidence",
    description: "High confidence responses only",
    action: exportHighConfidenceOnly,
  },
  {
    label: "Needs Review",
    description: "Low confidence for manual review",
    action: exportLowConfidenceOnly,
  },
  {
    label: "Export Feedback",
    description: "Corrections for AI improvement",
    action: exportFeedback,
    dividerBefore: true,
  },
];

type ExportDropdownProps = {
  project: BulkProject;
};

export default function ExportDropdown({ project }: ExportDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        style={{
          ...styles.button,
          backgroundColor: "#10b981",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        Export to Excel
        <span style={{ fontSize: "10px" }}>&#x25BC;</span>
      </button>
      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
            minWidth: "200px",
          }}
        >
          {exportOptions.map((option, index) => (
            <div key={option.label}>
              {option.dividerBefore && (
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "4px 0" }} />
              )}
              <button
                type="button"
                onClick={() => {
                  option.action(project);
                  setShowMenu(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  borderBottom: index < exportOptions.length - 1 && !exportOptions[index + 1]?.dividerBefore ? "1px solid #f1f5f9" : "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <strong>{option.label}</strong>
                <div style={{ fontSize: "12px", color: "#64748b" }}>{option.description}</div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
