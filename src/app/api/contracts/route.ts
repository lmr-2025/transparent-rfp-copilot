import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { logContractChange, getUserFromSession } from "@/lib/auditLog";

export const maxDuration = 60;

// GET /api/contracts - List all contract reviews
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const customerName = searchParams.get("customer");

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (customerName) {
      where.customerName = { contains: customerName, mode: "insensitive" };
    }

    const reviews = await prisma.contractReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        filename: true,
        fileType: true,
        customerName: true,
        contractType: true,
        status: true,
        overallRating: true,
        createdAt: true,
        analyzedAt: true,
        findings: true,
      },
    });

    // Transform to include counts
    const summaries = reviews.map((r) => {
      const findings = (r.findings as Array<{ rating: string }>) || [];
      return {
        id: r.id,
        name: r.name,
        filename: r.filename,
        customerName: r.customerName,
        contractType: r.contractType,
        status: r.status,
        overallRating: r.overallRating,
        createdAt: r.createdAt.toISOString(),
        analyzedAt: r.analyzedAt?.toISOString(),
        findingsCount: findings.length,
        riskCount: findings.filter((f) => f.rating === "risk").length,
        gapCount: findings.filter((f) => f.rating === "gap").length,
      };
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error("Failed to fetch contract reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract reviews" },
      { status: 500 }
    );
  }
}

// POST /api/contracts - Upload and create a new contract review
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const customerName = formData.get("customerName") as string | null;
    const contractType = formData.get("contractType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const fileType = filename.split(".").pop()?.toLowerCase() || "";

    if (!["pdf", "docx", "doc"].includes(fileType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF or DOCX." },
        { status: 400 }
      );
    }

    // Extract text from file
    let extractedText = "";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (fileType === "pdf") {
      // Dynamic import to avoid ESM/Turbopack issues
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      extractedText = textResult.text;
    } else if (fileType === "docx" || fileType === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file. The file may be empty or corrupted." },
        { status: 400 }
      );
    }

    // Create the contract review record
    const review = await prisma.contractReview.create({
      data: {
        name: name || filename.replace(/\.[^.]+$/, ""),
        filename,
        fileType,
        customerName: customerName || undefined,
        contractType: contractType || undefined,
        extractedText,
        status: "PENDING",
      },
    });

    // Audit log
    await logContractChange(
      "CREATED",
      review.id,
      review.name,
      getUserFromSession(auth.session),
      undefined,
      { filename, fileType, customerName, contractType }
    );

    return NextResponse.json({
      id: review.id,
      name: review.name,
      filename: review.filename,
      customerName: review.customerName,
      contractType: review.contractType,
      status: review.status,
      createdAt: review.createdAt.toISOString(),
      textLength: extractedText.length,
    });
  } catch (error) {
    console.error("Failed to upload contract:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload contract" },
      { status: 500 }
    );
  }
}
