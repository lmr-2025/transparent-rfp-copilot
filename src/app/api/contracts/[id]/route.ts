import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logContractChange, getUserFromSession, computeChanges } from "@/lib/auditLog";

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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Get existing contract for audit log
    const existing = await prisma.contractReview.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Contract review not found" }, { status: 404 });
    }

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

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      review as unknown as Record<string, unknown>,
      ["name", "customerName", "contractType", "status", "overallRating", "notes"]
    );

    // Determine action type
    let auditAction: "UPDATED" | "STATUS_CHANGED" = "UPDATED";
    if (status && existing.status !== status) {
      auditAction = "STATUS_CHANGED";
    }

    // Audit log
    await logContractChange(
      auditAction,
      review.id,
      review.name,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;

    // Get contract before deleting for audit log
    const contract = await prisma.contractReview.findUnique({ where: { id } });
    if (!contract) {
      return NextResponse.json({ error: "Contract review not found" }, { status: 404 });
    }

    await prisma.contractReview.delete({
      where: { id },
    });

    // Audit log
    await logContractChange(
      "DELETED",
      id,
      contract.name,
      getUserFromSession(auth.session),
      undefined,
      { deletedContract: { name: contract.name, customerName: contract.customerName } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete contract review:", error);
    return NextResponse.json(
      { error: "Failed to delete contract review" },
      { status: 500 }
    );
  }
}
