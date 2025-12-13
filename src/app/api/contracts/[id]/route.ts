import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/contracts/[id] - Get a single contract review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const review = await prisma.contractReview.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Contract review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...review,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      analyzedAt: review.analyzedAt?.toISOString(),
      reviewedAt: review.reviewedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch contract review:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract review" },
      { status: 500 }
    );
  }
}

// PUT /api/contracts/[id] - Update a contract review
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      customerName,
      contractType,
      status,
      overallRating,
      summary,
      findings,
      notes,
      reviewedBy,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (customerName !== undefined) updateData.customerName = customerName;
    if (contractType !== undefined) updateData.contractType = contractType;
    if (status !== undefined) updateData.status = status;
    if (overallRating !== undefined) updateData.overallRating = overallRating;
    if (summary !== undefined) updateData.summary = summary;
    if (findings !== undefined) updateData.findings = findings;
    if (notes !== undefined) updateData.notes = notes;

    // If marking as reviewed, set reviewed fields
    if (status === "REVIEWED") {
      updateData.reviewedAt = new Date();
      if (reviewedBy) updateData.reviewedBy = reviewedBy;
    }

    const review = await prisma.contractReview.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...review,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      analyzedAt: review.analyzedAt?.toISOString(),
      reviewedAt: review.reviewedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Failed to update contract review:", error);
    return NextResponse.json(
      { error: "Failed to update contract review" },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - Delete a contract review
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.contractReview.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete contract review:", error);
    return NextResponse.json(
      { error: "Failed to delete contract review" },
      { status: 500 }
    );
  }
}
