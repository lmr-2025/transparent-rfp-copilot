import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Get all documents with content (for LLM context)
export async function GET() {
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
