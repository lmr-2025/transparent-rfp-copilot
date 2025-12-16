import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import { SkillCategory } from "@/types/skill";
import { getCategoryNamesFromDb } from "@/lib/categoryStorageServer";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

type RFPEntry = {
  question: string;
  answer: string;
};

type ExistingSkill = {
  id: string;
  title: string;
  category?: SkillCategory;
  categories?: string[];
  content: string;
};

type SkillSuggestion = {
  type: "update" | "new";
  skillId?: string;
  skillTitle: string;
  category?: SkillCategory;
  currentContent?: string;
  suggestedAdditions: string;
  relevantQA: RFPEntry[];
};

type AnalysisResult = {
  suggestions: SkillSuggestion[];
  unmatchedEntries: RFPEntry[];
};

export const maxDuration = 120; // 2 minutes for larger RFPs

export async function POST(request: NextRequest) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const body = await request.json();
    const rfpEntries = body.rfpEntries as RFPEntry[];
    const existingSkills = body.existingSkills as ExistingSkill[];

    if (!Array.isArray(rfpEntries) || rfpEntries.length === 0) {
      return errors.badRequest("No RFP entries provided");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return errors.internal("ANTHROPIC_API_KEY not configured");
    }

    const anthropic = new Anthropic({ apiKey });

    // Build the prompt
    const skillsSummary = existingSkills.length > 0
      ? existingSkills.map((s, i) => `${i + 1}. "${s.title}" (ID: ${s.id})\n   Category: ${s.category || s.categories?.[0] || "Uncategorized"}\n   Content preview: ${s.content.substring(0, 300)}...`).join("\n\n")
      : "No existing skills.";

    const categoriesList = (await getCategoryNamesFromDb()).join(", ");

    const rfpSummary = rfpEntries.map((e, i) =>
      `[${i + 1}] Q: ${e.question}\nA: ${e.answer}`
    ).join("\n\n---\n\n");

    // Load base prompt from block system
    const basePrompt = await loadSystemPrompt("skill_analyze_rfp", "You are a knowledge management expert.");

    // Build system prompt with dynamic categories
    const systemPrompt = `${basePrompt}

CATEGORIES:
Every skill must belong to exactly one category. Available categories:
${categoriesList}`;

    const userPrompt = `EXISTING SKILLS:
${skillsSummary}

RFP Q&A PAIRS TO ANALYZE:
${rfpSummary}

Analyze these Q&A pairs and suggest skill updates or new skills. Remember to:
1. Match Q&A pairs to existing skills by topic when possible
2. Only suggest new skills for genuinely new topics
3. Extract clean, reusable content from the answers
4. Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    // Parse the JSON response
    let parsed: {
      suggestions: Array<{
        type: "update" | "new";
        skillId?: string;
        skillTitle: string;
        suggestedAdditions: string;
        relevantQAIndices: number[];
      }>;
      unmatchedIndices: number[];
    };

    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```")) {
        const lines = jsonText.split("\n");
        lines.shift(); // Remove first line (```json)
        if (lines[lines.length - 1].trim() === "```") {
          lines.pop();
        }
        jsonText = lines.join("\n");
      }
      parsed = JSON.parse(jsonText);
    } catch {
      logger.error("Failed to parse LLM response", new Error("Parse error"), { route: "/api/skills/analyze-rfp", response: content.text.slice(0, 500) });
      throw new Error("Failed to parse analysis results");
    }

    // Convert indices to actual Q&A entries
    const result: AnalysisResult = {
      suggestions: parsed.suggestions.map((s) => ({
        type: s.type,
        skillId: s.skillId,
        skillTitle: s.skillTitle,
        currentContent: s.skillId
          ? existingSkills.find((sk) => sk.id === s.skillId)?.content
          : undefined,
        suggestedAdditions: s.suggestedAdditions,
        relevantQA: s.relevantQAIndices
          .filter((i) => i >= 1 && i <= rfpEntries.length)
          .map((i) => rfpEntries[i - 1]), // Convert 1-indexed to 0-indexed
      })),
      unmatchedEntries: parsed.unmatchedIndices
        .filter((i) => i >= 1 && i <= rfpEntries.length)
        .map((i) => rfpEntries[i - 1]),
    };

    return apiSuccess(result);
  } catch (error) {
    logger.error("RFP analysis error", error, { route: "/api/skills/analyze-rfp" });
    return errors.internal(error instanceof Error ? error.message : "Analysis failed");
  }
}
