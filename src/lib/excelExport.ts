import * as XLSX from "xlsx";
import { BulkProject, BulkRow } from "@/types/bulkProject";

export type ExportOptions = {
  includeIncomplete?: boolean; // Include rows without responses (default: true)
  confidenceFilter?: "all" | "high" | "medium" | "low"; // Filter by confidence level
  includeMetadata?: boolean; // Include summary sheet (default: true)
};

const DEFAULT_OPTIONS: ExportOptions = {
  includeIncomplete: true,
  confidenceFilter: "all",
  includeMetadata: true,
};

function getConfidenceLevel(confidence?: string): "high" | "medium" | "low" | null {
  if (!confidence) return null;
  const lower = confidence.toLowerCase();
  if (lower.includes("high")) return "high";
  if (lower.includes("medium")) return "medium";
  if (lower.includes("low")) return "low";
  return null;
}

function filterRows(rows: BulkRow[], options: ExportOptions): BulkRow[] {
  let filtered = [...rows];

  // Filter incomplete rows
  if (!options.includeIncomplete) {
    filtered = filtered.filter((row) => row.response && row.response.trim().length > 0);
  }

  // Filter by confidence level
  if (options.confidenceFilter && options.confidenceFilter !== "all") {
    filtered = filtered.filter((row) => {
      const level = getConfidenceLevel(row.confidence);
      return level === options.confidenceFilter;
    });
  }

  return filtered;
}

function calculateStats(rows: BulkRow[]) {
  const total = rows.length;
  const completed = rows.filter((r) => r.response && r.response.trim().length > 0).length;
  const pending = total - completed;

  const highConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "high").length;
  const mediumConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "medium").length;
  const lowConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "low").length;

  return {
    total,
    completed,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    highConfidence,
    mediumConfidence,
    lowConfidence,
  };
}

function createSummarySheet(project: BulkProject, stats: ReturnType<typeof calculateStats>): XLSX.WorkSheet {
  const data = [
    ["Project Summary"],
    [],
    ["Project Name", project.name],
    ["Customer", project.customerName || "Not specified"],
    ["Owner", project.ownerName || "Not specified"],
    ["Status", formatStatus(project.status)],
    ["Created", formatDate(project.createdAt)],
    ["Last Modified", formatDate(project.lastModifiedAt)],
    [],
    ["Completion Statistics"],
    [],
    ["Total Questions", stats.total],
    ["Completed", stats.completed],
    ["Pending", stats.pending],
    ["Completion Rate", `${stats.completionRate}%`],
    [],
    ["Confidence Breakdown"],
    [],
    ["High Confidence", stats.highConfidence],
    ["Medium Confidence", stats.mediumConfidence],
    ["Low Confidence", stats.lowConfidence],
  ];

  // Add review info if available
  if (project.reviewRequestedBy) {
    data.push([], ["Review Information"], []);
    data.push(["Requested By", project.reviewRequestedBy]);
    data.push(["Requested At", formatDate(project.reviewRequestedAt)]);
    if (project.reviewedBy) {
      data.push(["Approved By", project.reviewedBy]);
      data.push(["Approved At", formatDate(project.reviewedAt)]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet["!cols"] = [{ wch: 20 }, { wch: 50 }];

  // Merge title cells
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Project Summary title
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } }, // Completion Statistics title
    { s: { r: 16, c: 0 }, e: { r: 16, c: 1 } }, // Confidence Breakdown title
  ];

  return sheet;
}

// Extract URLs from text and return as array
function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s,\n)>\]]+/gi;
  return text.match(urlRegex) || [];
}

// Format sources with hyperlinks for Excel
function formatSourcesForExcel(sources: string): string {
  if (!sources) return "";
  const urls = extractUrls(sources);
  if (urls.length === 0) return sources;

  // Return URLs as newline-separated list for cleaner display
  // Each URL will be made clickable via cell hyperlink
  return urls.join("\n");
}

