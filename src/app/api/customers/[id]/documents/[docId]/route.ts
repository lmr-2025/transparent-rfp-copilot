import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string; docId: string }>;
}

// GET /api/customers/[id]/documents/[docId] - Get a single document with content
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: customerId, docId } = params;

    const document = await prisma.customerDocument.findFirst({
      where: {
        id: docId,
        customerId, // Ensure document belongs to this customer
      },
    });

    if (!document) {
      return errors.notFound("Customer document");
    }

    return apiSuccess({ document });
  } catch (error) {
    logger.error("Failed to fetch customer document", error, { route: "/api/customers/[id]/documents/[docId]" });
    return errors.internal("Failed to fetch customer document");
  }
}

// PUT /api/customers/[id]/documents/[docId] - Update document metadata
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: customerId, docId } = params;
    const body = await request.json();

    // Verify document exists and belongs to this customer
    const existing = await prisma.customerDocument.findFirst({
      where: {
        id: docId,
        customerId,
      },
    });

    if (!existing) {
      return errors.notFound("Customer document");
    }

    const { title, description, docType } = body;

    const document = await prisma.customerDocument.update({
      where: { id: docId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(docType !== undefined && { docType: docType?.trim() || null }),
      },
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
      },
    });

    return apiSuccess({ document });
  } catch (error) {
    logger.error("Failed to update customer document", error, { route: "/api/customers/[id]/documents/[docId]" });
    return errors.internal("Failed to update customer document");
  }
}

// DELETE /api/customers/[id]/documents/[docId] - Delete a document
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: customerId, docId } = params;

    // Verify document exists and belongs to this customer
    const existing = await prisma.customerDocument.findFirst({
      where: {
        id: docId,
        customerId,
      },
    });

    if (!existing) {
      return errors.notFound("Customer document");
    }

    await prisma.customerDocument.delete({
      where: { id: docId },
    });

    return apiSuccess({ message: "Document deleted successfully" });
  } catch (error) {
    logger.error("Failed to delete customer document", error, { route: "/api/customers/[id]/documents/[docId]" });
    return errors.internal("Failed to delete customer document");
  }
}
