import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { logDocumentChange, getUserFromSession } from "@/lib/auditLog";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { CLAUDE_MODEL } from "@/lib/config";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { cacheGetOrSet, cacheDeletePattern } from "@/lib/cache";

export const maxDuration = 60;

const DOCUMENTS_CACHE_KEY_PREFIX = "cache:documents";
const DOCUMENTS_TTL = 1800; // 30 minutes

// GET - List all documents with skill usage counts
// Categories are derived dynamically from linked skills via SkillSource
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const category = searchParams.get("category");

    // Create cache key based on query parameters
    const cacheKey = `${DOCUMENTS_CACHE_KEY_PREFIX}:${JSON.stringify({ limit, offset, category })}`;

    // Use Redis caching with 30 min TTL
    const documentsWithData = await cacheGetOrSet(
      cacheKey,
      DOCUMENTS_TTL,
      async () => {
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

    // Get all SkillSource links for these documents with their skill categories
    const docIds = documents.map((d) => d.id);
    const skillSources = await prisma.skillSource.findMany({
      where: {
        sourceId: { in: docIds },
        sourceType: "document",
      },
      include: {
        skill: {
          select: { id: true, categories: true },
        },
      },
    });

    // Build a map of document ID -> derived categories (union of all linked skills' categories)
    const categoryMap = new Map<string, Set<string>>();
    const countMap = new Map<string, number>();

    for (const ss of skillSources) {
      // Count skills per document
      countMap.set(ss.sourceId, (countMap.get(ss.sourceId) || 0) + 1);

      // Aggregate categories from linked skills
      if (!categoryMap.has(ss.sourceId)) {
        categoryMap.set(ss.sourceId, new Set());
      }
      const catSet = categoryMap.get(ss.sourceId)!;
      for (const cat of ss.skill.categories) {
        catSet.add(cat);
      }
    }

        // Add skillCount and derived categories to each document
        let docsWithData = documents.map((doc) => ({
          ...doc,
          skillCount: countMap.get(doc.id) || 0,
          // Derived categories from linked skills (falls back to stored categories if none linked)
          categories: categoryMap.has(doc.id)
            ? Array.from(categoryMap.get(doc.id)!)
            : doc.categories,
        }));

        // Filter by category if provided (now filtering on derived categories)
        if (category) {
          docsWithData = docsWithData.filter((doc) => doc.categories.includes(category));
        }

        return docsWithData;
      }
    );

    // Add HTTP caching - documents are fairly stable
    const response = apiSuccess({ documents: documentsWithData });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600'
    );
    return response;
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
      const errorMessage = extractError instanceof Error ? extractError.message : "Unknown error";
      logger.error("Text extraction failed", extractError, { route: "/api/documents", fileType, errorMessage });
      // If saving as template, text extraction is required
      if (saveAsTemplate) {
        return errors.badRequest(`Failed to extract text from document: ${errorMessage}`);
      }
      // Otherwise, store with placeholder - document is still useful as a reference
      content = `[Text extraction failed for ${fileType.toUpperCase()} file: ${errorMessage}. Document stored for reference only.]`;
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
    // Store original file data for PDFs to enable native Claude document support
    const document = await prisma.knowledgeDocument.create({
      data: {
        title: title.trim(),
        filename: file.name,
        fileType,
        content,
        fileData: fileType === "pdf" ? buffer : null, // Store original PDF for native Claude support
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

    // Invalidate cache
    await cacheDeletePattern(`${DOCUMENTS_CACHE_KEY_PREFIX}:*`);

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
        content, // Include content for bulk import use case
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("Failed to upload document", error, { route: "/api/documents" });
    return errors.internal("Failed to upload document");
  }
}

// Extract text from PDF using Claude's native document support
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

// Sanitize extracted text to remove problematic characters
function sanitizeExtractedText(text: string): string {
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

async function extractTextContent(buffer: Buffer, fileType: string): Promise<string> {
  let rawText: string;

  switch (fileType) {
    case "pdf": {
      // Use Claude's native PDF support for reliable extraction
      rawText = await extractPdfWithClaude(buffer);
      break;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
      break;
    }
    case "doc": {
      // mammoth doesn't support old .doc format well
      // Try it anyway, but it may not work for all files
      try {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
        break;
      } catch {
        throw new Error("Old .doc format not fully supported. Please convert to .docx");
      }
    }
    case "txt": {
      rawText = buffer.toString("utf-8");
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
        break;
      } finally {
        // Clean up temp file
        await unlink(tempPath).catch(() => {});
      }
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  // Sanitize the extracted text to remove problematic characters
  return sanitizeExtractedText(rawText);
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
