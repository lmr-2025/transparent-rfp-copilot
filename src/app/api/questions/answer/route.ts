import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { answerQuestionWithPrompt } from "@/lib/llm";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { logUsage } from "@/lib/usageTracking";
import { questionAnswerSchema, validateBody } from "@/lib/validations";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateBody(questionAnswerSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const question = data.question.trim();
  const skills = data.skills;
  const fallbackContent = data.fallbackContent;

  // Load prompt from database with dynamic mode/domain filtering
  const promptOptions = {
    mode: data.mode,
    domains: data.domains,
  };
  const promptText = data.prompt?.trim() || await loadSystemPrompt("questions", defaultQuestionPrompt, promptOptions);

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
          mode: data.mode,
          domains: data.domains,
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
