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

// Style definitions for xlsx-js-style compatibility (future enhancement)
// Note: These require xlsx-js-style package instead of xlsx for cell styling
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STYLE_DEFINITIONS = {
  header: {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E3A8A" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  },
  cell: {
    alignment: { vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  confidenceColors: {
    high: "DCFCE7", // Green
    medium: "FEF3C7", // Yellow
    low: "FEE2E2", // Red
  },
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

function createResponsesSheet(rows: BulkRow[]): XLSX.WorkSheet {
  // Headers
  const headers = ["Row #", "Question", "Response", "Status", "Confidence", "Reasoning", "Inference", "Sources", "Remarks"];

  const data = [headers];

  // Add rows
  rows.forEach((row) => {
    const status = row.response && row.response.trim().length > 0 ? "Completed" : "Pending";
    data.push([
      row.rowNumber.toString(),
      row.question,
      row.response || "",
      status,
      row.confidence || "",
      row.reasoning || "",
      row.inference || "None",
      row.sources || "",
      row.remarks || "",
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet["!cols"] = [
    { wch: 8 }, // Row #
    { wch: 50 }, // Question
    { wch: 80 }, // Response
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
    approved: "Approved",
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

  // Add responses sheet
  const responsesSheet = createResponsesSheet(filteredRows);
  XLSX.utils.book_append_sheet(wb, responsesSheet, "Responses");

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
