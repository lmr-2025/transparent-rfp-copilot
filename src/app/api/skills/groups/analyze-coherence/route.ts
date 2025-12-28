import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

export const maxDuration = 180; // 3 minutes for URL fetches + draft generation + LLM analysis

type SourceInput =
  | { type: "url"; url: string }
  | { type: "document"; id: string; content: string; filename: string };

type DraftSkill = {
  title: string;
  content: string;
};

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
 * Scalability approach:
 * - Groups with 2-5 sources: Multi-source comparison (all sources analyzed together)
 * - Groups with 6+ sources: Draft-based comparison (generate draft from first 5, validate rest against draft)
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

    // Skip analysis for single source
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

    // Choose analysis strategy based on group size
    let analysis: CoherenceAnalysisResult;

    if (sourceContents.length <= 5) {
      // Multi-source comparison for small groups
      analysis = await analyzeGroupCoherence(
        sourceContents,
        groupTitle,
        auth.session
      );
    } else {
      // Draft-based comparison for large groups
      analysis = await analyzeLargeGroupCoherence(
        sourceContents,
        groupTitle,
        auth.session
      );
    }

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

// Analyze large groups (6+ sources) using draft-based approach
async function analyzeLargeGroupCoherence(
  sources: { index: number; label: string; content: string }[],
  groupTitle: string,
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<CoherenceAnalysisResult> {
  const anthropic = getAnthropicClient();

  // Step 1: Generate draft skill content from first 5 sources
  const firstFiveSources = sources.slice(0, 5);
  const remainingSources = sources.slice(5);

  logger.info("Analyzing large group with draft-based approach", {
    totalSources: sources.length,
    firstFiveCount: firstFiveSources.length,
    remainingCount: remainingSources.length,
    groupTitle,
  });

  // Build source material from first 5 sources
  const sourceMaterial = firstFiveSources
    .map((s) => `Source ${s.index + 1}: ${s.label}\n\n${s.content}`)
    .join("\n\n---\n\n");

  // Generate draft skill content
  const systemPrompt = await loadSystemPrompt(
    "skills",
    "You are a knowledge extraction specialist who creates comprehensive, accurate documentation from source materials."
  );

  const draftPrompt = `Source material:
${sourceMaterial}

Create a skill titled "${groupTitle}" that comprehensively covers ALL information from these sources.

Return a SINGLE JSON object with:
{
  "title": "${groupTitle}",
  "content": "Complete skill content in markdown format"
}`;

  const speed = getEffectiveSpeed("skills-refresh");
  const model = speed === "fast" ? "claude-3-5-haiku-20241022" : getModel(speed);

  const draftStream = anthropic.messages.stream({
    model,
    max_tokens: 16000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: draftPrompt }],
  });

  const draftResponse = await draftStream.finalMessage();
  const draftContent = draftResponse.content[0];

  if (draftContent.type !== "text") {
    throw new Error("Unexpected draft response format");
  }

  const draft = parseJsonResponse<DraftSkill>(draftContent.text);

  // Log draft generation usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "group-coherence-draft",
    model,
    inputTokens: draftResponse.usage?.input_tokens || 0,
    outputTokens: draftResponse.usage?.output_tokens || 0,
    metadata: { groupTitle, sourceCount: firstFiveSources.length },
  });

  // Step 2: Analyze remaining sources against the draft (parallel)
  const systemPromptCoherence = await loadSystemPrompt(
    "source_skill_coherence",
    "You are a content analysis specialist who identifies contradictions between source materials and finalized content."
  );

  const analyses = await Promise.all(
    remainingSources.map(async (source) => {
      const userPrompt = `DRAFT SKILL: "${draft.title}"

Draft Content (reference):
${draft.content}

---

SOURCE TO ANALYZE:
${source.label}

${source.content}

---

Your task: Determine if this source CONTRADICTS the draft skill content.

The draft was created from the first 5 sources. Check if this additional source:
1. Contradicts technical details in the draft
2. Provides conflicting information
3. Recommends different approaches than the draft establishes
4. Contains version mismatches or deprecated information
5. Takes an incompatible stance on topics covered by the draft

Return a JSON object:
{
  "contradicts": boolean,
  "alignment": <number 0-100, where 100 = perfect alignment>,
  "issues": [
    {
      "type": "technical_contradiction" | "outdated_information" | "different_approach" | "version_mismatch" | "incompatible_stance",
      "description": "<specific contradiction with examples>",
      "severity": "low" | "medium" | "high"
    }
  ],
  "recommendation": "<should this source be reviewed, removed, or is it acceptable?>",
  "summary": "<brief summary of alignment or conflicts>"
}

Guidelines:
- contradicts = false if source aligns with or complements the draft
- contradicts = true ONLY if actual contradictions exist (and issues array is populated)
- Be specific about what contradicts and provide examples
- If contradicts = true, issues array MUST have at least one detailed entry

Return ONLY the JSON object.`;

      const stream = anthropic.messages.stream({
        model,
        max_tokens: 2000,
        temperature: 0.1,
        system: systemPromptCoherence,
        messages: [{ role: "user", content: userPrompt }],
      });

      const response = await stream.finalMessage();
      const content = response.content[0];

      if (content.type !== "text") {
        throw new Error("Unexpected response format");
      }

      const parsed = parseJsonResponse<{
        contradicts: boolean;
        alignment: number;
        issues: Array<{
          type: string;
          description: string;
          severity: "low" | "medium" | "high";
        }>;
        recommendation: string;
        summary: string;
      }>(content.text);

      // Log usage for this source
      logUsage({
        userId: authSession?.user?.id,
        userEmail: authSession?.user?.email,
        feature: "group-coherence-source-check",
        model,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        metadata: { groupTitle, sourceIndex: source.index },
      });

      return {
        sourceIndex: source.index,
        sourceLabel: source.label,
        ...parsed,
      };
    })
  );

  // Step 3: Aggregate results
  const conflictingSources = analyses.filter((a) => a.contradicts);
  const avgAlignment = remainingSources.length > 0
    ? Math.round(analyses.reduce((sum, a) => sum + a.alignment, 0) / analyses.length)
    : 100; // If all sources were in first 5, assume 100% alignment

  // Flatten all issues with source attribution
  const allConflicts: CoherenceConflict[] = conflictingSources.flatMap((source) =>
    source.issues.map((issue) => ({
      type: issue.type as ConflictType,
      description: `Source ${source.sourceIndex + 1} (${source.sourceLabel}): ${issue.description}`,
      affectedSources: [source.sourceIndex],
      severity: issue.severity,
    }))
  );

  return {
    coherent: conflictingSources.length === 0,
    coherenceLevel: (avgAlignment > 90 ? "high" : avgAlignment > 70 ? "medium" : "low") as
      | "high"
      | "medium"
      | "low",
    coherencePercentage: avgAlignment,
    conflicts: allConflicts,
    recommendation:
      conflictingSources.length === 0
        ? `All ${sources.length} sources align well - draft generated from first 5 sources`
        : `${conflictingSources.length} of ${remainingSources.length} additional sources contain contradictions - review recommended`,
    summary:
      conflictingSources.length === 0
        ? `Draft generated from first 5 sources. Remaining ${remainingSources.length} sources align with the draft.`
        : `Draft generated from first 5 sources. ${conflictingSources.length} of ${remainingSources.length} additional sources contradict the draft.`,
  };
}
