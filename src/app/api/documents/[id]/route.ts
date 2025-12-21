import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logDocumentChange, getUserFromSession, computeChanges } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET - Get a single document (with content)
// Categories are derived dynamically from linked skills via SkillSource
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await prisma.knowledgeDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return errors.notFound("Document not found");
    }

    // Get SkillSource links for this document with their skill categories
    const skillSources = await prisma.skillSource.findMany({
      where: {
        sourceId: id,
        sourceType: "document",
      },
      include: {
        skill: {
          select: { id: true, categories: true },
        },
      },
    });

    // Compute skillCount and derived categories
    const skillCount = skillSources.length;
    const derivedCategories = new Set<string>();
    for (const ss of skillSources) {
      for (const cat of ss.skill.categories) {
        derivedCategories.add(cat);
      }
    }

    // Return document with derived data
    return apiSuccess({
      document: {
        ...document,
        skillCount,
        // Derived categories from linked skills (falls back to stored categories if none linked)
        categories: derivedCategories.size > 0
          ? Array.from(derivedCategories)
          : document.categories,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch document", error, { route: "/api/documents/[id]" });
    return errors.internal("Failed to fetch document");
  }
}

// DELETE - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;

    // Get document before deleting for audit log
    const document = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!document) {
      return errors.notFound("Document not found");
    }

    await prisma.knowledgeDocument.delete({
      where: { id },
    });

    // Audit log
    await logDocumentChange(
      "DELETED",
      id,
      document.title,
      getUserFromSession(auth.session),
      undefined,
      { deletedDocument: { title: document.title, filename: document.filename } }
    );

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete document", error, { route: "/api/documents/[id]" });
    return errors.internal("Failed to delete document");
  }
}

// PATCH - Update document metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, categories, isReferenceOnly } = body;

    // Get existing document for audit log
    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      return errors.notFound("Document not found");
    }

    const document = await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(categories !== undefined && { categories }),
        ...(isReferenceOnly !== undefined && { isReferenceOnly }),
      },
    });

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      document as unknown as Record<string, unknown>,
      ["title", "description", "categories", "isReferenceOnly"]
    );

    // Audit log
    await logDocumentChange(
      "UPDATED",
      document.id,
      document.title,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
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
        isReferenceOnly: document.isReferenceOnly,
      },
    });
  } catch (error) {
    logger.error("Failed to update document", error, { route: "/api/documents/[id]" });
    return errors.internal("Failed to update document");
  }
}
