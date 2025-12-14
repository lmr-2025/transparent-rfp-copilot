import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logDocumentChange, getUserFromSession, computeChanges } from "@/lib/auditLog";

// GET - Get a single document (with content)
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
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
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
    const { title, description, categories } = body;

    // Get existing document for audit log
    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const document = await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(categories !== undefined && { categories }),
      },
    });

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      document as unknown as Record<string, unknown>,
      ["title", "description", "categories"]
    );

    // Audit log
    await logDocumentChange(
      "UPDATED",
      document.id,
      document.title,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
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
      },
    });
  } catch (error) {
    console.error("Failed to update document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}
