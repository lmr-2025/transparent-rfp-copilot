import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { answerQuestionWithPrompt } from "@/lib/llm";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { logUsage } from "@/lib/usageTracking";

type QuestionRequestBody = {
  question?: string;
  prompt?: string;
  skills?: { title: string; content: string; tags: string[] }[];
  fallbackContent?: { title: string; url: string; content: string }[];
};

export async function POST(request: NextRequest) {
  let body: QuestionRequestBody;
  try {
    body = (await request.json()) as QuestionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = body?.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  const promptText = (body?.prompt ?? "").trim() || defaultQuestionPrompt;
  const skills = Array.isArray(body?.skills) ? body.skills : undefined;
  const fallbackContent = Array.isArray(body?.fallbackContent) ? body.fallbackContent : undefined;

  try {
    const session = await getServerSession(authOptions);
    const result = await answerQuestionWithPrompt(question, promptText, skills, fallbackContent);

    // Log usage asynchronously (don't block the response)
    if (result.usage) {
      logUsage({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        feature: "questions",
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        metadata: {
          skillCount: skills?.length || 0,
          hasFallback: result.usedFallback,
        },
      });
    }

    return NextResponse.json({
      answer: result.answer,
      conversationHistory: result.conversationHistory,
      usedFallback: result.usedFallback,
    });
  } catch (error) {
    console.error("Failed to answer question:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate response. Please try again later.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
