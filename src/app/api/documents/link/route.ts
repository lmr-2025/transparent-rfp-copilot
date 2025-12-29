import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * POST /api/documents/link
 *
 * Links existing document(s) to a skill via SkillSource.
 * Supports both single document and batch operations.
 *
 * Single Document Body:
 * - documentId: string (required) - The document ID to link
 * - skillId: string (required) - The skill ID to link to
 *
 * Batch Body:
 * - documentIds: string[] (required) - Document IDs to link
 * - skillId: string (required) - The skill ID to link to
 *
 * Uses SkillSource join table for many-to-many skill-source relationships.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { documentId, documentIds, skillId } = body;

    if (!skillId) {
      return errors.validation("skillId is required");
    }

    // Verify skill exists
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return errors.notFound("Skill");
    }

    // Batch mode: multiple documents
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      // Verify all documents exist
      const documents = await prisma.knowledgeDocument.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, title: true, filename: true },
      });

      const foundIds = new Set(documents.map((d) => d.id));
      const missingIds = documentIds.filter((id: string) => !foundIds.has(id));

      if (missingIds.length > 0) {
        return errors.notFound(`Documents not found: ${missingIds.join(", ")}`);
      }

      // Create SkillSource links in transaction
      await prisma.$transaction(async (tx) => {
        for (const doc of documents) {
          await tx.skillSource.upsert({
            where: {
              skillId_sourceId_sourceType: {
                skillId,
                sourceId: doc.id,
                sourceType: "document",
              },
            },
            create: {
              skillId,
              sourceId: doc.id,
              sourceType: "document",
              addedAt: new Date(),
              isPrimary: false,
            },
            update: {}, // No-op if link already exists
          });
        }
      });

      return apiSuccess(
        {
          linked: documents.length,
          documents: documents.map((d) => ({
            id: d.id,
            title: d.title,
            filename: d.filename,
          })),
        },
        { status: 201 }
      );
    }

    // Single document mode
    if (!documentId) {
      return errors.validation("documentId or documentIds array is required");
    }

    // Verify document exists
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, filename: true },
    });

    if (!document) {
      return errors.notFound("Document");
    }

    // Create SkillSource link (upsert to avoid duplicates)
    await prisma.skillSource.upsert({
      where: {
        skillId_sourceId_sourceType: {
          skillId,
          sourceId: documentId,
          sourceType: "document",
        },
      },
      create: {
        skillId,
        sourceId: documentId,
        sourceType: "document",
        addedAt: new Date(),
        isPrimary: false,
      },
      update: {},
    });

    return apiSuccess(
      {
        linked: 1,
        document: {
          id: document.id,
          title: document.title,
          filename: document.filename,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Failed to link document to skill", error, {
      route: "/api/documents/link",
    });
    return errors.internal("Failed to link document to skill");
  }
}
