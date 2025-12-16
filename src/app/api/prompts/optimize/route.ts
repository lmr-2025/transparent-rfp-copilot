import { NextRequest } from "next/server";
import { CLAUDE_MODEL } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logUsage } from "@/lib/usageTracking";
import { getAnthropicClient, parseJsonResponse } from "@/lib/apiHelpers";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

type PromptSection = {
  id: string;
  title: string;
  text: string;
  enabled: boolean;
};

type OptimizationSuggestion = {
  sectionId: string;
  sectionTitle: string;
  type: "remove" | "simplify" | "merge" | "restructure";
  priority: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
  originalText: string;
  optimizedText?: string;
  tokenSavings?: number;
};

type OptimizePromptRequest = {
  promptType: string;
  sections: PromptSection[];
  outputFormat?: string; // "plain_text" | "json" | "markdown" - what format the prompt produces
};

type OptimizePromptResponse = {
  suggestions: OptimizationSuggestion[];
  summary: string;
  currentTokenEstimate: number;
  potentialTokenEstimate: number;
  savingsPercent: number;
  transparency: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

// Rough token estimation (4 chars ≈ 1 token)
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export async function POST(request: NextRequest) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  const session = await getServerSession(authOptions);

  let body: OptimizePromptRequest;
  try {
    body = (await request.json()) as OptimizePromptRequest;
  } catch {
    return errors.badRequest("Invalid JSON body.");
  }

  const { promptType, sections, outputFormat = "plain_text" } = body;

  if (!Array.isArray(sections) || sections.length === 0) {
    return errors.badRequest("No sections to analyze.");
  }

  const enabledSections = sections.filter(s => s.enabled && s.text.trim());
  if (enabledSections.length === 0) {
    return errors.badRequest("No enabled sections with content.");
  }

  try {
    const anthropic = getAnthropicClient();

    const currentTokenEstimate = enabledSections.reduce(
      (sum, s) => sum + estimateTokens(s.text),
      0
    );

    // Load the base system prompt from the block system (editable via /admin/prompt-blocks)
    const baseSystemPrompt = await loadSystemPrompt("prompt_optimize", "You are a prompt engineering expert.");

    // Add task-specific context
    const outputFormatContext = outputFormat === "json"
      ? "The prompt produces JSON output, so JSON-related formatting instructions are NECESSARY and should NOT be simplified."
      : outputFormat === "markdown"
      ? "The prompt produces markdown output, so markdown formatting instructions may be NECESSARY depending on use case."
      : "The prompt produces plain text with section headers. Verbose markdown formatting examples are usually UNNECESSARY.";

    const taskContext = `
YOUR TASK:
Analyze the provided prompt sections and identify opportunities to reduce token usage while maintaining clarity and effectiveness.

OUTPUT FORMAT CONTEXT:
${outputFormatContext}

PRIORITY LEVELS:
- high: >30% token reduction possible, or clearly unnecessary content
- medium: 10-30% token reduction, meaningful simplification
- low: <10% improvement, nice-to-have optimizations

RETURN JSON:
{
  "suggestions": [
    {
      "sectionId": "section_id",
      "sectionTitle": "Section Title",
      "type": "remove" | "simplify" | "merge" | "restructure",
      "priority": "high" | "medium" | "low",
      "issue": "Brief description of the problem",
      "suggestion": "What to do about it",
      "originalText": "The problematic text (can be excerpt)",
      "optimizedText": "The suggested replacement (for simplify/restructure)",
      "tokenSavings": 50
    }
  ],
  "summary": "2-3 sentence overall assessment of the prompt's efficiency"
}

IMPORTANT RULES:
- Only flag REAL issues, not hypothetical ones
- Be specific about what text is problematic
- Provide concrete optimizedText for simplify suggestions
- tokenSavings should be a realistic estimate
- Maximum 8 suggestions, prioritize highest impact`;

    const systemPrompt = baseSystemPrompt + taskContext;

    const sectionsContext = enabledSections
      .map(s => `--- SECTION: ${s.title} (id: ${s.id}) ---\n${s.text}`)
      .join("\n\n");

    const userPrompt = `Analyze this "${promptType}" prompt for optimization opportunities:

${sectionsContext}

Current estimated tokens: ${currentTokenEstimate}
Output format: ${outputFormat}

Return ONLY the JSON object with your analysis.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    // Log usage
    logUsage({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      feature: "prompt-optimize",
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: { promptType, sectionCount: enabledSections.length },
    });

    const parsed = parseJsonResponse<{
      suggestions: OptimizationSuggestion[];
      summary: string;
    }>(content.text);

    // Calculate potential savings
    const totalSavings = parsed.suggestions.reduce(
      (sum, s) => sum + (s.tokenSavings || 0),
      0
    );
    const potentialTokenEstimate = Math.max(0, currentTokenEstimate - totalSavings);
    const savingsPercent = currentTokenEstimate > 0
      ? Math.round((totalSavings / currentTokenEstimate) * 100)
      : 0;

    const result: OptimizePromptResponse = {
      suggestions: parsed.suggestions.slice(0, 8),
      summary: parsed.summary || "Analysis complete.",
      currentTokenEstimate,
      potentialTokenEstimate,
      savingsPercent,
      transparency: {
        systemPrompt,
        userPrompt,
        model: CLAUDE_MODEL,
        maxTokens: 4000,
        temperature: 0.2,
      },
    };

    return apiSuccess(result);
  } catch (error) {
    logger.error("Prompt optimization error", error, { route: "/api/prompts/optimize" });
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze prompt";
    return errors.internal(errorMessage);
  }
}
