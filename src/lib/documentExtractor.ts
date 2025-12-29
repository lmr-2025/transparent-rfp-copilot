/**
 * Shared document text extraction utilities
 * Used by: /api/documents, /api/customers/[id]/documents, /api/customers/[id]/documents/batch
 */

import * as mammoth from "mammoth";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { CLAUDE_MODEL } from "@/lib/config";

export type SupportedFileType = "pdf" | "docx" | "doc" | "txt" | "xlsx" | "pptx";

/**
 * Detect file type from filename
 * @returns file type or null if unsupported
 */
export function detectFileType(filename: string): SupportedFileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".doc")) return "doc";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (lower.endsWith(".pptx")) return "pptx";
  return null;
}

/**
 * Get human-readable list of supported file types
 */
export function getSupportedFileTypesDescription(): string {
  return "PDF, DOC, DOCX, PPTX, XLSX, or TXT";
}

/**
 * Sanitize extracted text to remove problematic characters
 */
export function sanitizeExtractedText(text: string): string {
  return text
    // Remove null bytes and other control characters (except newline, tab, carriage return)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize multiple spaces to single space
    .replace(/[^\S\n]+/g, " ")
    // Normalize multiple newlines to max 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Extract text from PDF using Claude's native document support
 * Better for complex PDFs with tables, images with text, etc.
 */
export async function extractPdfWithClaude(buffer: Buffer): Promise<string> {
  const anthropic = getAnthropicClient();
  const base64Data = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
          },
          {
            type: "text",
            text: `Extract ALL text content from this PDF document.

IMPORTANT RULES:
1. Extract the complete text content, preserving the document structure
2. Include headers, paragraphs, bullet points, tables, and any other text
3. Preserve the logical reading order
4. For tables, format them clearly with columns separated by | characters
5. Do NOT summarize or interpret - extract the actual text verbatim
6. Do NOT add any commentary or explanations
7. If there are multiple pages, extract all pages

Return ONLY the extracted text content, nothing else.`,
          },
        ],
      },
    ],
  });

  const textContent = response.content[0];
  if (textContent.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  if (!textContent.text || textContent.text.trim().length === 0) {
    throw new Error("PDF appears to be image-based or contains no extractable text");
  }

  return textContent.text;
}

/**
 * Extract text content from a document buffer
 *
 * @param buffer - File buffer
 * @param fileType - Detected file type
 * @param options - Extraction options
 * @returns Extracted text content
 */
export async function extractTextContent(
  buffer: Buffer,
  fileType: SupportedFileType,
  options: {
    useClaude?: boolean; // Use Claude for PDF extraction (more accurate but costs tokens)
    sanitize?: boolean;  // Sanitize output text (default: true)
  } = {}
): Promise<string> {
  const { useClaude = false, sanitize = true } = options;
  let rawText: string;

  switch (fileType) {
    case "pdf": {
      if (useClaude) {
        rawText = await extractPdfWithClaude(buffer);
      } else {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        rawText = textResult.text;
      }
      break;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
      break;
    }
    case "doc": {
      // mammoth doesn't support old .doc format well
      try {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
      } catch {
        throw new Error("Old .doc format not fully supported. Please convert to .docx");
      }
      break;
    }
    case "txt": {
      rawText = buffer.toString("utf-8");
      break;
    }
    case "xlsx": {
      try {
        // Use require-style import for better compatibility with Next.js bundling
        const ExcelJS = await import("exceljs");
        const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
        if (!Workbook) {
          throw new Error("Could not load ExcelJS Workbook class");
        }
        const workbook = new Workbook();
        // ExcelJS can load directly from Node Buffer
        // Cast to ArrayBuffer to satisfy ExcelJS type requirements
        await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
        const sheets = workbook.worksheets.map((worksheet) => {
          const csvRows: string[] = [];
          worksheet.eachRow((row) => {
            const values = row.values as unknown[];
            // row.values starts at index 1 (Excel is 1-indexed), so slice off the empty first element
            csvRows.push(values.slice(1).map((v) => String(v ?? "")).join(","));
          });
          const csv = csvRows.join("\n");
          return `--- Sheet: ${worksheet.name} ---\n${csv}`;
        });
        rawText = sheets.join("\n\n");
      } catch (xlsxError) {
        console.error("[documentExtractor] Excel parsing error:", xlsxError);
        throw new Error(`Failed to parse Excel file: ${xlsxError instanceof Error ? xlsxError.message : "Unknown error"}`);
      }
      break;
    }
    case "pptx": {
      const { writeFile, unlink } = await import("fs/promises");
      const { tmpdir } = await import("os");
      const { join } = await import("path");
      const { randomUUID } = await import("crypto");
      const PptxParser = (await import("node-pptx-parser")).default;

      // Write buffer to temp file (library requires file path)
      const tempPath = join(tmpdir(), `pptx-${randomUUID()}.pptx`);
      await writeFile(tempPath, buffer);

      try {
        const parser = new PptxParser(tempPath);
        const slides = await parser.extractText();
        rawText = slides.map((slide: { id: string; text: string[] }) =>
          `--- Slide ${slide.id} ---\n${slide.text.join("\n")}`
        ).join("\n\n");
      } finally {
        // Clean up temp file
        await unlink(tempPath).catch(() => {});
      }
      break;
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  return sanitize ? sanitizeExtractedText(rawText) : rawText;
}
