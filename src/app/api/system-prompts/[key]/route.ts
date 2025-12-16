import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { createAuditLog, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ key: string }>;
};

// GET /api/system-prompts/[key] - Get a system prompt by key
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { key } = await context.params;

    const prompt = await prisma.systemPrompt.findUnique({
      where: { key },
    });

    if (!prompt) {
      return errors.notFound("System prompt");
    }

    return apiSuccess({ prompt });
  } catch (error) {
    logger.error("Failed to fetch system prompt", error, { route: "/api/system-prompts/[key]" });
    return errors.internal("Failed to fetch system prompt");
  }
}

// PUT /api/system-prompts/[key] - Update or create a system prompt
// Admin-only: System prompts control LLM behavior
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { key } = await context.params;
    const body = await request.json();

    // Check if it exists (for audit log action type)
    const existing = await prisma.systemPrompt.findUnique({ where: { key } });
    const isCreate = !existing;

    const prompt = await prisma.systemPrompt.upsert({
      where: { key },
      create: {
        key,
        name: body.name || key,
        sections: body.sections,
        updatedBy: auth.session.user.email || auth.session.user.id,
      },
      update: {
        name: body.name,
        sections: body.sections,
        updatedBy: auth.session.user.email || auth.session.user.id,
      },
    });

    // Audit log
    await createAuditLog({
      entityType: "PROMPT",
      entityId: key,
      entityTitle: prompt.name,
      action: isCreate ? "CREATED" : "UPDATED",
      user: getUserFromSession(auth.session),
      metadata: {
        sectionCount: Array.isArray(body.sections) ? body.sections.length : 0,
      },
    });

    return apiSuccess({ prompt });
  } catch (error) {
    logger.error("Failed to update system prompt", error, { route: "/api/system-prompts/[key]" });
    return errors.internal("Failed to update system prompt");
  }
}

// DELETE /api/system-prompts/[key] - Delete a system prompt
// Admin-only: System prompts control LLM behavior
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { key } = await context.params;

    // Get prompt for audit log
    const prompt = await prisma.systemPrompt.findUnique({ where: { key } });

    if (!prompt) {
      return errors.notFound("System prompt");
    }

    await prisma.systemPrompt.delete({
      where: { key },
    });

    // Audit log
    await createAuditLog({
      entityType: "PROMPT",
      entityId: key,
      entityTitle: prompt.name,
      action: "DELETED",
      user: getUserFromSession(auth.session),
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete system prompt", error, { route: "/api/system-prompts/[key]" });
    return errors.internal("Failed to delete system prompt");
  }
}
