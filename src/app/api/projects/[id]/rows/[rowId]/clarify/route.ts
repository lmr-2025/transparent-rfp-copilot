import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logAnswerChange, getUserFromSession, getRequestContext } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string; rowId: string }>;
}

interface ClarifyMessage {
  role: "user" | "assistant";
  content: string;
}

// POST /api/projects/[id]/rows/[rowId]/clarify - Log clarify usage and auto-flag
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id: projectId, rowId } = params;
    const body = await request.json();
    const { conversation, userMessage } = body as {
      conversation: ClarifyMessage[];
      userMessage?: string;
    };

    // Verify row exists and belongs to project
    const row = await prisma.bulkRow.findFirst({
      where: { id: rowId, projectId },
      include: { project: true },
    });

    if (!row) {
      return errors.notFound("Row");
    }

    const userName = auth.session?.user?.name || auth.session?.user?.email || "Unknown User";

    // Check if this is the first clarify message (auto-flag)
    const existingConversation = row.clarifyConversation as ClarifyMessage[] | null;
    const isFirstClarify = !existingConversation || existingConversation.length === 0;

    // Build update data
    const updateData: Record<string, unknown> = {
      clarifyConversation: conversation,
    };

    // Auto-flag on first clarify usage (if not already flagged)
    if (isFirstClarify && !row.flaggedForReview) {
      updateData.flaggedForReview = true;
      updateData.flaggedAt = new Date();
      updateData.flaggedBy = userName;
      updateData.flagNote = "Auto-flagged: Clarify conversation started";
    }

    // Update the row
    const updatedRow = await prisma.bulkRow.update({
      where: { id: rowId },
      data: updateData,
    });

    // Log to audit log
    const user = auth.session ? getUserFromSession(auth.session) : undefined;
    const requestContext = getRequestContext(request);

    await logAnswerChange(
      "CLARIFY_USED",
      rowId,
      row.question?.substring(0, 100) || "Answer",
      user,
      undefined,
      {
        projectId,
        projectName: row.project.name,
        question: row.question,
        originalResponse: row.response,
        userMessage: userMessage || (conversation.length > 0 ? conversation[conversation.length - 1]?.content : undefined),
        conversationLength: conversation.length,
        isFirstClarify,
        autoFlagged: isFirstClarify && !row.flaggedForReview,
      },
      requestContext
    );

    return apiSuccess({
      row: updatedRow,
      autoFlagged: isFirstClarify && !row.flaggedForReview,
    });
  } catch (error) {
    logger.error("Failed to log clarify usage", error, { route: "/api/projects/[id]/rows/[rowId]/clarify" });
    return errors.internal("Failed to log clarify usage");
  }
}
