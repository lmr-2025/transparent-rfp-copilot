import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const prompt = await prisma.systemPrompt.create({
      data: {
        key: body.key,
        name: body.name,
        sections: body.sections,
        updatedBy: body.updatedBy,
      },
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