function createResponsesSheet(rows: BulkRow[]): XLSX.WorkSheet {
  // Check if we have multiple source tabs
  const uniqueTabs = new Set(rows.map((r) => r.sourceTab).filter(Boolean));
  const hasMultipleTabs = uniqueTabs.size > 1;

  // Headers - include Source Tab column only if there are multiple tabs
  const headers = hasMultipleTabs
    ? ["Source Tab", "Row #", "Question", "Answer", "Status", "Confidence", "Reasoning", "Inference", "Sources", "Remarks"]
    : ["Row #", "Question", "Answer", "Status", "Confidence", "Reasoning", "Inference", "Sources", "Remarks"];

  const data = [headers];

  // Add rows
  rows.forEach((row) => {
    const status = row.response && row.response.trim().length > 0 ? "Completed" : "Pending";
    const formattedSources = formatSourcesForExcel(row.sources || "");
    const rowData = hasMultipleTabs
      ? [
          row.sourceTab || "",
          row.rowNumber.toString(),
          row.question,
          row.response || "",
          status,
          row.confidence || "",
          row.reasoning || "",
          row.inference || "None",
          formattedSources,
          row.remarks || "",
        ]
      : [
          row.rowNumber.toString(),
          row.question,
          row.response || "",
          status,
          row.confidence || "",
          row.reasoning || "",
          row.inference || "None",
          formattedSources,
          row.remarks || "",
        ];
    data.push(rowData);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Add hyperlinks to source URLs
  const sourcesColIndex = hasMultipleTabs ? 8 : 7; // 0-indexed column for Sources
  rows.forEach((row, rowIndex) => {
    const urls = extractUrls(row.sources || "");
    if (urls.length > 0) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: sourcesColIndex }); // +1 for header row
      const cell = sheet[cellAddress];
      if (cell) {
        // For single URL, make the cell itself a hyperlink
        if (urls.length === 1) {
          cell.l = { Target: urls[0], Tooltip: "Click to open source" };
        }
        // For multiple URLs, add hyperlink to first URL (Excel limitation for cell hyperlinks)
        // The full list is shown as text with newlines
        else {
          cell.l = { Target: urls[0], Tooltip: `Click to open first source (${urls.length} total)` };
        }
      }
    }
  });

  // Set column widths - include Source Tab column only if there are multiple tabs
  sheet["!cols"] = hasMultipleTabs
    ? [
        { wch: 15 }, // Source Tab
        { wch: 8 }, // Row #
        { wch: 50 }, // Question
        { wch: 80 }, // Answer
        { wch: 12 }, // Status
        { wch: 15 }, // Confidence
        { wch: 50 }, // Reasoning
        { wch: 50 }, // Inference
        { wch: 40 }, // Sources
        { wch: 40 }, // Remarks
      ]
    : [
        { wch: 8 }, // Row #
        { wch: 50 }, // Question
        { wch: 80 }, // Answer
        { wch: 12 }, // Status
        { wch: 15 }, // Confidence
        { wch: 50 }, // Reasoning
        { wch: 50 }, // Inference
        { wch: 40 }, // Sources
        { wch: 40 }, // Remarks
      ];

  // Set row heights for better readability
  sheet["!rows"] = [{ hpt: 30 }]; // Header row height

  return sheet;
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: "Draft",
    in_progress: "In Progress",
    needs_review: "Needs Review",
    finalized: "Finalized",
  };
  return statusMap[status] || status;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function exportProjectToExcel(project: BulkProject, options: ExportOptions = {}): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter rows based on options
  const filteredRows = filterRows(project.rows, opts);

  // Calculate stats from original rows (not filtered)
  const stats = calculateStats(project.rows);

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add summary sheet if requested
  if (opts.includeMetadata) {
    const summarySheet = createSummarySheet(project, stats);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  }

  // Add Q&A sheet
  const qaSheet = createResponsesSheet(filteredRows);
  XLSX.utils.book_append_sheet(wb, qaSheet, "Q&A");

  // Generate filename
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedName = project.name.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const filterSuffix = opts.confidenceFilter !== "all" ? `_${opts.confidenceFilter}` : "";
  const filename = `${sanitizedName}${filterSuffix}_${timestamp}.xlsx`;

  // Write the file
  XLSX.writeFile(wb, filename);
}

// Export filtered versions for convenience
export function exportCompletedOnly(project: BulkProject): void {
  exportProjectToExcel(project, { includeIncomplete: false });
}

export function exportHighConfidenceOnly(project: BulkProject): void {
  exportProjectToExcel(project, { confidenceFilter: "high" });
}

export function exportLowConfidenceOnly(project: BulkProject): void {
  exportProjectToExcel(project, { confidenceFilter: "low", includeIncomplete: false });
}
