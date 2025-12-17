"use client";

import { SheetData, styles } from "./types";

type SheetSelectionCardProps = {
  sheets: SheetData[];
  selectedSheet: string;
  mergeAllTabs: boolean;
  useSameColumnForAll: boolean;
  perTabColumns: Record<string, string>;
  commonColumns: string[];
  allTabsHaveColumns: boolean;
  onSelectedSheetChange: (value: string) => void;
  onMergeAllTabsChange: (value: boolean) => void;
  onUseSameColumnForAllChange: (value: boolean) => void;
  onPerTabColumnChange: (tabName: string, columnName: string) => void;
};

export default function SheetSelectionCard({
  sheets,
  selectedSheet,
  mergeAllTabs,
  useSameColumnForAll,
  perTabColumns,
  commonColumns,
  allTabsHaveColumns,
  onSelectedSheetChange,
  onMergeAllTabsChange,
  onUseSameColumnForAllChange,
  onPerTabColumnChange,
}: SheetSelectionCardProps) {
  if (sheets.length <= 1) return null;

  return (
    <div style={styles.card}>
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={mergeAllTabs}
            onChange={(e) => onMergeAllTabsChange(e.target.checked)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600 }}>Merge all {sheets.length} tabs into one project</span>
        </label>
        <p style={{ color: "#64748b", marginTop: "8px", marginLeft: "28px" }}>
          {mergeAllTabs
            ? "Questions from all tabs will be combined. Each row will show which tab it came from."
            : "Each tab will be processed as a separate project."}
        </p>
      </div>

      {!mergeAllTabs && (
        <>
          <label style={styles.label} htmlFor="sheetSelect">
            Select worksheet
          </label>
          <select
            id="sheetSelect"
            value={selectedSheet}
            onChange={(event) => onSelectedSheetChange(event.target.value)}
            style={styles.input}
          >
            {sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} ({sheet.rows.length} rows)
              </option>
            ))}
          </select>
        </>
      )}

      {mergeAllTabs && (
        <>
          <div style={{
            backgroundColor: "#f0fdf4",
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid #bbf7d0",
            marginBottom: "16px"
          }}>
            <p style={{ margin: 0, color: "#166534", fontSize: "0.9rem" }}>
              <strong>Tabs to merge:</strong>{" "}
              {sheets.map((s, i) => (
                <span key={s.name}>
                  {s.name} ({s.rows.length})
                  {i < sheets.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useSameColumnForAll}
                onChange={(e) => onUseSameColumnForAllChange(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 500 }}>All tabs have the same question column name</span>
            </label>
            <p style={{ color: "#64748b", marginTop: "6px", marginLeft: "26px", fontSize: "0.85rem" }}>
              {useSameColumnForAll
                ? `${commonColumns.length} common columns found across all tabs`
                : "Map each tab to its question column below"}
            </p>
          </div>

          {!useSameColumnForAll && (
            <div style={{
              backgroundColor: "#f8fafc",
              padding: "16px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0"
            }}>
              <p style={{ margin: "0 0 12px 0", fontWeight: 600, fontSize: "0.9rem" }}>
                Select question column for each tab:
              </p>
              {sheets.map((sheet) => (
                <div key={sheet.name} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "10px"
                }}>
                  <span style={{
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    minWidth: "140px",
                    maxWidth: "200px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                  title={sheet.name}
                  >
                    {sheet.name}
                  </span>
                  <select
                    value={perTabColumns[sheet.name] || ""}
                    onChange={(e) => onPerTabColumnChange(sheet.name, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem"
                    }}
                  >
                    <option value="">Select column...</option>
                    {sheet.columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <span style={{ color: "#64748b", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {sheet.rows.length} rows
                  </span>
                </div>
              ))}
              {!allTabsHaveColumns && (
                <p style={{ margin: "12px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Select a column for each tab to see the preview.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
