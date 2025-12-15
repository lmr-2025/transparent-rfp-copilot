import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { createAuditLog, getUserFromSession } from "@/lib/auditLog";

// GET /api/system-prompts - List all system prompts
export async function GET() {
  try {
    const prompts = await prisma.systemPrompt.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json(prompts);
  } catch (error) {
    console.error("Failed to fetch system prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch system prompts" },
      { status: 500 }
    );
  }
}

// POST /api/system-prompts - Create a new system prompt
// Admin-only: System prompts control LLM behavior
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const prompt = await prisma.systemPrompt.create({
      data: {
        key: body.key,
        name: body.name,
        sections: body.sections,
        updatedBy: auth.session.user.email || auth.session.user.id,
      },
    });

    // Audit log
    await createAuditLog({
      entityType: "PROMPT",
      entityId: prompt.key,
      entityTitle: prompt.name,
      action: "CREATED",
      user: getUserFromSession(auth.session),
      metadata: { sectionCount: Array.isArray(body.sections) ? body.sections.length : 0 },
    });

    return NextResponse.json(prompt, { status: 201 });
  } catch (error) {
    console.error("Failed to create system prompt:", error);
    return NextResponse.json(
      { error: "Failed to create system prompt" },
      { status: 500 }
    );
  }
}
