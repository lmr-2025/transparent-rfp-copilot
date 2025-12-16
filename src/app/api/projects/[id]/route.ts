import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectStatus, RowStatus, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";
import { logProjectChange, getUserFromSession, computeChanges } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RowInput {
  rowNumber: number;
  question: string;
  response?: string;
  status?: string;
  error?: string;
  conversationHistory?: unknown;
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  usedSkills?: unknown;
  showRecommendation?: boolean;
}

// GET /api/projects/[id] - Get single project
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;

    const project = await prisma.bulkProject.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: {
            rowNumber: "asc",
          },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        customerProfiles: {
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                industry: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return errors.notFound("Project");
    }

    // Transform customerProfiles to a simpler format
    const transformedProject = {
      ...project,
      customerProfiles: project.customerProfiles.map((cp) => cp.profile),
    };

    return apiSuccess({ project: transformedProject });
  } catch (error) {
    logger.error("Error fetching project", error, { route: "/api/projects/[id]" });
    return errors.internal("Failed to fetch project");
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();

    const {
      name, sheetName, columns, rows, ownerName, customerName, notes, status,
      reviewRequestedAt, reviewRequestedBy, reviewedAt, reviewedBy,
      customerProfileIds
    } = body;

    // Map status string to enum
    const projectStatus: ProjectStatus | undefined = status
      ? (status.toUpperCase().replace(/-/g, "_") as ProjectStatus)
      : undefined;

    // Use transaction for atomic updates
    const result = await prisma.$transaction(async (tx) => {
      // Get existing project for audit log
      const existing = await tx.bulkProject.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      // Handle customer profile associations if provided
      if (customerProfileIds !== undefined) {
        // Get current associations
        const currentAssociations = await tx.projectCustomerProfile.findMany({
          where: { projectId: id },
          select: { profileId: true },
        });
        const currentIds = new Set(currentAssociations.map(a => a.profileId));
        const newIds = new Set(customerProfileIds as string[]);

        // Delete only removed associations
        const toDelete = [...currentIds].filter(cid => !newIds.has(cid));
        if (toDelete.length > 0) {
          await tx.projectCustomerProfile.deleteMany({
            where: { projectId: id, profileId: { in: toDelete } },
          });
        }

        // Create only new associations
        const toCreate = [...newIds].filter(nid => !currentIds.has(nid));
        if (toCreate.length > 0) {
          await tx.projectCustomerProfile.createMany({
            data: toCreate.map((profileId) => ({ projectId: id, profileId })),
          });
        }
      }

      // Build update data for project fields only
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (sheetName) updateData.sheetName = sheetName;
      if (columns) updateData.columns = columns;
      if (ownerName !== undefined) updateData.ownerName = ownerName;
      if (customerName !== undefined) updateData.customerName = customerName;
      if (notes !== undefined) updateData.notes = notes;
      if (projectStatus) updateData.status = projectStatus;
      if (reviewRequestedAt !== undefined) updateData.reviewRequestedAt = reviewRequestedAt ? new Date(reviewRequestedAt) : null;
      if (reviewRequestedBy !== undefined) updateData.reviewRequestedBy = reviewRequestedBy;
      if (reviewedAt !== undefined) updateData.reviewedAt = reviewedAt ? new Date(reviewedAt) : null;
      if (reviewedBy !== undefined) updateData.reviewedBy = reviewedBy;

      // Update project fields (without row manipulation in nested write)
      await tx.bulkProject.update({
        where: { id },
        data: updateData,
      });

      // Handle rows separately with upsert for efficiency
      if (rows && Array.isArray(rows)) {
        const rowInputs = rows as RowInput[];
        const newRowNumbers = new Set(rowInputs.map(r => r.rowNumber));

        // Delete rows that are no longer in the update (removed rows)
        await tx.bulkRow.deleteMany({
          where: {
            projectId: id,
            rowNumber: { notIn: [...newRowNumbers] },
          },
        });

        // Upsert each row
        for (const row of rowInputs) {
          const rowStatus = (row.status?.toUpperCase() || "PENDING") as RowStatus;
          const conversationHistory = row.conversationHistory
            ? (row.conversationHistory as Prisma.InputJsonValue)
            : Prisma.JsonNull;
          const usedSkills = row.usedSkills
            ? (row.usedSkills as Prisma.InputJsonValue)
            : Prisma.JsonNull;

          await tx.bulkRow.upsert({
            where: {
              projectId_rowNumber: { projectId: id, rowNumber: row.rowNumber },
            },
            update: {
              question: row.question,
              response: row.response || "",
              status: rowStatus,
              error: row.error,
              conversationHistory,
              confidence: row.confidence,
              sources: row.sources,
              reasoning: row.reasoning,
              inference: row.inference,
              remarks: row.remarks,
              usedSkills,
              showRecommendation: row.showRecommendation || false,
            },
            create: {
              projectId: id,
              rowNumber: row.rowNumber,
              question: row.question,
              response: row.response || "",
              status: rowStatus,
              error: row.error,
              conversationHistory,
              confidence: row.confidence,
              sources: row.sources,
              reasoning: row.reasoning,
              inference: row.inference,
              remarks: row.remarks,
              usedSkills,
              showRecommendation: row.showRecommendation || false,
            },
          });
        }
      }

      // Fetch updated project with relations
      const project = await tx.bulkProject.findUnique({
        where: { id },
        include: {
          rows: { orderBy: { rowNumber: "asc" } },
          customerProfiles: {
            include: {
              profile: {
                select: { id: true, name: true, industry: true },
              },
            },
          },
        },
      });

      return { existing, project: project! };
    });

    // Transform customerProfiles to a simpler format
    const transformedProject = {
      ...result.project,
      customerProfiles: result.project.customerProfiles.map((cp) => cp.profile),
    };

    // Compute changes for audit log
    const changes = computeChanges(
      result.existing as unknown as Record<string, unknown>,
      result.project as unknown as Record<string, unknown>,
      ["name", "customerName", "status", "notes"]
    );

    // Determine action type
    let auditAction: "UPDATED" | "STATUS_CHANGED" = "UPDATED";
    if (status && result.existing.status !== projectStatus) {
      auditAction = "STATUS_CHANGED";
    }

    // Audit log
    await logProjectChange(
      auditAction,
      result.project.id,
      result.project.name,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

    return apiSuccess({ project: transformedProject });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return errors.notFound("Project");
    }
    logger.error("Error updating project", error, { route: "/api/projects/[id]" });
    return errors.internal("Failed to update project");
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id } = params;

    // Get project before deleting for audit log
    const project = await prisma.bulkProject.findUnique({ where: { id } });
    if (!project) {
      return errors.notFound("Project");
    }

    await prisma.bulkProject.delete({
      where: { id },
    });

    // Audit log
    await logProjectChange(
      "DELETED",
      id,
      project.name,
      getUserFromSession(auth.session),
      undefined,
      { deletedProject: { name: project.name, customerName: project.customerName } }
    );

    return apiSuccess({ message: "Project deleted successfully" });
  } catch (error) {
    logger.error("Error deleting project", error, { route: "/api/projects/[id]" });
    return errors.internal("Failed to delete project");
  }
}
