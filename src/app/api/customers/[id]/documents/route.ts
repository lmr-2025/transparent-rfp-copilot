import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/customers/[id]/documents - List documents for a customer
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Access control: User must be owner OR have MANAGE_KNOWLEDGE/VIEW_ORG_DATA/ADMIN capability
    const userCapabilities = auth.session.user.capabilities || [];
    const isOwner = customer.ownerId === auth.session.user.id;
    const hasOrgAccess = userCapabilities.some((cap: string) =>
      ["ADMIN", "VIEW_ORG_DATA", "MANAGE_KNOWLEDGE"].includes(cap)
    );

    if (!isOwner && !hasOrgAccess) {
      return errors.forbidden("You do not have access to this customer's documents");
    }

    const documents = await prisma.customerDocument.findMany({
      where: { customerId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        filename: true,
        fileType: true,
        fileSize: true,
        description: true,
        uploadedAt: true,
        uploadedBy: true,
        docType: true,
        // Don't include content in list - too large
      },
    });

    return apiSuccess({ documents, customer: { id: customer.id, name: customer.name } });
  } catch (error) {
    logger.error("Failed to fetch customer documents", error, { route: "/api/customers/[id]/documents" });
    return errors.internal("Failed to fetch customer documents");
  }
}

// POST /api/customers/[id]/documents - Upload a document for a customer
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

    // Access control: User must be owner OR have MANAGE_KNOWLEDGE/ADMIN capability to upload
    const userCapabilities = auth.session.user.capabilities || [];
    const isOwner = customer.ownerId === auth.session.user.id;
    const hasWriteAccess = userCapabilities.some((cap: string) =>
      ["ADMIN", "MANAGE_KNOWLEDGE"].includes(cap)
    );

    if (!isOwner && !hasWriteAccess) {
      return errors.forbidden("You do not have permission to upload documents to this customer");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const docType = formData.get("docType") as string | null;

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
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      fileType = "xlsx";
    } else if (filename.endsWith(".pptx")) {
      fileType = "pptx";
    } else {
      return errors.badRequest("Unsupported file type. Please upload PDF, DOC, DOCX, XLSX, PPTX, or TXT files.");
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text content based on file type
    let content: string;
    try {
      content = await extractTextContent(buffer, fileType);
    } catch (extractError) {
      logger.error("Text extraction failed", extractError, { route: "/api/customers/[id]/documents", fileType });
      // Store with placeholder - document is still useful as a reference
      content = `[Text extraction failed for ${fileType.toUpperCase()} file. Document stored for reference only.]`;
    }

    // Save to database
    const document = await prisma.customerDocument.create({
      data: {
        customerId,
        title: title.trim(),
        filename: file.name,
        fileType,
        content,
        fileSize: file.size,
        description: description?.trim() || null,
        uploadedBy: auth.session.user.email || undefined,
        docType: docType?.trim() || null,
      },
    });

    return apiSuccess({
      document: {
        id: document.id,
        title: document.title,
        filename: document.filename,
        fileType: document.fileType,
        fileSize: document.fileSize,
        description: document.description,
        uploadedAt: document.uploadedAt,
        uploadedBy: document.uploadedBy,
        docType: document.docType,
        contentLength: content.length,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("Failed to upload customer document", error, { route: "/api/customers/[id]/documents" });
    return errors.internal("Failed to upload customer document");
  }
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
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        return `--- Sheet: ${name} ---\n${csv}`;
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
