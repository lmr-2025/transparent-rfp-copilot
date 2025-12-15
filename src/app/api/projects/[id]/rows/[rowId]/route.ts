import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RowReviewStatus } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";

interface RouteContext {
  params: Promise<{ id: string; rowId: string }>;
}

// PATCH /api/projects/[id]/rows/[rowId] - Update a specific row
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: projectId, rowId } = params;
    const body = await request.json();

    // Verify row exists and belongs to project
    const row = await prisma.bulkRow.findFirst({
      where: { id: rowId, projectId },
      include: { project: true },
    });

    if (!row) {
      return NextResponse.json(
        { error: "Row not found" },
        { status: 404 }
      );
    }

    // Build update data based on provided fields
    const updateData: Record<string, unknown> = {};

    // Review workflow fields
    if (body.reviewStatus !== undefined) {
      updateData.reviewStatus = body.reviewStatus as RowReviewStatus;
    }
    if (body.reviewNote !== undefined) {
      updateData.flagNote = body.reviewNote; // Store note in flagNote field
    }
    if (body.flaggedForReview !== undefined) {
      updateData.flaggedForReview = body.flaggedForReview;
      if (body.flaggedForReview) {
        updateData.flaggedAt = new Date();
        updateData.flaggedBy = auth.session?.user?.name || auth.session?.user?.email || "Unknown";
      }
    }
    if (body.reviewedAt !== undefined) {
      updateData.reviewedAt = body.reviewedAt ? new Date(body.reviewedAt) : null;
    }
    if (body.reviewedBy !== undefined) {
      updateData.reviewedBy = body.reviewedBy;
    }
    if (body.userEditedAnswer !== undefined) {
      updateData.userEditedAnswer = body.userEditedAnswer;
    }

    // Update the row
    const updatedRow = await prisma.bulkRow.update({
      where: { id: rowId },
      data: updateData,
    });

    return NextResponse.json({ row: updatedRow }, { status: 200 });
  } catch (error) {
    console.error("Error updating row:", error);
    return NextResponse.json(
      { error: "Failed to update row" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/rows/[rowId]/request-review - Request review with Slack notification
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: projectId, rowId } = params;
    const body = await request.json();
    const { reviewNote, sendSlack = true } = body;

    // Verify row exists and belongs to project
    const row = await prisma.bulkRow.findFirst({
      where: { id: rowId, projectId },
      include: { project: true },
    });

    if (!row) {
      return NextResponse.json(
        { error: "Row not found" },
        { status: 404 }
      );
    }

    const requesterName = auth.session?.user?.name || auth.session?.user?.email || "Unknown User";

    // Update the row with review request
    const updatedRow = await prisma.bulkRow.update({
      where: { id: rowId },
      data: {
        reviewStatus: "REQUESTED",
        flaggedForReview: true,
        flaggedAt: new Date(),
        flaggedBy: requesterName,
        flagNote: reviewNote || null,
      },
    });

    // Send Slack notification if enabled
    let slackSent = false;
    if (sendSlack) {
      try {
        const projectUrl = `${request.headers.get("origin") || ""}/projects/${projectId}?filter=flagged`;

        const slackResponse = await fetch(
          `${request.headers.get("origin") || ""}/api/slack/notify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "question",
              projectName: row.project.name,
              projectUrl,
              customerName: row.project.customerName,
              requesterName,
              question: row.question,
              answer: row.response,
              confidence: row.confidence,
              reviewNote,
            }),
          }
        );

        slackSent = slackResponse.ok;
      } catch (slackError) {
        console.warn("Slack notification failed:", slackError);
      }
    }

    return NextResponse.json({
      row: updatedRow,
      slackSent,
    }, { status: 200 });
  } catch (error) {
    console.error("Error requesting review:", error);
    return NextResponse.json(
      { error: "Failed to request review" },
      { status: 500 }
    );
  }
}
