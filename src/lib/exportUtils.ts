import ExcelJS from "exceljs";
import type { QuestionLogEntry } from "@/app/admin/question-log/types";

// ============================================
// Question Log Export
// ============================================

export type QuestionLogExportOptions = {
  format: "xlsx" | "csv" | "json";
  includeTransparency?: boolean; // Include reasoning, inference, sources
  includeMetadata?: boolean; // Include review/flag info
};

const DEFAULT_QUESTION_LOG_OPTIONS: QuestionLogExportOptions = {
  format: "xlsx",
  includeTransparency: true,
  includeMetadata: true,
};

function formatDateForExport(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildQuestionLogRows(
  entries: QuestionLogEntry[],
  options: QuestionLogExportOptions
): Record<string, unknown>[] {
  return entries.map((entry) => {
    const row: Record<string, unknown> = {
      "Date": formatDateForExport(entry.finalizedAt),
      "Source": entry.source === "project" ? "Project" : "Quick Question",
      "Project": entry.projectName || "",
      "Customer": entry.customerName || "",
      "Question": entry.question,
      "Response": entry.userEditedAnswer || entry.response,
      "Status": entry.status,
      "Confidence": entry.confidence || "",
    };

    if (options.includeTransparency) {
      row["Reasoning"] = entry.reasoning || "";
      row["Inference"] = entry.inference || "";
      row["Sources"] = entry.sources || "";
    }

    if (options.includeMetadata) {
      row["Asked By"] = entry.askedBy || entry.askedByEmail || "";
      row["Finalized By"] = entry.finalizedBy || entry.finalizedByEmail || "";
      if (entry.userEditedAnswer) {
        row["Original Response"] = entry.response;
        row["Corrected"] = "Yes";
      }
      if (entry.flaggedBy) {
        row["Flagged By"] = entry.flaggedBy;
        row["Flag Note"] = entry.flagNote || "";
        row["Flag Resolution"] = entry.flagResolutionNote || "";
      }
      if (entry.reviewRequestedBy) {
        row["Review Requested By"] = entry.reviewRequestedBy;
      }
    }

    return row;
  });
}

export async function exportQuestionLog(
  entries: QuestionLogEntry[],
  options: Partial<QuestionLogExportOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_QUESTION_LOG_OPTIONS, ...options };
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `question-log_${timestamp}`;

  if (opts.format === "json") {
    const data = buildQuestionLogRows(entries, opts);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${filename}.json`);
    return;
  }

  const rows = buildQuestionLogRows(entries, opts);

  if (opts.format === "csv") {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Question Log");

    // Add headers
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      worksheet.addRow(headers);

      // Add data rows
      rows.forEach((row) => {
        worksheet.addRow(headers.map((h) => row[h]));
      });
    }

    // Convert to CSV manually
    const csvRows: string[] = [];
    worksheet.eachRow((row) => {
      const values = row.values as unknown[];
      csvRows.push(values.slice(1).map((v) => String(v ?? "")).join(","));
    });
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${filename}.csv`);
    return;
  }

  // Excel format
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  const summaryData = [
    ["Question Log Export"],
    [],
    ["Export Date", formatDateForExport(new Date().toISOString())],
    ["Total Entries", entries.length],
    [],
    ["Status Breakdown"],
    ["Answered", entries.filter((e) => e.status === "answered").length],
    ["Verified", entries.filter((e) => e.status === "verified").length],
    ["Corrected", entries.filter((e) => e.status === "corrected").length],
    ["Locked", entries.filter((e) => e.status === "locked").length],
    ["Resolved", entries.filter((e) => e.status === "resolved").length],
    [],
    ["Source Breakdown"],
    ["Projects", entries.filter((e) => e.source === "project").length],
    ["Quick Questions", entries.filter((e) => e.source === "questions").length],
  ];
  summarySheet.addRows(summaryData);
  summarySheet.columns = [{ width: 20 }, { width: 30 }];

  // Data sheet
  const dataSheet = workbook.addWorksheet("Questions");
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    dataSheet.addRow(headers);
    rows.forEach((row) => {
      dataSheet.addRow(headers.map((h) => row[h]));
    });

    // Set column widths
    const colWidths = [
      18, // Date
      14, // Source
      25, // Project
      20, // Customer
      60, // Question
      80, // Response
      12, // Status
      12, // Confidence
    ];
    if (opts.includeTransparency) {
      colWidths.push(50, 30, 40);
    }
    if (opts.includeMetadata) {
      colWidths.push(20, 20);
    }
    dataSheet.columns = dataSheet.columns.map((col, idx) => ({
      ...col,
      width: colWidths[idx] || 15,
    }));
  }

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${filename}.xlsx`);
}

// ============================================
// Chat Session Export
// ============================================

export type ChatMessage = {
  role: string;
  content: string;
  timestamp?: string;
};

export type ChatSession = {
  id: string;
  title?: string;
  messages: ChatMessage[];
  skillsUsed?: { id: string; title: string }[];
  documentsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  urlsUsed?: { id: string; title: string; url?: string }[];
  createdAt: string;
  updatedAt: string;
};

export type ChatExportOptions = {
  format: "xlsx" | "markdown" | "json" | "txt";
  includeMetadata?: boolean;
};

const DEFAULT_CHAT_OPTIONS: ChatExportOptions = {
  format: "markdown",
  includeMetadata: false,
};

function formatChatToMarkdown(session: ChatSession, options: ChatExportOptions): string {
  const lines: string[] = [];

  lines.push(`# Chat Session`);
  lines.push("");

  if (options.includeMetadata) {
    lines.push(`**Date:** ${formatDateForExport(session.createdAt)}`);
    if (session.skillsUsed && session.skillsUsed.length > 0) {
      lines.push(`**Skills Used:** ${session.skillsUsed.map((s) => s.title).join(", ")}`);
    }
    if (session.documentsUsed && session.documentsUsed.length > 0) {
      lines.push(`**Documents Used:** ${session.documentsUsed.map((d) => d.title).join(", ")}`);
    }
    if (session.customersUsed && session.customersUsed.length > 0) {
      lines.push(`**Customer Context:** ${session.customersUsed.map((c) => c.name).join(", ")}`);
    }
    if (session.urlsUsed && session.urlsUsed.length > 0) {
      lines.push(`**URLs Referenced:** ${session.urlsUsed.map((u) => u.title || u.url || u.id).join(", ")}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  for (const msg of session.messages) {
    const roleLabel = msg.role === "user" ? "**You:**" : "**Assistant:**";
    lines.push(roleLabel);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}

function formatChatToPlainText(session: ChatSession): string {
  const lines: string[] = [];

  lines.push(`Chat Session - ${formatDateForExport(session.createdAt)}`);
  lines.push("=".repeat(50));
  lines.push("");

  for (const msg of session.messages) {
    const roleLabel = msg.role === "user" ? "You:" : "Assistant:";
    lines.push(roleLabel);
    lines.push(msg.content);
    lines.push("");
    lines.push("-".repeat(30));
    lines.push("");
  }

  return lines.join("\n");
}

export async function exportChatSession(
  session: ChatSession,
  options: Partial<ChatExportOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_CHAT_OPTIONS, ...options };
  const timestamp = new Date().toISOString().split("T")[0];
  const titleSlug = (session.title || "chat").slice(0, 30).replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${titleSlug}_${timestamp}`;

  if (opts.format === "json") {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${filename}.json`);
    return;
  }

  if (opts.format === "markdown") {
    const content = formatChatToMarkdown(session, opts);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `${filename}.md`);
    return;
  }

  if (opts.format === "txt") {
    const content = formatChatToPlainText(session);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${filename}.txt`);
    return;
  }

  // Excel format
  const workbook = new ExcelJS.Workbook();

  // Metadata sheet
  if (opts.includeMetadata) {
    const metaSheet = workbook.addWorksheet("Info");
    const metaData = [
      ["Chat Session Export"],
      [],
      ["Created", formatDateForExport(session.createdAt)],
      ["Last Updated", formatDateForExport(session.updatedAt)],
      ["Total Messages", session.messages.length],
      [],
      ["Resources Used"],
    ];
    if (session.skillsUsed && session.skillsUsed.length > 0) {
      metaData.push(["Skills", session.skillsUsed.map((s) => s.title).join(", ")]);
    }
    if (session.documentsUsed && session.documentsUsed.length > 0) {
      metaData.push(["Documents", session.documentsUsed.map((d) => d.title).join(", ")]);
    }
    if (session.customersUsed && session.customersUsed.length > 0) {
      metaData.push(["Customers", session.customersUsed.map((c) => c.name).join(", ")]);
    }
    if (session.urlsUsed && session.urlsUsed.length > 0) {
      metaData.push(["URLs", session.urlsUsed.map((u) => u.title || u.url || u.id).join(", ")]);
    }
    metaSheet.addRows(metaData);
    metaSheet.columns = [{ width: 15 }, { width: 80 }];
  }

  // Messages sheet
  const msgSheet = workbook.addWorksheet("Messages");
  const messageRows = session.messages.map((msg, idx) => ({
    "#": idx + 1,
    "Role": msg.role === "user" ? "You" : "Assistant",
    "Message": msg.content,
    "Timestamp": msg.timestamp ? formatDateForExport(msg.timestamp) : "",
  }));

  if (messageRows.length > 0) {
    const headers = Object.keys(messageRows[0]);
    msgSheet.addRow(headers);
    messageRows.forEach((row) => {
      msgSheet.addRow(headers.map((h) => row[h as keyof typeof row]));
    });
    msgSheet.columns = [{ width: 5 }, { width: 10 }, { width: 100 }, { width: 18 }];
  }

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${filename}.xlsx`);
}

// Export multiple chat sessions
export async function exportChatHistory(
  sessions: ChatSession[],
  options: Partial<ChatExportOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_CHAT_OPTIONS, ...options };
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `chat-history_${timestamp}`;

  if (opts.format === "json") {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${filename}.json`);
    return;
  }

  if (opts.format === "markdown" || opts.format === "txt") {
    const contents = sessions.map((s, idx) => {
      const header = `## Session ${idx + 1} - ${formatDateForExport(s.createdAt)}`;
      const body = opts.format === "markdown"
        ? formatChatToMarkdown(s, opts)
        : formatChatToPlainText(s);
      return `${header}\n\n${body}`;
    });
    const fullContent = contents.join("\n\n---\n\n");
    const ext = opts.format === "markdown" ? "md" : "txt";
    const mimeType = opts.format === "markdown" ? "text/markdown" : "text/plain";
    const blob = new Blob([fullContent], { type: `${mimeType};charset=utf-8` });
    downloadBlob(blob, `${filename}.${ext}`);
    return;
  }

  // Excel format - one workbook with all sessions
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  const summaryData = [
    ["Chat History Export"],
    [],
    ["Export Date", formatDateForExport(new Date().toISOString())],
    ["Total Sessions", sessions.length],
    ["Total Messages", sessions.reduce((sum, s) => sum + s.messages.length, 0)],
  ];
  summarySheet.addRows(summaryData);
  summarySheet.columns = [{ width: 20 }, { width: 30 }];

  // All messages in one sheet with session markers
  const allMsgSheet = workbook.addWorksheet("All Messages");
  const allRows: Record<string, unknown>[] = [];
  sessions.forEach((session, sessionIdx) => {
    session.messages.forEach((msg, msgIdx) => {
      allRows.push({
        "Session": sessionIdx + 1,
        "Session Date": formatDateForExport(session.createdAt),
        "#": msgIdx + 1,
        "Role": msg.role === "user" ? "You" : "Assistant",
        "Message": msg.content,
      });
    });
  });

  if (allRows.length > 0) {
    const headers = Object.keys(allRows[0]);
    allMsgSheet.addRow(headers);
    allRows.forEach((row) => {
      allMsgSheet.addRow(headers.map((h) => row[h]));
    });
    allMsgSheet.columns = [{ width: 8 }, { width: 18 }, { width: 5 }, { width: 10 }, { width: 100 }];
  }

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${filename}.xlsx`);
}

// ============================================
// Utility
// ============================================

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
