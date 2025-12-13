import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch question history for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ history: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const history = await prisma.questionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        question: true,
        response: true,
        confidence: true,
        sources: true,
        reasoning: true,
        inference: true,
        remarks: true,
        skillsUsed: true,
        createdAt: true,
      },
    });

    const total = await prisma.questionHistory.count({
      where: { userId },
    });

    return NextResponse.json({ history, total });
  } catch (error) {
    console.error("Error fetching question history:", error);
    return NextResponse.json(
      { error: "Failed to fetch question history" },
      { status: 500 }
    );
  }
}

// POST - Save a new question to history
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    // Allow saving even without auth (for anonymous users)
    const body = await request.json();
    const { question, response, confidence, sources, reasoning, inference, remarks, skillsUsed } = body;

    if (!question || !response) {
      return NextResponse.json(
        { error: "Question and response are required" },
        { status: 400 }
      );
    }

    const entry = await prisma.questionHistory.create({
      data: {
        userId: userId || null,
        userEmail: userEmail || null,
        question,
        response,
        confidence: confidence || null,
        sources: sources || null,
        reasoning: reasoning || null,
        inference: inference || null,
        remarks: remarks || null,
        skillsUsed: skillsUsed || null,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error saving question history:", error);
    return NextResponse.json(
      { error: "Failed to save question history" },
      { status: 500 }
    );
  }
}

// DELETE - Clear all history for current user
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await prisma.questionHistory.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing question history:", error);
    return NextResponse.json(
      { error: "Failed to clear question history" },
      { status: 500 }
    );
  }
}
