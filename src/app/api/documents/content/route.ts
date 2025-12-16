import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET - Get all documents with content (for LLM context)
// Requires authentication: exposes full document content
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const documents = await prisma.knowledgeDocument.findMany({
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        filename: true,
        content: true,
      },
    });

    return apiSuccess({ documents });
  } catch (error) {
    logger.error("Failed to fetch document content", error, { route: "/api/documents/content" });
    return errors.internal("Failed to fetch document content");
  }
}
