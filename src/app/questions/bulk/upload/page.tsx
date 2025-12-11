"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BulkProject } from "@/types/bulkProject";
import { createProject } from "@/lib/projectApi";

type SheetData = {
  name: string;
  columns: string[];
  rows: string[][];
};

type PreviewRow = {
  rowNumber: number;
  question: string;
  cells: Record<string, string>;
  selected: boolean; // Track if row should be included in project
};

const styles = {
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5f5",
    marginBottom: "12px",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};

export default function BulkUploadPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [questionColumn, setQuestionColumn] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeSheet = useMemo(() => {
    if (!sheets.length) return null;
    if (selectedSheet) {
      return sheets.find((sheet) => sheet.name === selectedSheet) ?? sheets[0];
    }
    return sheets[0];
  }, [sheets, selectedSheet]);

  const columns = activeSheet?.columns ?? [];
  const detectedRows = activeSheet?.rows.length ?? 0;

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^.]+$/, "");
    setProjectName((prev) => prev || fileName);
    setIsParsing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSheets([]);
    setSelectedSheet("");
    setQuestionColumn("");
    setPreviewRows([]);

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isExcel =
      file.name.toLowerCase().endsWith(".xls") || file.name.toLowerCase().endsWith(".xlsx");

    if (!isCsv && !isExcel) {
      setIsParsing(false);
      setErrorMessage("Unsupported file type. Upload a CSV or Excel workbook.");
      event.target.value = "";
      return;
    }

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result?.toString() || "";
          const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
          const rows = (parsed.data as string[][]).filter((row) =>
            row.some((cell) => (cell ?? "").toString().trim().length > 0),
          );
          const sheet = buildSheetData(rows, fileName || "CSV Upload");
          if (sheet) {
            setSheets([sheet]);
            setSelectedSheet(sheet.name);
            setErrorMessage(null);
          } else {
            setErrorMessage("Uploaded CSV did not contain any data rows.");
          }
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to parse CSV. Please verify formatting.",
          );
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setErrorMessage("Unable to read CSV file.");
        setIsParsing(false);
      };
      reader.readAsText(file);
    } else if (isExcel) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const workbook = XLSX.read(reader.result, { type: "array" });
          const parsedSheets: SheetData[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              blankrows: false,
              defval: "",
            }) as (string | number | boolean | null)[][];
            const normalized = rows.map((row) =>
              row.map((cell) => (cell === null ? "" : cell.toString())),
            );
            const sheetData = buildSheetData(normalized, sheetName);
            if (sheetData) {
              parsedSheets.push(sheetData);
            }
          });
          if (parsedSheets.length === 0) {
            setErrorMessage("No populated worksheets detected in this file.");
          } else {
            setSheets(parsedSheets);
            setSelectedSheet(parsedSheets[0].name);
            setErrorMessage(null);
          }
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to parse Excel workbook. Ensure it is not password protected.",
          );
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setErrorMessage("Unable to read Excel file.");
        setIsParsing(false);
      };
      reader.readAsArrayBuffer(file);
    }

    event.target.value = "";
  };

  const buildSheetData = (rows: string[][], name: string): SheetData | null => {
    if (!rows.length) return null;

    const headerRow = rows[0].map((cell, index) => {
      const label = (cell || "").toString().trim();
      return label.length > 0 ? label : `Column ${index + 1}`;
    });

    const bodyRows = rows.slice(1).filter((row) =>
      row.some((cell) => (cell ?? "").toString().trim().length > 0),
    );

    if (bodyRows.length === 0) return null;

    return {
      name,
      columns: headerRow,
      rows: bodyRows,
    };
  };

  const handleQuestionColumnChange = (value: string) => {
    setQuestionColumn(value);
    setPreviewRows([]);
    if (!activeSheet || !value) return;

    const columnIndex = activeSheet.columns.indexOf(value);
    if (columnIndex === -1) return;

    const mapped = activeSheet.rows.map((row, index) => {
      const cells: Record<string, string> = {};
      activeSheet.columns.forEach((col, idx) => {
        cells[col] = row[idx]?.toString() ?? "";
      });
      return {
        rowNumber: index + 2,
        question: row[columnIndex]?.toString().trim() ?? "",
        cells,
        selected: true, // Default to selected
      };
    });

    setPreviewRows(mapped);
  };

  const handleToggleRow = (rowNumber: number) => {
    setPreviewRows((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const handleSelectAll = () => {
    setPreviewRows((prev) => prev.map((row) => ({ ...row, selected: true })));
  };

  const handleDeselectAll = () => {
    setPreviewRows((prev) => prev.map((row) => ({ ...row, selected: false })));
  };

  // Legacy challenge prompt function - kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const defaultChallengePrompt = (question: string) =>
    [
      "Challenge this answer for the question below.",
      `Question: "${question}"`,
      "Identify any weak claims, missing evidence, or compliance gaps.",
      "Suggest what documentation or controls should be referenced to improve accuracy.",
    ].join("\n");

  const handleSaveProject = async () => {
    if (!activeSheet || !questionColumn) {
      setErrorMessage("Select a worksheet and question column before saving.");
      return;
    }
    if (previewRows.length === 0) {
      setErrorMessage("No question rows detected. Adjust your column selection.");
      return;
    }

    // Only include selected rows in the project
    const selectedRows = previewRows.filter((row) => row.selected);

    if (selectedRows.length === 0) {
      setErrorMessage("No questions selected. Please select at least one question to include.");
      return;
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    const project: BulkProject = {
      id: projectId,
      name: projectName.trim() || "Untitled Project",
      customerName: customerName.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
      sheetName: activeSheet.name,
      columns: activeSheet.columns,
      createdAt: now,
      lastModifiedAt: now,
      status: "draft",
      notes: undefined,
      rows: selectedRows.map((row) => ({
        id: crypto.randomUUID(),
        rowNumber: row.rowNumber,
        question: row.question,
        response: "",
        status: "pending" as const,
        error: undefined,
        conversationHistory: undefined,
        confidence: undefined,
        sources: undefined,
        remarks: undefined,
        usedSkills: undefined,
        showRecommendation: false,
      })),
    };

    try {
      const createdProject = await createProject(project);
      setSuccessMessage(
        "Project saved! Redirecting to response workspace...",
      );
      router.push(`/questions/bulk/${createdProject.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      setErrorMessage("Failed to save project. Please try again.");
    }
  };

  return (
    <div style={styles.container}>
      <h1>GRC Minion – Bulk Upload Setup</h1>
      <p style={{ color: "#475569" }}>
        Parse questionnaires into a reusable project. Once saved, you can generate responses later
        and keep progress between sessions.
      </p>

      {errorMessage && <div style={{ ...styles.card, backgroundColor: "#fee2e2" }}>{errorMessage}</div>}
      {successMessage && (
        <div style={{ ...styles.card, backgroundColor: "#dcfce7", color: "#166534" }}>{successMessage}</div>
      )}

      <div style={styles.card}>
        <label style={styles.label} htmlFor="customerName">
          Customer Name (optional)
        </label>
        <input
          id="customerName"
          type="text"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          style={styles.input}
          placeholder="e.g. Acme Corp"
        />

        <label style={styles.label} htmlFor="ownerName">
          Your Name (optional)
        </label>
        <input
          id="ownerName"
          type="text"
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          style={styles.input}
          placeholder="e.g. John Smith"
        />

        <label style={styles.label} htmlFor="projectName">
          Project name
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          style={styles.input}
          placeholder="e.g. Vendor Security Questionnaire – Q1"
        />

        <label style={styles.label}>Upload CSV or Excel</label>
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileUpload}
          disabled={isParsing}
          style={{ marginBottom: "8px" }}
        />
        {isParsing && <p style={{ color: "#0f172a" }}>Parsing file...</p>}
        {detectedRows > 0 && !isParsing && (
          <p style={{ color: "#0f172a" }}>
            Detected <strong>{detectedRows}</strong> data rows in this worksheet.
          </p>
        )}
      </div>

      {sheets.length > 1 && (
        <div style={styles.card}>
          <label style={styles.label} htmlFor="sheetSelect">
            Select worksheet
          </label>
          <select
            id="sheetSelect"
            value={selectedSheet}
            onChange={(event) => setSelectedSheet(event.target.value)}
            style={styles.input}
          >
            {sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name}
              </option>
            ))}
          </select>
          <p style={{ color: "#64748b" }}>
            Each worksheet becomes its own project, keeping customer-specific columns isolated.
          </p>
        </div>
      )}

      {columns.length > 0 && (
        <div style={styles.card}>
          <label style={styles.label} htmlFor="questionColumn">
            Which column contains the questionnaire prompts?
          </label>
          <select
            id="questionColumn"
            value={questionColumn}
            onChange={(event) => handleQuestionColumnChange(event.target.value)}
            style={styles.input}
          >
            <option value="">Select column</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
          <p style={{ color: "#64748b" }}>
            We mirror the workflow summary: explicitly pick the prompt column so we never overwrite
            customer data.
          </p>
        </div>
      )}

      {previewRows.length > 0 && (
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
                Preview ({previewRows.filter((r) => r.selected).length} of {previewRows.length} selected)
              </h2>
              <p style={{ color: "#475569", marginTop: "4px" }}>
                Review and select questions from <strong>{activeSheet?.name}</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleSelectAll}
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
                onClick={handleDeselectAll}
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
                onClick={handleSaveProject}
                style={{ ...styles.button, backgroundColor: "#0ea5e9", color: "#fff" }}
              >
                Save project &amp; review responses
              </button>
            </div>
          </div>
          <div style={{ marginTop: "12px", maxHeight: "500px", overflowY: "auto" }}>
            {previewRows.map((row) => (
              <div
                key={row.rowNumber}
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
                  onChange={() => handleToggleRow(row.rowNumber)}
                  style={{
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    marginTop: "2px",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>Row {row.rowNumber}</p>
                  <p style={{ marginTop: "4px", fontSize: "0.95rem" }}>
                    {row.question || <em>No question text found.</em>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <Link href="/questions/bulk/" style={{ color: "#2563eb", fontWeight: 600 }}>
          Go to response workspace →
        </Link>
      </div>
    </div>
  );
}
