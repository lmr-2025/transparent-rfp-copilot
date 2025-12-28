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
 * Finds contradictions within source groups BEFORE skill creation.
 * Used during bulk import to validate that grouped sources don't conflict with each other.
 *
 * Note: This is for NEW skill creation where no finalized content exists yet.
 * For EXISTING skills, use the refresh endpoint which compares sources against finalized skill content.
 *
 * Filters applied:
 * - Only analyze groups with 2-5 sources (prevents token limits)
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
    "You are a content analysis specialist who finds contradictions and conflicts within topically-aligned source materials."
  );

  // Build sources section
  const sourcesSection = sources
    .map((s, idx) => `SOURCE ${idx + 1}: ${s.label}\n\n${s.content}\n\n${"=".repeat(80)}`)
    .join("\n\n");

  const userPrompt = `SKILL GROUP: "${groupTitle}"

SOURCES TO ANALYZE FOR CONTRADICTIONS:

${sourcesSection}

---

These ${sources.length} sources have been grouped together under "${groupTitle}" because they cover the same topic.

Your task: FIND CONTRADICTIONS within these topically-aligned sources.

Look for:
1. TECHNICAL CONTRADICTIONS: Do sources recommend conflicting approaches or incompatible solutions?
2. VERSION MISMATCHES: Do sources cover different versions with breaking changes?
3. CONFLICTING GUIDANCE: Do sources give contradictory advice about the same topic?
4. OUTDATED VS CURRENT: Are some sources outdated with deprecated information while others are current?
5. DIFFERENT PERSPECTIVES: Do sources take incompatible stances on the same issue?

IMPORTANT:
- These sources are ALREADY grouped by topic - don't flag "scope mismatch" unless they truly contradict
- If you find conflicts, you MUST provide specific descriptions with details from the sources
- Empty conflicts array is ONLY acceptable if sources truly have no contradictions
- coherent = false REQUIRES conflicts.length > 0 with detailed descriptions

Return a JSON object:
{
  "coherent": boolean,
  "coherenceLevel": "high" | "medium" | "low",
  "coherencePercentage": <number 0-100>,
  "conflicts": [
    {
      "type": "technical_contradiction" | "version_mismatch" | "scope_mismatch" | "outdated_vs_current" | "different_perspectives",
      "description": "<REQUIRED: specific conflict with examples from sources>",
      "affectedSources": [<source indices starting from 0>],
      "severity": "low" | "medium" | "high"
    }
  ],
  "recommendation": "<actionable advice: which source to trust, need manual review, or safe to proceed>",
  "summary": "<brief 1-2 sentence summary focusing on conflicts found or alignment confirmed>"
}

Guidelines:
- coherent = true if sources align and complement each other
- coherent = false ONLY if you found actual contradictions (and conflicts array is populated)
- coherenceLevel: "high" if >90% aligned, "medium" if 70-90%, "low" if <70%
- List ALL contradictions found with specific details
- Be specific: quote or reference actual conflicting statements
- If coherent = false, conflicts array MUST have at least one detailed entry

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
