import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectStatus, RowStatus } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";
import { createProjectSchema, validateBody } from "@/lib/validations";
import { logProjectChange, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/projects - Get all projects
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const includeRows = searchParams.get("includeRows") === "true";
    const includeFeedbackStats = searchParams.get("includeFeedbackStats") === "true";

    const projects = await prisma.bulkProject.findMany({
      take: limit,
      skip: offset,
      include: {
        ...(includeRows && {
          rows: {
            orderBy: { rowNumber: "asc" },
          },
        }),
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
      orderBy: {
        lastModifiedAt: "desc", // Most recently modified first
      },
    });

    const feedbackStats = new Map<
      string,
      { totalRows: number; completedRows: number; editedResponses: number; reviewedRows: number; flaggedRows: number }
    >();

    if (includeFeedbackStats && projects.length > 0) {
      const rowSummaries = await prisma.bulkRow.findMany({
        where: { projectId: { in: projects.map((project) => project.id) } },
        select: {
          projectId: true,
          status: true,
          originalResponse: true,
          userEditedAnswer: true,
          reviewStatus: true,
          flaggedForReview: true,
        },
      });

      for (const row of rowSummaries) {
        const stats =
          feedbackStats.get(row.projectId) || {
            totalRows: 0,
            completedRows: 0,
            editedResponses: 0,
            reviewedRows: 0,
            flaggedRows: 0,
          };
        stats.totalRows += 1;
        if (row.status === "COMPLETED") {
          stats.completedRows += 1;
        }
        if (row.originalResponse && row.userEditedAnswer && row.userEditedAnswer !== row.originalResponse) {
          stats.editedResponses += 1;
        }
        if (row.reviewStatus === "APPROVED" || row.reviewStatus === "CORRECTED") {
          stats.reviewedRows += 1;
        }
        if (row.flaggedForReview) {
          stats.flaggedRows += 1;
        }
        feedbackStats.set(row.projectId, stats);
      }
    }

    // Transform customerProfiles to a simpler format
    const transformedProjects = projects.map((project) => {
      const transformed = {
        ...project,
        customerProfiles: project.customerProfiles.map((cp) => cp.profile),
      };

      if (includeFeedbackStats) {
        transformed.feedbackStats =
          feedbackStats.get(project.id) || {
            totalRows: 0,
            completedRows: 0,
            editedResponses: 0,
            reviewedRows: 0,
            flaggedRows: 0,
          };
      }

      return transformed;
    });

    return apiSuccess({ projects: transformedProjects });
  } catch (error) {
    logger.error("Error fetching projects", error, { route: "/api/projects" });
    return errors.internal("Failed to fetch projects");
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createProjectSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    // Map status string to enum
    const projectStatus: ProjectStatus = (data.status?.toUpperCase().replace(/-/g, "_") as ProjectStatus) || "DRAFT";

    const project = await prisma.bulkProject.create({
      data: {
        name: data.name,
        sheetName: data.sheetName,
        columns: data.columns,
        ownerName: data.ownerName || auth.session.user.name,
        ownerId: data.ownerId || auth.session.user.id, // Use provided owner or fall back to current user
        customerName: data.customerName,
        notes: data.notes,
        status: projectStatus,
        rows: {
          create: data.rows.map((row) => ({
            rowNumber: row.rowNumber,
            question: row.question,
            response: row.response || "",
            status: (row.status?.toUpperCase() || "PENDING") as RowStatus,
            error: row.error,
            conversationHistory: row.conversationHistory || undefined,
            confidence: row.confidence,
            sources: row.sources,
            reasoning: row.reasoning,
            inference: row.inference,
            remarks: row.remarks,
            usedSkills: row.usedSkills || undefined,
            showRecommendation: row.showRecommendation || false,
            // Track who created this question (for org-wide reporting)
            askedById: auth.session.user.id,
            askedByName: auth.session.user.name,
            askedByEmail: auth.session.user.email,
          })),
        },
      },
      include: {
        rows: true,
      },
    });

    // Audit log
    await logProjectChange(
      "CREATED",
      project.id,
      project.name,
      getUserFromSession(auth.session),
      undefined,
      { rowCount: data.rows.length, customerName: data.customerName }
    );

    return apiSuccess({ project }, { status: 201 });
  } catch (error) {
    logger.error("Error creating project", error, { route: "/api/projects" });
    return errors.internal("Failed to create project");
  }
}
