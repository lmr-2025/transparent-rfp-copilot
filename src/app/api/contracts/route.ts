import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logContractChange, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  detectFileType,
  extractTextContent,
  getSupportedFileTypesDescription,
} from "@/lib/documentExtractor";

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
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
        customerName: r.customer?.name,
        customerId: r.customerId,
        customer: r.customer,
        contractType: r.contractType,
        status: r.status,
        overallRating: r.overallRating,
        createdAt: r.createdAt.toISOString(),
        analyzedAt: r.analyzedAt?.toISOString(),
        ownerId: r.ownerId,
        ownerName: r.owner?.name || r.owner?.email,
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
    const fileType = detectFileType(filename);

    if (!fileType) {
      return errors.badRequest(`Unsupported file type. Please upload ${getSupportedFileTypesDescription()} files.`);
    }

    // Extract text from file
    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText: string;

    try {
      extractedText = await extractTextContent(buffer, fileType);
    } catch (extractError) {
      logger.error("Text extraction failed", extractError, { route: "/api/contracts", fileType });
      return errors.badRequest("Could not extract text from file. The file may be empty or corrupted.");
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
        customerId: customerId || undefined,
        contractType: contractType || undefined,
        extractedText,
        status: "PENDING",
        ownerId: auth.session.user.id,
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
        customerName: customerName,
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
