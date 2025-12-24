import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { logContractChange, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

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
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        contractType: true,
        status: true,
        overallRating: true,
        createdAt: true,
        analyzedAt: true,
        ownerId: true,
        ownerName: true,
        findings: {
          select: {
            id: true,
            rating: true,
            flaggedForReview: true,
          },
        },
      },
    });

    // Transform to include counts from findings relation
    const summaries = reviews.map((r) => {
      const findings = r.findings || [];
      return {
        id: r.id,
        name: r.name,
        filename: r.filename,
        customerName: r.customer?.name || r.customerName, // Prefer linked customer name
        customerId: r.customerId,
        customer: r.customer,
        contractType: r.contractType,
        status: r.status,
        overallRating: r.overallRating,
        createdAt: r.createdAt.toISOString(),
        analyzedAt: r.analyzedAt?.toISOString(),
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        findingsCount: findings.length,
        riskCount: findings.filter((f) => f.rating === "risk").length,
        gapCount: findings.filter((f) => f.rating === "gap").length,
        flaggedCount: findings.filter((f) => f.flaggedForReview).length,
      };
    });

    return apiSuccess({ contracts: summaries });
  } catch (error) {
    logger.error("Failed to fetch contract reviews", error, { route: "/api/contracts" });
    return errors.internal("Failed to fetch contract reviews");
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
    const customerId = formData.get("customerId") as string | null;
    const contractType = formData.get("contractType") as string | null;

    if (!file) {
      return errors.badRequest("No file provided");
    }

    const filename = file.name;
    const fileType = filename.split(".").pop()?.toLowerCase() || "";

    if (!["pdf", "docx", "doc"].includes(fileType)) {
      return errors.badRequest("Unsupported file type. Please upload PDF or DOCX.");
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
      return errors.badRequest("Could not extract text from file. The file may be empty or corrupted.");
    }

    // Create the contract review record
    const review = await prisma.contractReview.create({
      data: {
        name: name || filename.replace(/\.[^.]+$/, ""),
        filename,
        fileType,
        customerName: customerName || undefined,
        customerId: customerId || undefined,
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

    return apiSuccess({
      contract: {
        id: review.id,
        name: review.name,
        filename: review.filename,
        customerName: review.customerName,
        contractType: review.contractType,
        status: review.status,
        createdAt: review.createdAt.toISOString(),
        textLength: extractedText.length,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("Failed to upload contract", error, { route: "/api/contracts" });
    return errors.internal(error instanceof Error ? error.message : "Failed to upload contract");
  }
}
