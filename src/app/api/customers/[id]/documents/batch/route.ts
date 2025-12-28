import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { CLAUDE_MODEL } from "@/lib/config";

export const maxDuration = 120; // 2 minutes for batch processing

interface RouteContext {
  params: Promise<{ id: string }>;
}

type UploadedDocumentSummary = {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  content: string | null;
  processedForContent: boolean;
};

/**
 * POST /api/customers/[id]/documents/batch
 * Upload multiple documents in a single request with options to process for profile content
 *
 * FormData fields:
 * - files: File[] - Array of files to upload
 * - processForContent: string (JSON array of booleans) - Whether to extract content for each file
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: customerId } = params;

    // Verify customer exists and user has access
    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!customer) {
      return errors.notFound("Customer profile");
    }

    // Access control
    const userCapabilities = auth.session.user.capabilities || [];
    const isOwner = customer.ownerId === auth.session.user.id;
    const hasWriteAccess = userCapabilities.some((cap: string) =>
      ["ADMIN", "MANAGE_KNOWLEDGE"].includes(cap)
    );

    if (!isOwner && !hasWriteAccess) {
      return errors.forbidden("You do not have permission to upload documents to this customer");
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const processForContentStr = formData.get("processForContent") as string | null;

    let processForContent: boolean[] = [];
    if (processForContentStr) {
      try {
        processForContent = JSON.parse(processForContentStr);
      } catch {
        return errors.badRequest("Invalid processForContent format");
      }
    }

    if (!files || files.length === 0) {
      return errors.badRequest("No files provided");
    }

    // File size limit: 20MB per file
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return errors.badRequest(`File ${file.name} exceeds 20MB limit`);
      }
    }

    // Process all files in parallel
    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        const shouldProcessContent = processForContent[index] ?? false;

        // Determine file type
        const filename = file.name.toLowerCase();
        let fileType: string;
        if (filename.endsWith(".pdf")) {
          fileType = "pdf";
        } else if (filename.endsWith(".docx")) {
          fileType = "docx";
        } else if (filename.endsWith(".doc")) {
          fileType = "doc";
        } else if (filename.endsWith(".txt")) {
          fileType = "txt";
        } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
          fileType = "xlsx";
        } else if (filename.endsWith(".pptx")) {
          fileType = "pptx";
        } else {
          throw new Error(`Unsupported file type: ${file.name}`);
        }

        // Read file buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Extract text content - use Claude for PDFs if processing for content, otherwise use pdf-parse
        let content: string;
        try {
          if (shouldProcessContent && fileType === "pdf") {
            content = await extractPdfWithClaude(buffer);
          } else {
            content = await extractTextContent(buffer, fileType);
          }
        } catch (extractError) {
          logger.error("Text extraction failed", extractError, {
            route: "/api/customers/[id]/documents/batch",
            fileType,
            filename: file.name
          });
          content = `[Text extraction failed for ${fileType.toUpperCase()} file. Document stored for reference only.]`;
        }

        // Save to database
        const document = await prisma.customerDocument.create({
          data: {
            customerId,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            filename: file.name,
            fileType,
            content,
            fileSize: file.size,
            uploadedBy: auth.session.user.email || undefined,
          },
        });

        return {
          id: document.id,
          title: document.title,
          filename: document.filename,
          fileType: document.fileType,
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
          content: shouldProcessContent ? content : null, // Only return content if requested for processing
          processedForContent: shouldProcessContent,
        };
      })
    );

    // Separate successful and failed uploads
    const successful: UploadedDocumentSummary[] = [];
    const failed: { filename: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successful.push(result.value);
      } else {
        failed.push({
          filename: files[index].name,
          error: result.reason?.message || "Unknown error",
        });
      }
    });

    return apiSuccess({
      documents: successful,
      failed,
      summary: {
        total: files.length,
        successful: successful.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    logger.error("Failed to batch upload documents", error, { route: "/api/customers/[id]/documents/batch" });
    return errors.internal("Failed to batch upload documents");
  }
}

// Extract text from PDF using Claude's native document support (for profile content)
async function extractPdfWithClaude(buffer: Buffer): Promise<string> {
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

async function extractTextContent(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      return textResult.text;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "doc": {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch {
        throw new Error("Old .doc format not fully supported. Please convert to .docx");
      }
    }
    case "txt": {
      return buffer.toString("utf-8");
    }
    case "xlsx": {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheets = workbook.worksheets.map((worksheet) => {
        const csvRows: string[] = [];
        worksheet.eachRow((row) => {
          const values = row.values as unknown[];
          csvRows.push(values.slice(1).map((v) => String(v ?? "")).join(","));
        });
        const csv = csvRows.join("\n");
        return `--- Sheet: ${worksheet.name} ---\n${csv}`;
      });
      return sheets.join("\n\n");
    }
    case "pptx": {
      const { writeFile, unlink } = await import("fs/promises");
      const { tmpdir } = await import("os");
      const { join } = await import("path");
      const { randomUUID } = await import("crypto");
      const PptxParser = (await import("node-pptx-parser")).default;

      const tempPath = join(tmpdir(), `pptx-${randomUUID()}.pptx`);
      await writeFile(tempPath, buffer);

      try {
        const parser = new PptxParser(tempPath);
        const slides = await parser.extractText();
        return slides.map((slide: { id: string; text: string[] }) =>
          `--- Slide ${slide.id} ---\n${slide.text.join("\n")}`
        ).join("\n\n");
      } finally {
        await unlink(tempPath).catch(() => {});
      }
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
