import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { logDocumentChange, getUserFromSession } from "@/lib/auditLog";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { CLAUDE_MODEL } from "@/lib/config";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

// GET - List all documents
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const documents = await prisma.knowledgeDocument.findMany({
      orderBy: { uploadedAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        filename: true,
        fileType: true,
        fileSize: true,
        categories: true,
        uploadedAt: true,
        description: true,
        isTemplate: true,
        ownerId: true,
        createdBy: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        // Don't include content or templateContent in list - too large
      },
    });

    return apiSuccess({ documents });
  } catch (error) {
    logger.error("Failed to fetch documents", error, { route: "/api/documents" });
    return errors.internal("Failed to fetch documents");
  }
}

// POST - Upload a new document
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const categoriesRaw = formData.get("categories") as string | null;
    let categories: string[] = [];
    if (categoriesRaw) {
      try {
        const parsed = JSON.parse(categoriesRaw);
        if (Array.isArray(parsed)) {
          categories = parsed.filter((c): c is string => typeof c === "string");
        }
      } catch {
        return errors.badRequest("Invalid categories format");
      }
    }
    const saveAsTemplate = formData.get("saveAsTemplate") === "true";

    if (!file) {
      return errors.badRequest("File is required");
    }

    // File size limit: 20MB
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return errors.badRequest("File size exceeds 20MB limit");
    }

    if (!title?.trim()) {
      return errors.badRequest("Title is required");
    }

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
    } else if (filename.endsWith(".pptx")) {
      fileType = "pptx";
    } else {
      return errors.badRequest("Unsupported file type. Please upload PDF, DOC, DOCX, PPTX, or TXT files.");
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text content based on file type
    let content: string;
    try {
      content = await extractTextContent(buffer, fileType);
    } catch (extractError) {
      logger.error("Text extraction failed", extractError, { route: "/api/documents", fileType });
      // If saving as template, text extraction is required
      if (saveAsTemplate) {
        return errors.badRequest("Failed to extract text from document. Text extraction is required for templates.");
      }
      // Otherwise, store with placeholder - document is still useful as a reference
      content = `[Text extraction failed for ${fileType.toUpperCase()} file. Document stored for reference only.]`;
    }

    // For templates, we need actual content
    if (saveAsTemplate && !content.trim()) {
      return errors.badRequest("No text content could be extracted from the document. Templates require extractable text.");
    }

    // Generate markdown template if requested
    let templateContent: string | null = null;
    if (saveAsTemplate) {
      templateContent = await generateMarkdownTemplate(content, title.trim());
    }

    // Save to database with owner info
    const document = await prisma.knowledgeDocument.create({
      data: {
        title: title.trim(),
        filename: file.name,
        fileType,
        content,
        fileSize: file.size,
        categories,
        description: description?.trim() || null,
        isTemplate: saveAsTemplate,
        templateContent,
        ownerId: auth.session.user.id,
        createdBy: auth.session.user.email || undefined,
      },
    });

    // Audit log
    await logDocumentChange(
      "CREATED",
      document.id,
      document.title,
      getUserFromSession(auth.session),
      undefined,
      { filename: file.name, fileType, fileSize: file.size, categories }
    );

    return apiSuccess({
      document: {
        id: document.id,
        title: document.title,
        filename: document.filename,
        fileType: document.fileType,
        fileSize: document.fileSize,
        categories: document.categories,
        uploadedAt: document.uploadedAt,
        description: document.description,
        contentLength: content.length,
        isTemplate: document.isTemplate,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("Failed to upload document", error, { route: "/api/documents" });
    return errors.internal("Failed to upload document");
  }
}

async function extractTextContent(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case "pdf": {
      // Dynamic import for pdf-parse (new API)
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
      // mammoth doesn't support old .doc format well
      // Try it anyway, but it may not work for all files
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
        return slides.map((slide: { id: string; text: string[] }) =>
          `--- Slide ${slide.id} ---\n${slide.text.join("\n")}`
        ).join("\n\n");
      } finally {
        // Clean up temp file
        await unlink(tempPath).catch(() => {});
      }
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

// Generate a markdown template from document content using LLM
async function generateMarkdownTemplate(content: string, title: string): Promise<string> {
  const anthropic = getAnthropicClient();

  const systemPrompt = `You are a template builder. Your job is to convert a document (like a presentation deck or report) into a reusable markdown template.

RULES:
1. Preserve the structure (slides, sections, headers)
2. Replace specific content with placeholders in [BRACKETS]
3. Keep section headers and structural elements
4. Add brief instructions where helpful
5. Use ## for slide/section headers
6. Use bullet points for content areas

PLACEHOLDER CONVENTIONS:
- [COMPANY NAME] - the vendor/product company
- [CUSTOMER NAME] - the customer this is being prepared for
- [DATE] - current date
- [SPECIFIC DETAIL] - describe what should go here
- [LIST: description] - indicate a list should be generated

OUTPUT:
Return ONLY the markdown template. Start with a title and brief instructions, then the template content.`;

  const userPrompt = `Convert this document into a reusable markdown template:

Title: ${title}

Content:
${content.slice(0, 50000)}

Return the markdown template with appropriate placeholders.`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textContent = response.content[0];
    if (textContent.type !== "text") {
      throw new Error("Unexpected response format");
    }

    return textContent.text;
  } catch (error) {
    logger.error("Failed to generate template", error, { route: "/api/documents" });
    // Fall back to returning the original content as-is with a header
    return `# ${title} Template\n\n[Template generation failed - original content below]\n\n${content}`;
  }
}
