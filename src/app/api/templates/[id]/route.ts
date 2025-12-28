import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import { getTemplateSlug } from "@/lib/templateFiles";
import { updateTemplateAndCommit, deleteTemplateAndCommit } from "@/lib/templateGitSync";
import { withTemplateSyncLogging } from "@/lib/templateSyncLog";
import type { TemplateFile, PlaceholderMapping } from "@/lib/templateFiles";
import { logTemplateChange, getUserFromSession, computeChanges, getRequestContext } from "@/lib/auditLog";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional().nullable(),
  outputFormat: z.enum(["markdown", "docx", "pdf"]).optional(),
  placeholderHint: z.string().max(2000).optional().nullable(),
  instructionPresetId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/templates/[id] - Get a single template
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { id } = await context.params;

    const template = await prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return errors.notFound("Template not found");
    }

    return apiSuccess(template);
  } catch (error) {
    logger.error("Failed to get template", error);
    return errors.internal("Failed to get template");
  }
}

// PATCH /api/templates/[id] - Update a template
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { id } = await context.params;

    // Check if template exists
    const existing = await prisma.template.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Template not found");
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest("Invalid JSON body");
    }

    const validation = validateBody(updateTemplateSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    const userEmail = session.user.email || "unknown";
    const userName = session.user.name || userEmail;

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userEmail,
      },
    });

    // Commit to git
    try {
      const oldSlug = getTemplateSlug(existing.name);

      const templateFile: TemplateFile = {
        id: template.id,
        slug: getTemplateSlug(template.name),
        name: template.name,
        description: template.description || undefined,
        content: template.content,
        category: template.category || undefined,
        outputFormat: (template.outputFormat as "markdown" | "docx" | "pdf") || "markdown",
        placeholderMappings: (template.placeholderMappings as unknown as PlaceholderMapping[]) || [],
        instructionPresetId: template.instructionPresetId || undefined,
        isActive: template.isActive,
        sortOrder: template.sortOrder,
        created: template.createdAt.toISOString(),
        updated: template.updatedAt.toISOString(),
        createdBy: template.createdBy || undefined,
        updatedBy: userEmail,
      };

      await withTemplateSyncLogging(
        {
          templateId: template.id,
          operation: "update",
          direction: "db-to-git",
          syncedBy: session.user.id,
        },
        async () => {
          const commitSha = await updateTemplateAndCommit(
            oldSlug,
            templateFile,
            `Update template: ${template.name}`,
            { name: userName, email: userEmail }
          );
          logger.info("Template update committed to git", { templateId: template.id, commitSha });
          return commitSha;
        }
      );
    } catch (gitError) {
      // Log git error but don't fail the request
      logger.error("Failed to commit template update to git", gitError, {
        templateId: template.id,
        name: template.name,
      });
    }

    // Audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      template as unknown as Record<string, unknown>,
      ["name", "description", "content", "category", "outputFormat", "isActive", "sortOrder"]
    );

    await logTemplateChange(
      "UPDATED",
      template.id,
      template.name,
      getUserFromSession(session),
      Object.keys(changes).length > 0 ? changes : undefined,
      undefined,
      getRequestContext(request)
    );

    return apiSuccess(template);
  } catch (error) {
    logger.error("Failed to update template", error);
    return errors.internal("Failed to update template");
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { id } = await context.params;

    // Check if template exists
    const existing = await prisma.template.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Template not found");
    }

    await prisma.template.delete({
      where: { id },
    });

    // Delete from git
    try {
      const slug = getTemplateSlug(existing.name);
      const userEmail = session.user.email || "unknown";
      const userName = session.user.name || userEmail;

      await withTemplateSyncLogging(
        {
          templateId: existing.id,
          operation: "delete",
          direction: "db-to-git",
          syncedBy: session.user.id,
        },
        async () => {
          const commitSha = await deleteTemplateAndCommit(
            slug,
            `Delete template: ${existing.name}`,
            { name: userName, email: userEmail }
          );
          logger.info("Template deletion committed to git", { templateId: existing.id, slug, commitSha });
          return commitSha;
        }
      );
    } catch (gitError) {
      // Log git error but don't fail the request
      logger.error("Failed to commit template deletion to git", gitError, {
        templateId: existing.id,
        name: existing.name,
      });
    }

    // Audit log
    await logTemplateChange(
      "DELETED",
      existing.id,
      existing.name,
      getUserFromSession(session),
      undefined,
      { deletedTemplate: { name: existing.name, category: existing.category } },
      getRequestContext(request)
    );

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete template", error);
    return errors.internal("Failed to delete template");
  }
}
