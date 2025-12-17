import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { answerQuestionsBatch, type ModelSpeed } from "@/lib/llm";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { logUsage } from "@/lib/usageTracking";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Schema for batch question answering
const batchAnswerSchema = z.object({
  questions: z.array(z.object({
    index: z.number(),
    question: z.string().min(1),
  })).min(1).max(15), // Limit batch size to avoid output token limits
  skills: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })).optional(),
  fallbackContent: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
  })).optional(),
  prompt: z.string().optional(),
  mode: z.string().optional(),
  domains: z.array(z.string()).optional(),
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  quickMode: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest("Invalid JSON body.");
  }

  const validation = batchAnswerSchema.safeParse(body);
  if (!validation.success) {
    return errors.badRequest(validation.error.issues.map(e => e.message).join(", "));
  }

  const data = validation.data;
  const questions = data.questions;
  const skills = data.skills;
  const fallbackContent = data.fallbackContent;
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  const modelSpeed: ModelSpeed = data.quickMode ? "fast" : "quality";

  // Load prompt from database with dynamic mode/domain filtering
  const promptOptions = {
    mode: data.mode as "single" | "bulk" | undefined,
    domains: data.domains as ("technical" | "legal" | "security")[] | undefined,
  };
  const promptText = data.prompt?.trim() || await loadSystemPrompt("questions", defaultQuestionPrompt, promptOptions);

  try {
    const session = await getServerSession(authOptions);
    const result = await answerQuestionsBatch(questions, promptText, skills, fallbackContent, modelSpeed);

    // Log usage asynchronously (don't block the response)
    if (result.usage) {
      logUsage({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        feature: "questions-batch",
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        metadata: {
          questionCount: questions.length,
          skillCount: skills?.length || 0,
          hasFallback: result.usedFallback,
          mode: data.mode,
          domains: data.domains,
        },
      });
    }

    return apiSuccess({
      answers: result.answers,
      usedFallback: result.usedFallback,
    });
  } catch (error) {
    logger.error("Failed to answer batch questions", error, { route: "/api/questions/answer-batch" });
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate responses. Please try again later.";
    return errors.internal(message);
  }
}
