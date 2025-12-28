import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createReferenceUrlSchema, bulkImportUrlsSchema, validateBody } from "@/lib/validations";
import { logReferenceUrlChange, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/reference-urls - List all reference URLs with skill usage counts
// Categories are derived dynamically from linked skills via SkillSource
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // Fetch all URLs first (we'll filter after computing derived categories)
    const urls = await prisma.referenceUrl.findMany({
      orderBy: { addedAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Get all SkillSource links for these URLs with their skill categories
    const urlIds = urls.map((u) => u.id);
    const skillSources = await prisma.skillSource.findMany({
      where: {
        sourceId: { in: urlIds },
        sourceType: "url",
      },
      include: {
        skill: {
          select: { id: true, categories: true },
        },
      },
    });

    // Build a map of URL ID -> derived categories (union of all linked skills' categories)
    const categoryMap = new Map<string, Set<string>>();
    const countMap = new Map<string, number>();

    for (const ss of skillSources) {
      // Count skills per URL
      countMap.set(ss.sourceId, (countMap.get(ss.sourceId) || 0) + 1);

      // Aggregate categories from linked skills
      if (!categoryMap.has(ss.sourceId)) {
        categoryMap.set(ss.sourceId, new Set());
      }
      const catSet = categoryMap.get(ss.sourceId)!;
      for (const cat of ss.skill.categories) {
        catSet.add(cat);
      }
    }

    // Add skillCount and derived categories to each URL
    let urlsWithData = urls.map((url) => ({
      ...url,
      skillCount: countMap.get(url.id) || 0,
      // Derived categories from linked skills (falls back to stored categories if none linked)
      categories: categoryMap.has(url.id)
        ? Array.from(categoryMap.get(url.id)!)
        : url.categories,
    }));

    // Filter by category if provided (now filtering on derived categories)
    if (category) {
      urlsWithData = urlsWithData.filter((url) => url.categories.includes(category));
    }

    // Add HTTP caching - URLs are fairly stable
    const response = apiSuccess(urlsWithData);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600'
    );
    return response;
  } catch (error) {
    logger.error("Failed to fetch reference URLs", error, { route: "/api/reference-urls" });
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
        ownerId: auth.session.user.id,
        createdBy: auth.session.user.email || undefined,
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
    logger.error("Failed to create reference URL", error, { route: "/api/reference-urls" });
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

    // Upsert all URLs in a single transaction for atomicity
    const results = await prisma.$transaction(async (tx) => {
      const upserted = [];
      for (const u of urls) {
        const result = await tx.referenceUrl.upsert({
          where: { url: u.url },
          create: {
            url: u.url,
            title: u.title,
            description: u.description,
            categories: u.categories || [],
            ownerId: auth.session.user.id,
            createdBy: auth.session.user.email || undefined,
          },
          update: {
            title: u.title || undefined,
            description: u.description || undefined,
            categories: u.categories || undefined,
          },
        });
        upserted.push(result);
      }
      return upserted;
    });

    // Audit log for bulk import (single entry to avoid spam)
    await logReferenceUrlChange(
      "CREATED",
      "bulk-import",
      "Bulk URL Import",
      getUserFromSession(auth.session),
      undefined,
      { importedCount: results.length, urls: results.map(r => r.url) }
    );

    return apiSuccess({ imported: results.length, urls: results });
  } catch (error) {
    logger.error("Failed to import reference URLs", error, { route: "/api/reference-urls" });
    return errors.internal("Failed to import reference URLs");
  }
}
