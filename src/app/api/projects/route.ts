import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ProjectStatus } from "@prisma/client";

// GET /api/projects - Get all projects
export async function GET() {
  try {
    const projects = await prisma.bulkProject.findMany({
      include: {
        rows: true, // Include all rows with the project
      },
      orderBy: {
        lastModifiedAt: "desc", // Most recently modified first
      },
    });

    return NextResponse.json({ projects }, { status: 200 });
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
          create: rows.map((row: any) => ({
            rowNumber: row.rowNumber,
            question: row.question,
            response: row.response || "",
            status: row.status?.toUpperCase() || "PENDING",
            error: row.error,
            conversationHistory: row.conversationHistory || null,
            confidence: row.confidence,
            sources: row.sources,
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
