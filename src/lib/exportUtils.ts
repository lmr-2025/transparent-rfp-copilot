import * as XLSX from "xlsx";
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

export function exportQuestionLog(
  entries: QuestionLogEntry[],
  options: Partial<QuestionLogExportOptions> = {}
): void {
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
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Question Log");
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${filename}.csv`);
    return;
  }

  // Excel format
  const wb = XLSX.utils.book_new();

  // Summary sheet
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
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Data sheet
  const dataSheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const colWidths = [
    { wch: 18 }, // Date
    { wch: 14 }, // Source
    { wch: 25 }, // Project
    { wch: 20 }, // Customer
    { wch: 60 }, // Question
    { wch: 80 }, // Response
    { wch: 12 }, // Status
    { wch: 12 }, // Confidence
  ];
  if (opts.includeTransparency) {
    colWidths.push({ wch: 50 }, { wch: 30 }, { wch: 40 });
  }
  if (opts.includeMetadata) {
    colWidths.push({ wch: 20 }, { wch: 20 });
  }
  dataSheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, dataSheet, "Questions");

  XLSX.writeFile(wb, `${filename}.xlsx`);
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

export function exportChatSession(
  session: ChatSession,
  options: Partial<ChatExportOptions> = {}
): void {
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
  const wb = XLSX.utils.book_new();

  // Metadata sheet
  if (opts.includeMetadata) {
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
    const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
    metaSheet["!cols"] = [{ wch: 15 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, metaSheet, "Info");
  }

  // Messages sheet
  const messageRows = session.messages.map((msg, idx) => ({
    "#": idx + 1,
    "Role": msg.role === "user" ? "You" : "Assistant",
    "Message": msg.content,
    "Timestamp": msg.timestamp ? formatDateForExport(msg.timestamp) : "",
  }));
  const msgSheet = XLSX.utils.json_to_sheet(messageRows);
  msgSheet["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 100 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, msgSheet, "Messages");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Export multiple chat sessions
export function exportChatHistory(
  sessions: ChatSession[],
  options: Partial<ChatExportOptions> = {}
): void {
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
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["Chat History Export"],
    [],
    ["Export Date", formatDateForExport(new Date().toISOString())],
    ["Total Sessions", sessions.length],
    ["Total Messages", sessions.reduce((sum, s) => sum + s.messages.length, 0)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // All messages in one sheet with session markers
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
  const allMsgSheet = XLSX.utils.json_to_sheet(allRows);
  allMsgSheet["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 5 }, { wch: 10 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, allMsgSheet, "All Messages");

  XLSX.writeFile(wb, `${filename}.xlsx`);
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
