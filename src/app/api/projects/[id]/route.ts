import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ProjectStatus } from "@prisma/client";

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
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();

    const {
      name, sheetName, columns, rows, ownerName, customerName, notes, status,
      reviewRequestedAt, reviewRequestedBy, reviewedAt, reviewedBy
    } = body;

    // Map status string to enum
    const projectStatus: ProjectStatus | undefined = status
      ? (status.toUpperCase().replace(/-/g, "_") as ProjectStatus)
      : undefined;

    // Delete all existing rows and create new ones to handle updates
    const project = await prisma.bulkProject.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sheetName && { sheetName }),
        ...(columns && { columns }),
        ...(ownerName !== undefined && { ownerName }),
        ...(customerName !== undefined && { customerName }),
        ...(notes !== undefined && { notes }),
        ...(projectStatus && { status: projectStatus }),
        ...(reviewRequestedAt !== undefined && { reviewRequestedAt: reviewRequestedAt ? new Date(reviewRequestedAt) : null }),
        ...(reviewRequestedBy !== undefined && { reviewRequestedBy }),
        ...(reviewedAt !== undefined && { reviewedAt: reviewedAt ? new Date(reviewedAt) : null }),
        ...(reviewedBy !== undefined && { reviewedBy }),
        ...(rows && {
          rows: {
            deleteMany: {}, // Delete all existing rows
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
        }),
      },
      include: {
        rows: {
          orderBy: {
            rowNumber: "asc",
          },
        },
      },
    });

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;

    await prisma.bulkProject.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Project deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
