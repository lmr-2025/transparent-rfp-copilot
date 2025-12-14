import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";

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

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to fetch document content:", error);
    return NextResponse.json(
      { error: "Failed to fetch document content" },
      { status: 500 }
    );
  }
}
