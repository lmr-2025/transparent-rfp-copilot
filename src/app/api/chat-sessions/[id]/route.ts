import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Fetch a specific chat session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const { id } = await params;

    const chatSession = await prisma.chatSession.findFirst({
      where: userId ? { id, userId } : { id },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(chatSession);
  } catch (error) {
    console.error("Error fetching chat session:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat session" },
      { status: 500 }
    );
  }
}

// PUT - Update a chat session (add messages, update title)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const { id } = await params;
    const body = await request.json();
    const { title, messages, skillsUsed, documentsUsed, customersUsed, urlsUsed } = body;

    // Find the session (must belong to user if authenticated)
    const existingSession = await prisma.chatSession.findFirst({
      where: userId ? { id, userId } : { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (messages !== undefined) updateData.messages = messages;
    if (skillsUsed !== undefined) updateData.skillsUsed = skillsUsed;
    if (documentsUsed !== undefined) updateData.documentsUsed = documentsUsed;
    if (customersUsed !== undefined) updateData.customersUsed = customersUsed;
    if (urlsUsed !== undefined) updateData.urlsUsed = urlsUsed;

    const updated = await prisma.chatSession.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating chat session:", error);
    return NextResponse.json(
      { error: "Failed to update chat session" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific chat session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Ensure the session belongs to the current user
    const chatSession = await prisma.chatSession.findFirst({
      where: { id, userId },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
