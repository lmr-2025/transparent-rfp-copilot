"use client";

import { PreviewRow, SheetData, styles } from "./types";

type PreviewCardProps = {
  previewRows: PreviewRow[];
  sheets: SheetData[];
  activeSheetName?: string;
  mergeAllTabs: boolean;
  onToggleRow: (rowNumber: number, sourceTab: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveProject: () => void;
};

export default function PreviewCard({
  previewRows,
  sheets,
  activeSheetName,
  mergeAllTabs,
  onToggleRow,
  onSelectAll,
  onDeselectAll,
  onSaveProject,
}: PreviewCardProps) {
  if (previewRows.length === 0) return null;

  const selectedCount = previewRows.filter((r) => r.selected).length;

  return (
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            Preview ({selectedCount} of {previewRows.length} selected)
          </h2>
          <p style={{ color: "#475569", marginTop: "4px" }}>
            {mergeAllTabs && sheets.length > 1 ? (
              <>Review and select questions from <strong>{sheets.length} merged tabs</strong>.</>
            ) : (
              <>Review and select questions from <strong>{activeSheetName}</strong>.</>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSelectAll}
            style={{
              ...styles.button,
              backgroundColor: "#f1f5f9",
              color: "#0f172a",
              padding: "6px 12px",
            }}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            style={{
              ...styles.button,
              backgroundColor: "#f1f5f9",
              color: "#0f172a",
              padding: "6px 12px",
            }}
          >
            Deselect All
          </button>
          <button
            type="button"
            onClick={onSaveProject}
            style={{ ...styles.button, backgroundColor: "#0ea5e9", color: "#fff" }}
          >
            Save project &amp; review responses
          </button>
        </div>
      </div>
      <div style={{ marginTop: "12px", maxHeight: "500px", overflowY: "auto" }}>
        {previewRows.map((row) => (
          <div
            key={`${row.sourceTab}-${row.rowNumber}`}
            style={{
              borderTop: "1px solid #e2e8f0",
              paddingTop: "12px",
              marginTop: "12px",
              display: "flex",
              gap: "12px",
              alignItems: "start",
            }}
          >
            <input
              type="checkbox"
              checked={row.selected}
              onChange={() => onToggleRow(row.rowNumber, row.sourceTab)}
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
                marginTop: "2px",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
                {mergeAllTabs && sheets.length > 1 ? (
                  <>
                    <span style={{
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      marginRight: "8px"
                    }}>
                      {row.sourceTab}
                    </span>
                    Row {row.rowNumber}
                  </>
                ) : (
                  <>Row {row.rowNumber}</>
                )}
              </p>
              <p style={{ marginTop: "4px", fontSize: "0.95rem" }}>
                {row.question || <em>No question text found.</em>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
