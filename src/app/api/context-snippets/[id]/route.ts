import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { updateContextSnippetSchema, validateBody } from "@/lib/validations";
import { logContextSnippetChange, getUserFromSession, computeChanges } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/context-snippets/[id] - Get a single context snippet
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    const snippet = await prisma.contextSnippet.findUnique({
      where: { id },
    });

    if (!snippet) {
      return errors.notFound("Context snippet");
    }

    return apiSuccess({ snippet });
  } catch (error) {
    logger.error("Failed to fetch context snippet", error, { route: "/api/context-snippets/[id]" });
    return errors.internal("Failed to fetch context snippet");
  }
}

// PUT /api/context-snippets/[id] - Update a context snippet
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const validation = validateBody(updateContextSnippetSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    // Get existing snippet for audit log
    const existing = await prisma.contextSnippet.findUnique({ where: { id } });
    if (!existing) {
      return errors.notFound("Context snippet");
    }

    // Check for duplicate key if key is being changed
    if (data.key && data.key !== existing.key) {
      const duplicateKey = await prisma.contextSnippet.findUnique({
        where: { key: data.key },
      });
      if (duplicateKey) {
        return errors.conflict(`A snippet with key "${data.key}" already exists`);
      }
    }

    const snippet = await prisma.contextSnippet.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.key !== undefined && { key: data.key }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      snippet as unknown as Record<string, unknown>,
      ["name", "key", "content", "category", "description", "isActive"]
    );

    // Audit log
    await logContextSnippetChange(
      "UPDATED",
      snippet.id,
      snippet.name,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

    return apiSuccess({ snippet });
  } catch (error) {
    logger.error("Failed to update context snippet", error, { route: "/api/context-snippets/[id]" });
    return errors.internal("Failed to update context snippet");
  }
}

// DELETE /api/context-snippets/[id] - Delete a context snippet
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    // Get snippet before deleting for audit log
    const snippet = await prisma.contextSnippet.findUnique({ where: { id } });
    if (!snippet) {
      return errors.notFound("Context snippet");
    }

    await prisma.contextSnippet.delete({
      where: { id },
    });

    // Audit log
    await logContextSnippetChange(
      "DELETED",
      id,
      snippet.name,
      getUserFromSession(auth.session),
      undefined,
      { deletedSnippet: { key: snippet.key, category: snippet.category } }
    );

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete context snippet", error, { route: "/api/context-snippets/[id]" });
    return errors.internal("Failed to delete context snippet");
  }
}
