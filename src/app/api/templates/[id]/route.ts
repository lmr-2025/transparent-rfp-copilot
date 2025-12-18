import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional().nullable(),
  outputFormat: z.enum(["markdown", "docx", "pdf"]).optional(),
  placeholderHint: z.string().max(2000).optional().nullable(),
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

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...data,
        updatedBy: session.user.id,
      },
    });

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

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Failed to delete template", error);
    return errors.internal("Failed to delete template");
  }
}
