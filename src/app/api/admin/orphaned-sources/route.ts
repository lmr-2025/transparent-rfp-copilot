import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyCapability } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/orphaned-sources
 *
 * Lists all orphaned documents and URLs (sources not linked to any skill).
 * Admin only.
 */
export async function GET() {
  const auth = await requireAnyCapability(["ADMIN"]);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    // Get all source IDs that have at least one SkillSource link
    const linkedSources = await prisma.skillSource.findMany({
      select: { sourceId: true, sourceType: true },
    });

    const linkedDocIds = new Set(
      linkedSources
        .filter((s) => s.sourceType === "document")
        .map((s) => s.sourceId)
    );
    const linkedUrlIds = new Set(
      linkedSources.filter((s) => s.sourceType === "url").map((s) => s.sourceId)
    );

    // Get all documents and filter to orphans
    const allDocs = await prisma.knowledgeDocument.findMany({
      select: {
        id: true,
        title: true,
        filename: true,
        fileType: true,
        uploadedAt: true,
        createdBy: true,
      },
    });
    const orphanedDocs = allDocs.filter((doc) => !linkedDocIds.has(doc.id));

    // Get all URLs and filter to orphans
    const allUrls = await prisma.referenceUrl.findMany({
      select: {
        id: true,
        url: true,
        title: true,
        addedAt: true,
        createdBy: true,
      },
    });
    const orphanedUrls = allUrls.filter((url) => !linkedUrlIds.has(url.id));

    return apiSuccess({
      orphanedDocuments: orphanedDocs,
      orphanedUrls: orphanedUrls,
      summary: {
        totalDocuments: allDocs.length,
        orphanedDocuments: orphanedDocs.length,
        totalUrls: allUrls.length,
        orphanedUrls: orphanedUrls.length,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch orphaned sources", error, {
      route: "/api/admin/orphaned-sources",
    });
    return errors.internal("Failed to fetch orphaned sources");
  }
}

/**
 * DELETE /api/admin/orphaned-sources
 *
 * Deletes all orphaned documents and URLs.
 * Admin only.
 *
 * Query params:
 * - type: "documents" | "urls" | "all" (default: "all")
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAnyCapability(["ADMIN"]);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const deleteType = searchParams.get("type") || "all";

    // Get all source IDs that have at least one SkillSource link
    const linkedSources = await prisma.skillSource.findMany({
      select: { sourceId: true, sourceType: true },
    });

    const linkedDocIds = new Set(
      linkedSources
        .filter((s) => s.sourceType === "document")
        .map((s) => s.sourceId)
    );
    const linkedUrlIds = new Set(
      linkedSources.filter((s) => s.sourceType === "url").map((s) => s.sourceId)
    );

    let deletedDocs = 0;
    let deletedUrls = 0;

    // Delete orphaned documents
    if (deleteType === "documents" || deleteType === "all") {
      const allDocs = await prisma.knowledgeDocument.findMany({
        select: { id: true },
      });
      const orphanDocIds = allDocs
        .filter((doc) => !linkedDocIds.has(doc.id))
        .map((doc) => doc.id);

      if (orphanDocIds.length > 0) {
        const result = await prisma.knowledgeDocument.deleteMany({
          where: { id: { in: orphanDocIds } },
        });
        deletedDocs = result.count;
      }
    }

    // Delete orphaned URLs
    if (deleteType === "urls" || deleteType === "all") {
      const allUrls = await prisma.referenceUrl.findMany({
        select: { id: true },
      });
      const orphanUrlIds = allUrls
        .filter((url) => !linkedUrlIds.has(url.id))
        .map((url) => url.id);

      if (orphanUrlIds.length > 0) {
        const result = await prisma.referenceUrl.deleteMany({
          where: { id: { in: orphanUrlIds } },
        });
        deletedUrls = result.count;
      }
    }

    logger.info("Orphaned sources cleaned up", {
      deletedDocs,
      deletedUrls,
      deletedBy: auth.session.user.email,
    });

    return apiSuccess({
      deleted: {
        documents: deletedDocs,
        urls: deletedUrls,
        total: deletedDocs + deletedUrls,
      },
    });
  } catch (error) {
    logger.error("Failed to delete orphaned sources", error, {
      route: "/api/admin/orphaned-sources",
    });
    return errors.internal("Failed to delete orphaned sources");
  }
}
