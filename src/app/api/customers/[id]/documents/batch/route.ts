import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  detectFileType,
  extractTextContent,
} from "@/lib/documentExtractor";

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
        const fileType = detectFileType(file.name);
        if (!fileType) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract text content - use Claude for PDFs if processing for content
        let content: string;
        try {
          content = await extractTextContent(buffer, fileType, {
            useClaude: shouldProcessContent && fileType === "pdf",
          });
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
