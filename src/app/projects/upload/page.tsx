"use client";

import { ChangeEvent, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BulkProject } from "@/types/bulkProject";
import { createProject } from "@/lib/projectApi";
import { InlineError, InlineSuccess } from "@/components/ui/status-display";

import {
  ProjectMetadataCard,
  SheetSelectionCard,
  PreviewCard,
  styles,
  User,
  SheetData,
  PreviewRow,
} from "./components";

export default function BulkUploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [sheets, setSheets] = useState<SheetData[]>([]);

  // Fetch users for owner dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  // Set default owner to current user when session loads
  useEffect(() => {
    if (session?.user?.id && !selectedOwnerId) {
      setSelectedOwnerId(session.user.id);
    }
  }, [session?.user?.id, selectedOwnerId]);

  const [selectedSheet, setSelectedSheet] = useState("");
  const [mergeAllTabs, setMergeAllTabs] = useState(true);
  const [questionColumn, setQuestionColumn] = useState("");
  const [useSameColumnForAll, setUseSameColumnForAll] = useState(true);
  const [perTabColumns, setPerTabColumns] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeSheet = useMemo(() => {
    if (!sheets.length) return null;
    if (mergeAllTabs && sheets.length > 1) return sheets[0];
    if (selectedSheet) return sheets.find((sheet) => sheet.name === selectedSheet) ?? sheets[0];
    return sheets[0];
  }, [sheets, selectedSheet, mergeAllTabs]);

  const commonColumns = useMemo(() => {
    if (!sheets.length || sheets.length < 2) return [];
    const allColumnSets = sheets.map((s) => new Set(s.columns));
    return sheets[0].columns.filter((col) => allColumnSets.every((set) => set.has(col)));
  }, [sheets]);

  const columns = useMemo(() => {
    if (!sheets.length) return [];
    if (mergeAllTabs && sheets.length > 1) {
      return useSameColumnForAll ? commonColumns : [];
    }
    return activeSheet?.columns ?? [];
  }, [sheets, activeSheet, mergeAllTabs, useSameColumnForAll, commonColumns]);

  const detectedRows = useMemo(() => {
    if (!sheets.length) return 0;
    if (mergeAllTabs && sheets.length > 1) {
      return sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    }
    return activeSheet?.rows.length ?? 0;
  }, [sheets, activeSheet, mergeAllTabs]);

  const allTabsHaveColumns = useMemo(() => {
    if (!mergeAllTabs || useSameColumnForAll || sheets.length < 2) return true;
    return sheets.every((sheet) => perTabColumns[sheet.name]);
  }, [mergeAllTabs, useSameColumnForAll, sheets, perTabColumns]);

  const buildSheetData = (rows: string[][], name: string): SheetData | null => {
    if (!rows.length) return null;
    const headerRow = rows[0].map((cell, index) => {
      const label = (cell || "").toString().trim();
      return label.length > 0 ? label : `Column ${index + 1}`;
    });
    const bodyRows = rows.slice(1).filter((row) =>
      row.some((cell) => (cell ?? "").toString().trim().length > 0)
    );
    if (bodyRows.length === 0) return null;
    return { name, columns: headerRow, rows: bodyRows };
  };

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
    setPerTabColumns({});
    setPreviewRows([]);

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isExcel = file.name.toLowerCase().endsWith(".xls") || file.name.toLowerCase().endsWith(".xlsx");

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
            row.some((cell) => (cell ?? "").toString().trim().length > 0)
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
          setErrorMessage(error instanceof Error ? error.message : "Failed to parse CSV.");
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => { setErrorMessage("Unable to read CSV file."); setIsParsing(false); };
      reader.readAsText(file);
    } else if (isExcel) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const workbook = XLSX.read(reader.result, { type: "array" });
          const parsedSheets: SheetData[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" }) as (string | number | boolean | null)[][];
            const normalized = rows.map((row) => row.map((cell) => (cell === null ? "" : cell.toString())));
            const sheetData = buildSheetData(normalized, sheetName);
            if (sheetData) parsedSheets.push(sheetData);
          });
          if (parsedSheets.length === 0) {
            setErrorMessage("No populated worksheets detected in this file.");
          } else {
            setSheets(parsedSheets);
            setSelectedSheet(parsedSheets[0].name);
            setErrorMessage(null);
          }
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to parse Excel workbook.");
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => { setErrorMessage("Unable to read Excel file."); setIsParsing(false); };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = "";
  };

  const generatePreviewRows = (columnName: string, tabColumns?: Record<string, string>) => {
    const allRows: PreviewRow[] = [];

    if (tabColumns) {
      sheets.forEach((sheet) => {
        const colName = tabColumns[sheet.name];
        if (!colName) return;
        const columnIndex = sheet.columns.indexOf(colName);
        if (columnIndex === -1) return;
        sheet.rows.forEach((row, index) => {
          const cells: Record<string, string> = {};
          sheet.columns.forEach((col, idx) => { cells[col] = row[idx]?.toString() ?? ""; });
          allRows.push({
            rowNumber: index + 2,
            question: row[columnIndex]?.toString().trim() ?? "",
            cells,
            selected: true,
            sourceTab: sheet.name,
          });
        });
      });
    } else if (mergeAllTabs && sheets.length > 1 && useSameColumnForAll) {
      sheets.forEach((sheet) => {
        const columnIndex = sheet.columns.indexOf(columnName);
        if (columnIndex === -1) return;
        sheet.rows.forEach((row, index) => {
          const cells: Record<string, string> = {};
          sheet.columns.forEach((col, idx) => { cells[col] = row[idx]?.toString() ?? ""; });
          allRows.push({
            rowNumber: index + 2,
            question: row[columnIndex]?.toString().trim() ?? "",
            cells,
            selected: true,
            sourceTab: sheet.name,
          });
        });
      });
    } else if (activeSheet) {
      const columnIndex = activeSheet.columns.indexOf(columnName);
      if (columnIndex === -1) return allRows;
      activeSheet.rows.forEach((row, index) => {
        const cells: Record<string, string> = {};
        activeSheet.columns.forEach((col, idx) => { cells[col] = row[idx]?.toString() ?? ""; });
        allRows.push({
          rowNumber: index + 2,
          question: row[columnIndex]?.toString().trim() ?? "",
          cells,
          selected: true,
          sourceTab: activeSheet.name,
        });
      });
    }

    return allRows;
  };

  const handleQuestionColumnChange = (value: string) => {
    setQuestionColumn(value);
    setPreviewRows(value ? generatePreviewRows(value) : []);
  };

  const handlePerTabColumnChange = (tabName: string, columnName: string) => {
    const newPerTabColumns = { ...perTabColumns, [tabName]: columnName };
    setPerTabColumns(newPerTabColumns);
    setPreviewRows(generatePreviewRows("", newPerTabColumns));
  };

  const handleMergeAllTabsChange = (value: boolean) => {
    setMergeAllTabs(value);
    setQuestionColumn("");
    setPerTabColumns({});
    setPreviewRows([]);
  };

  const handleUseSameColumnForAllChange = (value: boolean) => {
    setUseSameColumnForAll(value);
    setQuestionColumn("");
    setPerTabColumns({});
    setPreviewRows([]);
  };

  const handleSelectedSheetChange = (value: string) => {
    setSelectedSheet(value);
    setQuestionColumn("");
    setPreviewRows([]);
  };

  const handleToggleRow = (rowNumber: number, sourceTab: string) => {
    setPreviewRows((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber && row.sourceTab === sourceTab
          ? { ...row, selected: !row.selected }
          : row
      )
    );
  };

  const handleSaveProject = async () => {
    if (mergeAllTabs && sheets.length > 1) {
      if (useSameColumnForAll && !questionColumn) {
        setErrorMessage("Select a question column before saving.");
        return;
      }
      if (!useSameColumnForAll && !allTabsHaveColumns) {
        setErrorMessage("Select a question column for each tab before saving.");
        return;
      }
    } else if (!activeSheet || !questionColumn) {
      setErrorMessage("Select a worksheet and question column before saving.");
      return;
    }

    const selectedRows = previewRows.filter((row) => row.selected);
    if (selectedRows.length === 0) {
      setErrorMessage("No questions selected. Please select at least one question to include.");
      return;
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const sheetNameForProject = mergeAllTabs && sheets.length > 1
      ? `Merged (${sheets.length} tabs)`
      : activeSheet?.name || "Unknown";
    const tabsWithRows = [...new Set(selectedRows.map((r) => r.sourceTab))];
    const projectColumns = mergeAllTabs && sheets.length > 1 && !useSameColumnForAll
      ? [...new Set(sheets.flatMap((s) => s.columns))]
      : (columns.length > 0 ? columns : activeSheet?.columns || []);
    const selectedOwner = users.find((u) => u.id === selectedOwnerId);

    const project: BulkProject = {
      id: projectId,
      name: projectName.trim() || "Untitled Project",
      customerName: customerName.trim() || undefined,
      ownerId: selectedOwnerId || undefined,
      ownerName: selectedOwner ? (selectedOwner.name || selectedOwner.email || undefined) : undefined,
      sheetName: sheetNameForProject,
      columns: projectColumns,
      createdAt: now,
      lastModifiedAt: now,
      status: "draft",
      notes: tabsWithRows.length > 1 ? `Source tabs: ${tabsWithRows.join(", ")}` : undefined,
      rows: selectedRows.map((row) => ({
        id: crypto.randomUUID(),
        rowNumber: row.rowNumber,
        question: row.question,
        response: "",
        status: "pending" as const,
        error: undefined,
        sourceTab: row.sourceTab,
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
      setSuccessMessage("Project saved! Redirecting to response workspace...");
      router.push(`/projects/${createdProject.id}`);
    } catch {
      toast.error("Failed to save project. Please try again.");
      setErrorMessage("Failed to save project. Please try again.");
    }
  };

  return (
    <div style={styles.container}>
      <h1>Answer Goblin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Bulk Upload)</span></h1>
      <p style={{ color: "#475569" }}>
        Parse questionnaires into a reusable project. Once saved, you can generate responses later
        and keep progress between sessions.
      </p>

      {errorMessage && <InlineError message={errorMessage} onDismiss={() => setErrorMessage(null)} />}
      {successMessage && <InlineSuccess message={successMessage} onDismiss={() => setSuccessMessage(null)} />}

      <ProjectMetadataCard
        projectName={projectName}
        customerName={customerName}
        selectedOwnerId={selectedOwnerId}
        users={users}
        currentUserId={session?.user?.id}
        detectedRows={detectedRows}
        isParsing={isParsing}
        onProjectNameChange={setProjectName}
        onCustomerNameChange={setCustomerName}
        onOwnerIdChange={setSelectedOwnerId}
        onFileUpload={handleFileUpload}
      />

      <SheetSelectionCard
        sheets={sheets}
        selectedSheet={selectedSheet}
        mergeAllTabs={mergeAllTabs}
        useSameColumnForAll={useSameColumnForAll}
        perTabColumns={perTabColumns}
        commonColumns={commonColumns}
        allTabsHaveColumns={allTabsHaveColumns}
        onSelectedSheetChange={handleSelectedSheetChange}
        onMergeAllTabsChange={handleMergeAllTabsChange}
        onUseSameColumnForAllChange={handleUseSameColumnForAllChange}
        onPerTabColumnChange={handlePerTabColumnChange}
      />

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
              <option key={column} value={column}>{column}</option>
            ))}
          </select>
          <p style={{ color: "#64748b" }}>
            We mirror the workflow summary: explicitly pick the prompt column so we never overwrite customer data.
          </p>
        </div>
      )}

      <PreviewCard
        previewRows={previewRows}
        sheets={sheets}
        activeSheetName={activeSheet?.name}
        mergeAllTabs={mergeAllTabs}
        onToggleRow={handleToggleRow}
        onSelectAll={() => setPreviewRows((prev) => prev.map((row) => ({ ...row, selected: true })))}
        onDeselectAll={() => setPreviewRows((prev) => prev.map((row) => ({ ...row, selected: false })))}
        onSaveProject={handleSaveProject}
      />

      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <Link href="/projects" style={{ color: "#2563eb", fontWeight: 600 }}>
          Go to projects list
        </Link>
      </div>
    </div>
  );
}
