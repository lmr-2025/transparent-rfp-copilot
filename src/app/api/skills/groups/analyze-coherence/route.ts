import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

export const maxDuration = 90; // 1.5 minutes for multiple URL fetches + LLM analysis

type SourceInput =
  | { type: "url"; url: string }
  | { type: "document"; id: string; content: string; filename: string };

type ConflictType =
  | "technical_contradiction"
  | "version_mismatch"
  | "scope_mismatch"
  | "outdated_vs_current"
  | "different_perspectives";

type CoherenceConflict = {
  type: ConflictType;
  description: string;
  affectedSources: number[]; // Indices of sources involved
  severity: "low" | "medium" | "high";
};

type CoherenceAnalysisResult = {
  coherent: boolean;
  coherenceLevel: "high" | "medium" | "low";
  coherencePercentage: number; // 0-100
  conflicts: CoherenceConflict[];
  recommendation: string;
  summary: string;
};

/**
 * POST /api/skills/groups/analyze-coherence
 *
 * Analyzes whether multiple sources (URLs/documents) are coherent and should be grouped together.
 * Used in bulk import flow to validate AI-suggested groupings.
 *
 * Filters applied (per Option 1):
 * - Only analyze groups with 2-5 sources
 * - Use Haiku model for speed/cost
 * - Non-blocking (runs in background)
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { sources, groupTitle } = body;

    if (!Array.isArray(sources) || sources.length === 0) {
      return errors.badRequest("sources array is required");
    }

    if (!groupTitle || typeof groupTitle !== "string") {
      return errors.badRequest("groupTitle is required");
    }

    // Filter: Only analyze groups with 2-5 sources (Option 1)
    if (sources.length < 2) {
      return apiSuccess({
        coherent: true,
        coherenceLevel: "high" as const,
        coherencePercentage: 100,
        conflicts: [],
        recommendation: "Single source - no coherence check needed",
        summary: "Only one source in group",
      });
    }

    if (sources.length > 5) {
      return apiSuccess({
        coherent: true,
        coherenceLevel: "medium" as const,
        coherencePercentage: 75,
        conflicts: [],
        recommendation: "Large group - consider reviewing manually after generation",
        summary: "Group has many sources - skipping detailed coherence analysis",
      });
    }

    // Fetch content from all sources
    const sourceContents: { index: number; label: string; content: string }[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];

      if (source.type === "url") {
        try {
          const content = await fetchUrlContent(source.url, { maxLength: 15000 });
          if (content) {
            sourceContents.push({
              index: i,
              label: `URL: ${source.url}`,
              content,
            });
          } else {
            sourceContents.push({
              index: i,
              label: `URL: ${source.url}`,
              content: "[Could not fetch content]",
            });
          }
        } catch (error) {
          logger.warn("Failed to fetch URL for coherence analysis", { url: source.url, error });
          sourceContents.push({
            index: i,
            label: `URL: ${source.url}`,
            content: "[Fetch failed]",
          });
        }
      } else if (source.type === "document") {
        sourceContents.push({
          index: i,
          label: `Document: ${source.filename}`,
          content: source.content.slice(0, 15000), // Limit document content
        });
      }
    }

    // Analyze coherence using LLM
    const analysis = await analyzeGroupCoherence(
      sourceContents,
      groupTitle,
      auth.session
    );

    return apiSuccess(analysis);
  } catch (error) {
    logger.error("Failed to analyze group coherence", error, { route: "/api/skills/groups/analyze-coherence" });
    const message = error instanceof Error ? error.message : "Failed to analyze coherence";
    return errors.internal(message);
  }
}

async function analyzeGroupCoherence(
  sources: { index: number; label: string; content: string }[],
  groupTitle: string,
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<CoherenceAnalysisResult> {
  const anthropic = getAnthropicClient();

  // Load system prompt
  const systemPrompt = await loadSystemPrompt(
    "group_coherence_analysis",
    "You are a content analysis specialist who evaluates whether multiple sources should be grouped together."
  );

  // Build sources section
  const sourcesSection = sources
    .map((s, idx) => `SOURCE ${idx + 1}: ${s.label}\n\n${s.content}\n\n${"=".repeat(80)}`)
    .join("\n\n");

  const userPrompt = `PROPOSED SKILL GROUP: "${groupTitle}"

SOURCES TO ANALYZE:

${sourcesSection}

---

Analyze whether these ${sources.length} sources are COHERENT and should be grouped into a single skill titled "${groupTitle}".

Look for:
1. TECHNICAL CONTRADICTIONS: Do sources recommend conflicting approaches?
2. VERSION MISMATCHES: Do sources cover different versions (v1 vs v2)?
3. SCOPE MISMATCHES: Do sources cover fundamentally different topics?
4. OUTDATED VS CURRENT: Are some sources outdated while others are current?
5. DIFFERENT PERSPECTIVES: Do sources take incompatible stances?

Return a JSON object:
{
  "coherent": boolean,
  "coherenceLevel": "high" | "medium" | "low",
  "coherencePercentage": <number 0-100>,
  "conflicts": [
    {
      "type": "technical_contradiction" | "version_mismatch" | "scope_mismatch" | "outdated_vs_current" | "different_perspectives",
      "description": "<specific conflict description>",
      "affectedSources": [<source indices starting from 0>],
      "severity": "low" | "medium" | "high"
    }
  ],
  "recommendation": "<actionable advice: keep grouped, split, or remove specific sources>",
  "summary": "<brief 1-2 sentence summary of coherence status>"
}

Guidelines:
- coherent = true if sources complement each other despite minor differences
- coherent = false if sources fundamentally conflict or cover different topics
- coherenceLevel: "high" if >80% aligned, "medium" if 50-80%, "low" if <50%
- List ALL significant conflicts found
- Be specific in descriptions (mention actual differences, not just "sources differ")
- Recommend splits with suggested new group titles if needed

Return ONLY the JSON object.`;

  // Use Haiku for speed/cost (Option 1)
  const speed = getEffectiveSpeed("skills-refresh");
  const model = speed === "fast" ? "claude-3-5-haiku-20241022" : getModel(speed);

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 4000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const parsed = parseJsonResponse<CoherenceAnalysisResult>(content.text);

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "group-coherence-analysis",
    model,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { groupTitle, sourceCount: sources.length },
  });

  return parsed;
}
