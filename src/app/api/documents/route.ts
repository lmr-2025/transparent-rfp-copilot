import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as mammoth from "mammoth";

const prisma = new PrismaClient();

export const maxDuration = 60;

// GET - List all documents
export async function GET() {
  try {
    const documents = await prisma.knowledgeDocument.findMany({
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        filename: true,
        fileType: true,
        fileSize: true,
        uploadedAt: true,
        description: true,
        // Don't include content in list - it's too large
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
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
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
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files." },
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

    // Save to database
    const document = await prisma.knowledgeDocument.create({
      data: {
        title: title.trim(),
        filename: file.name,
        fileType,
        content,
        fileSize: file.size,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        filename: document.filename,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt,
        description: document.description,
        contentLength: content.length,
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
      // Dynamic import for pdf-parse
      const pdfParseModule = await import("pdf-parse");
      // Handle both ESM and CJS module formats
      const pdfParse = typeof pdfParseModule === "function"
        ? pdfParseModule
        : (pdfParseModule as { default?: unknown }).default || pdfParseModule;
      const pdfData = await (pdfParse as (buffer: Buffer) => Promise<{ text: string }>)(buffer);
      return pdfData.text;
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
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
