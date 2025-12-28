import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import { logTemplateChange, getUserFromSession, getRequestContext } from "@/lib/auditLog";

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  content: z.string().min(1, "Content is required"),
  category: z.string().max(100).optional(),
  outputFormat: z.enum(["markdown", "docx", "pdf"]).optional().default("markdown"),
  placeholderHint: z.string().max(2000).optional(),
  instructionPresetId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

// GET /api/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const where: { category?: string; isActive?: boolean } = {};
    if (category) {
      where.category = category;
    }
    if (activeOnly) {
      where.isActive = true;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        category: true,
        outputFormat: true,
        instructionPresetId: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess(templates);
  } catch (error) {
    logger.error("Failed to list templates", error);
    return errors.internal("Failed to list templates");
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest("Invalid JSON body");
    }

    const validation = validateBody(createTemplateSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    const template = await prisma.template.create({
      data: {
        name: data.name,
        description: data.description,
        content: data.content,
        category: data.category,
        outputFormat: data.outputFormat,
        placeholderHint: data.placeholderHint,
        instructionPresetId: data.instructionPresetId || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        createdBy: session.user.id,
      },
    });

    // Audit log
    await logTemplateChange(
      "CREATED",
      template.id,
      template.name,
      getUserFromSession(session),
      undefined,
      { category: data.category, outputFormat: data.outputFormat },
      getRequestContext(request)
    );

    return apiSuccess(template, { status: 201 });
  } catch (error) {
    logger.error("Failed to create template", error);
    return errors.internal("Failed to create template");
  }
}
