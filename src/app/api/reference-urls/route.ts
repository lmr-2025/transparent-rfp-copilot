import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createReferenceUrlSchema, bulkImportUrlsSchema, validateBody } from "@/lib/validations";
import { logReferenceUrlChange, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";

// GET /api/reference-urls - List all reference URLs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // Filter by category if provided (check if category is in the categories array)
    const where = category ? { categories: { has: category } } : {};

    const urls = await prisma.referenceUrl.findMany({
      where,
      orderBy: { addedAt: "desc" },
    });

    return apiSuccess(urls);
  } catch (error) {
    console.error("Failed to fetch reference URLs:", error);
    return errors.internal("Failed to fetch reference URLs");
  }
}

// POST /api/reference-urls - Create a new reference URL
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createReferenceUrlSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;
    const url = await prisma.referenceUrl.create({
      data: {
        url: data.url,
        title: data.title,
        description: data.description,
        categories: data.categories,
      },
    });

    // Audit log
    await logReferenceUrlChange(
      "CREATED",
      url.id,
      url.title || url.url,
      getUserFromSession(auth.session),
      undefined,
      { url: data.url, categories: data.categories }
    );

    return apiSuccess(url, { status: 201 });
  } catch (error) {
    console.error("Failed to create reference URL:", error);
    return errors.internal("Failed to create reference URL");
  }
}

// PUT /api/reference-urls - Bulk import URLs
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(bulkImportUrlsSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { urls } = validation.data;

    // Upsert each URL (skip duplicates)
    const results = await Promise.all(
      urls.map((u) =>
        prisma.referenceUrl.upsert({
          where: { url: u.url },
          create: {
            url: u.url,
            title: u.title,
            description: u.description,
            categories: u.categories || [],
          },
          update: {
            title: u.title || undefined,
            description: u.description || undefined,
            categories: u.categories || undefined,
          },
        })
      )
    );

    return apiSuccess({ imported: results.length, urls: results });
  } catch (error) {
    console.error("Failed to import reference URLs:", error);
    return errors.internal("Failed to import reference URLs");
  }
}
