import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ProjectStatus } from "@prisma/client";

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

// GET /api/projects - Get all projects
export async function GET() {
  try {
    const projects = await prisma.bulkProject.findMany({
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
  try {
    const body = await request.json();
    const { name, sheetName, columns, rows, ownerName, customerName, notes, status } = body;

    if (!name || !sheetName || !columns || !rows) {
      return NextResponse.json(
        { error: "Missing required fields: name, sheetName, columns, rows" },
        { status: 400 }
      );
    }

    // Map status string to enum
    const projectStatus: ProjectStatus = status?.toUpperCase().replace(/-/g, "_") || "DRAFT";

    const project = await prisma.bulkProject.create({
      data: {
        name,
        sheetName,
        columns,
        ownerName,
        customerName,
        notes,
        status: projectStatus,
        rows: {
          create: rows.map((row: RowInput) => ({
            rowNumber: row.rowNumber,
            question: row.question,
            response: row.response || "",
            status: row.status?.toUpperCase() || "PENDING",
            error: row.error,
            conversationHistory: row.conversationHistory || null,
            confidence: row.confidence,
            sources: row.sources,
            reasoning: row.reasoning,
            inference: row.inference,
            remarks: row.remarks,
            usedSkills: row.usedSkills || null,
            showRecommendation: row.showRecommendation || false,
          })),
        },
      },
      include: {
        rows: true,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
