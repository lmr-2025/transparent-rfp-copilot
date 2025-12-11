import { NextRequest, NextResponse } from "next/server";
import { answerQuestionWithPrompt } from "@/lib/llm";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";

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
    const result = await answerQuestionWithPrompt(question, promptText, skills, fallbackContent);
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
        : "Unable to generate response from GRC Minion. Please try again later.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
