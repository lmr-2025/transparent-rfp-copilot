import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

export const maxDuration = 60; // 1 minute for URL fetching + LLM analysis

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AnalysisResult = {
  accessible: boolean;
  error?: string;
  changeLevel: "minimal" | "moderate" | "significant";
  changePercentage: number;
  changeSummary: {
    newTopics: string[];
    updatedContent: string[];
    removedContent: string[];
  };
  recommendation: string;
};

/**
 * POST /api/skills/[id]/sources/analyze
 *
 * Analyzes a URL to determine if its content differs from the current skill.
 * Returns a high-level summary of changes without performing a full refresh.
 *
 * This is used in the "Add Source URL" flow to warn users about discrepancies
 * before they commit to adding the URL.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return errors.badRequest("URL is required");
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return errors.badRequest("Invalid URL format");
    }

    // Get the skill
    const skill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return errors.notFound("Skill");
    }

    // Fetch URL content
    let urlContent: string | null = null;
    let fetchError: string | undefined;

    try {
      urlContent = await fetchUrlContent(url, { maxLength: 20000 });
      if (!urlContent) {
        fetchError = "Unable to fetch content from URL";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      fetchError = errorMessage;
      logger.error("Failed to fetch URL for analysis", error, { url, skillId: id });
    }

    // If URL is not accessible, return early
    if (!urlContent) {
      return apiSuccess({
        accessible: false,
        error: fetchError || "Unable to access URL",
        changeLevel: "unknown" as const,
        changePercentage: 0,
        changeSummary: {
          newTopics: [],
          updatedContent: [],
          removedContent: [],
        },
        recommendation: "Unable to analyze - URL is not accessible",
      });
    }

    // Analyze differences using LLM
    const analysis = await analyzeContentDifferences(
      { title: skill.title, content: skill.content },
      urlContent,
      url,
      auth.session
    );

    return apiSuccess(analysis);
  } catch (error) {
    logger.error("Failed to analyze source URL", error, { route: "/api/skills/[id]/sources/analyze" });
    const message = error instanceof Error ? error.message : "Failed to analyze URL";
    return errors.internal(message);
  }
}

async function analyzeContentDifferences(
  existingSkill: { title: string; content: string },
  newUrlContent: string,
  sourceUrl: string,
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<AnalysisResult> {
  const anthropic = getAnthropicClient();

  // Load system prompt
  const systemPrompt = await loadSystemPrompt(
    "source_url_analysis",
    "You are a content analysis specialist who compares documents to identify key differences."
  );

  const userPrompt = `CURRENT SKILL:
Title: ${existingSkill.title}

Content:
${existingSkill.content}

---

NEW SOURCE URL CONTENT:
${newUrlContent}

Source: ${sourceUrl}

---

Compare the new source URL content with the current skill and analyze the differences.

Return a JSON object with:
{
  "changeLevel": "minimal" | "moderate" | "significant",
  "changePercentage": <number 0-100>,
  "changeSummary": {
    "newTopics": ["topic 1", "topic 2", ...],
    "updatedContent": ["update 1", "update 2", ...],
    "removedContent": ["removed 1", "removed 2", ...]
  },
  "recommendation": "<advice for the user>"
}

Guidelines:
- changeLevel: "minimal" if <15% different, "moderate" if 15-50%, "significant" if >50%
- changePercentage: rough estimate of how different the content is
- newTopics: major new sections or concepts not in current skill
- updatedContent: existing topics with meaningful changes
- removedContent: topics in current skill but missing/deprecated in new source
- recommendation: clear advice on whether to update the skill

Return ONLY the JSON object.`;

  const speed = getEffectiveSpeed("skills-refresh");
  const model = getModel(speed);

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 8000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const parsed = parseJsonResponse<AnalysisResult>(content.text);

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "source-url-analysis",
    model,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { sourceUrl },
  });

  return parsed;
}
