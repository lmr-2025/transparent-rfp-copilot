import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ key: string }>;
};

// GET /api/system-prompts/[key] - Get a system prompt by key
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { key } = await context.params;

    const prompt = await prisma.systemPrompt.findUnique({
      where: { key },
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "System prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(prompt);
  } catch (error) {
    console.error("Failed to fetch system prompt:", error);
    return NextResponse.json(
      { error: "Failed to fetch system prompt" },
      { status: 500 }
    );
  }
}

// PUT /api/system-prompts/[key] - Update or create a system prompt
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { key } = await context.params;
    const body = await request.json();

    const prompt = await prisma.systemPrompt.upsert({
      where: { key },
      create: {
        key,
        name: body.name || key,
        sections: body.sections,
        updatedBy: body.updatedBy,
      },
      update: {
        name: body.name,
        sections: body.sections,
        updatedBy: body.updatedBy,
      },
    });

    return NextResponse.json(prompt);
  } catch (error) {
    console.error("Failed to update system prompt:", error);
    return NextResponse.json(
      { error: "Failed to update system prompt" },
      { status: 500 }
    );
  }
}

// DELETE /api/system-prompts/[key] - Delete a system prompt
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { key } = await context.params;

    await prisma.systemPrompt.delete({
      where: { key },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete system prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete system prompt" },
      { status: 500 }
    );
  }
}
