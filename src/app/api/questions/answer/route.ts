import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { answerQuestionWithPrompt, answerQuestionProgressive, type ModelSpeed, type ProgressiveAnswerResult, type AnswerResult } from "@/lib/llm";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { logUsage } from "@/lib/usageTracking";
import { questionAnswerSchema, validateBody } from "@/lib/validations";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

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

  const validation = validateBody(questionAnswerSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const data = validation.data;
  const question = data.question.trim();
  const skills = data.skills;
  const tier1Skills = data.tier1Skills;
  const categories = data.categories;
  const useProgressive = data.useProgressive ?? true; // Default to progressive loading
  const fallbackContent = data.fallbackContent;
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  const modelSpeed: ModelSpeed = data.quickMode ? "fast" : "quality";

  // Load prompt from database with dynamic mode/domain filtering
  const promptOptions = {
    mode: data.mode,
    domains: data.domains,
  };
  const promptText = data.prompt?.trim() || await loadSystemPrompt("questions", defaultQuestionPrompt, promptOptions);

  try {
    const session = await getServerSession(authOptions);

    // Use progressive loading if tier1Skills provided, otherwise use legacy mode
    let result: AnswerResult | ProgressiveAnswerResult;
    if (useProgressive && tier1Skills) {
      result = await answerQuestionProgressive({
        question,
        promptText,
        tier1Skills,
        selectedCategories: categories,
        enableTier2: true,
        enableTier3: true,
        modelSpeed,
      });
    } else {
      result = await answerQuestionWithPrompt(question, promptText, skills, fallbackContent, modelSpeed);
    }

    // Type guard for progressive result
    const isProgressiveResult = (r: AnswerResult | ProgressiveAnswerResult): r is ProgressiveAnswerResult => {
      return 'tier' in r;
    };

    // Log usage asynchronously (don't block the response)
    if (result.usage) {
      const progressiveMetadata = isProgressiveResult(result) ? {
        tier: result.tier,
        tier2SkillsFound: result.tier2SkillsFound,
        tier3SkillsFound: result.tier3SkillsFound,
      } : {};

      logUsage({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        feature: "questions",
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        metadata: {
          skillCount: skills?.length || tier1Skills?.length || 0,
          hasFallback: result.usedFallback,
          mode: data.mode,
          domains: data.domains,
          ...progressiveMetadata,
        },
      });
    }

    // Track skill usage asynchronously (don't block the response)
    const skillIds = (tier1Skills || skills || [])
      .map((s) => s.id)
      .filter((id): id is string => !!id);

    if (skillIds.length > 0) {
      // Update usage tracking in background
      prisma.skill
        .updateMany({
          where: { id: { in: skillIds } },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
        .catch((error) => {
          // Log but don't fail the request
          logger.error("Failed to update skill usage", error);
        });
    }

    // Build response with tier information if available
    const responseData: {
      answer: string;
      conversationHistory?: any[];
      usedFallback: boolean;
      tier?: number;
      tier2SkillsFound?: number;
      tier3SkillsFound?: number;
    } = {
      answer: result.answer,
      conversationHistory: result.conversationHistory,
      usedFallback: result.usedFallback,
    };

    if (isProgressiveResult(result)) {
      responseData.tier = result.tier;
      responseData.tier2SkillsFound = result.tier2SkillsFound;
      responseData.tier3SkillsFound = result.tier3SkillsFound;
    }

    return apiSuccess(responseData);
  } catch (error) {
    logger.error("Failed to answer question", error, { route: "/api/questions/answer" });
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate response. Please try again later.";
    return errors.internal(message);
  }
}
