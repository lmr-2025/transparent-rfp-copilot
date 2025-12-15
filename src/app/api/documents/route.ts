import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { logDocumentChange, getUserFromSession } from "@/lib/auditLog";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { CLAUDE_MODEL } from "@/lib/config";

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
        // Don't include content or templateContent in list - too large
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
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
    const categories = categoriesRaw ? JSON.parse(categoriesRaw) as string[] : [];
    const saveAsTemplate = formData.get("saveAsTemplate") === "true";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
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
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOC, DOCX, PPTX, or TXT files." },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text content based on file type
    let content: string;
    try {
      content = await extractTextContent(buffer, fileType);
    } catch (extractError) {
      console.error("Text extraction failed:", extractError);
      return NextResponse.json(
        { error: "Failed to extract text from document. Please ensure the file is not corrupted." },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: "No text content could be extracted from the document." },
        { status: 400 }
      );
    }

    // Generate markdown template if requested
    let templateContent: string | null = null;
    if (saveAsTemplate) {
      templateContent = await generateMarkdownTemplate(content, title.trim());
    }

    // Save to database
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Failed to upload document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
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
    console.error("Failed to generate template:", error);
    // Fall back to returning the original content as-is with a header
    return `# ${title} Template\n\n[Template generation failed - original content below]\n\n${content}`;
  }
}
