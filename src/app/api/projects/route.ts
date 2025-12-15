import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectStatus, RowStatus } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";
import { createProjectSchema, validateBody } from "@/lib/validations";
import { logProjectChange, getUserFromSession } from "@/lib/auditLog";

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

    const projects = await prisma.bulkProject.findMany({
      take: limit,
      skip: offset,
      include: {
        rows: true, // Include all rows with the project
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

    // Transform customerProfiles to a simpler format
    const transformedProjects = projects.map((project) => ({
      ...project,
      customerProfiles: project.customerProfiles.map((cp) => cp.profile),
    }));

    return NextResponse.json({ projects: transformedProjects }, { status: 200 });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
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
        ownerId: auth.session.user.id,
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

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
