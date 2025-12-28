import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { SKILL_VOLUME } from "@/lib/constants";

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

type SplitSuggestion = {
  title: string;
  subtopic: string;
  relevantSources: number[]; // Indices of sources
  estimatedSize: number;
  reason: string;
};

type VolumeSplitRecommendation = {
  shouldSplit: boolean;
  reason: string;
  totalCharacterCount: number;
  volumeLevel: "normal" | "warning" | "critical";
  suggestedSplits?: SplitSuggestion[];
};

type CoherenceAnalysisResult = {
  coherent: boolean;
  coherenceLevel: "high" | "medium" | "low";
  coherencePercentage: number; // 0-100
  conflicts: CoherenceConflict[];
  recommendation: string;
  summary: string;
  volumeAnalysis?: VolumeSplitRecommendation;
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
    let coherenceAnalysis: CoherenceAnalysisResult;

    if (sourceContents.length <= 5) {
      // Multi-source comparison for small groups
      coherenceAnalysis = await analyzeGroupCoherence(
        sourceContents,
        groupTitle,
        auth.session
      );
    } else {
      // Draft-based comparison for large groups
      coherenceAnalysis = await analyzeLargeGroupCoherence(
        sourceContents,
        groupTitle,
        auth.session
      );
    }

    // Add volume analysis
    try {
      const volumeAnalysis = await analyzeVolume(sourceContents, groupTitle, auth.session);
      coherenceAnalysis.volumeAnalysis = volumeAnalysis;
    } catch (error) {
      logger.warn("Failed to analyze volume during coherence check", { groupTitle, error });
      // Continue without volume analysis - non-blocking
    }

    return apiSuccess(coherenceAnalysis);
  } catch (error) {
    logger.error("Failed to analyze group coherence", error, { route: "/api/skills/groups/analyze-coherence" });
    const message = error instanceof Error ? error.message : "Failed to analyze coherence";
    return errors.internal(message);
  }
}

async function analyzeVolume(
  sources: { index: number; label: string; content: string }[],
  groupTitle: string,
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<VolumeSplitRecommendation> {
  // Calculate total character count
  const totalCharacterCount = sources.reduce((sum, s) => sum + s.content.length, 0);

  // Determine volume level
  let volumeLevel: "normal" | "warning" | "critical";
  if (totalCharacterCount < SKILL_VOLUME.WARNING_THRESHOLD) {
    volumeLevel = "normal";
  } else if (totalCharacterCount < SKILL_VOLUME.SPLIT_THRESHOLD) {
    volumeLevel = "warning";
  } else {
    volumeLevel = "critical";
  }

  // If volume is normal or we don't have enough sources, skip LLM analysis
  if (volumeLevel === "normal" || sources.length < SKILL_VOLUME.MIN_SOURCES_FOR_SPLIT) {
    return {
      shouldSplit: false,
      reason: `Total content size (${totalCharacterCount.toLocaleString()} characters) is within acceptable limits for a single skill.`,
      totalCharacterCount,
      volumeLevel,
    };
  }

  // Use LLM to analyze subtopics and suggest splits
  const anthropic = getAnthropicClient();

  const systemPrompt = await loadSystemPrompt(
    "skill_volume_analysis",
    "You are a content organization specialist who identifies natural divisions in large collections of related information."
  );

  const sourcesSection = sources
    .map((s, idx) => `SOURCE ${idx}: ${s.label}\n\n${s.content.slice(0, 2000)}...\n\n${"=".repeat(80)}`)
    .join("\n\n");

  const userPrompt = `SKILL GROUP: "${groupTitle}"
TOTAL CONTENT SIZE: ${totalCharacterCount.toLocaleString()} characters
${sources.length} sources

CONTENT PREVIEW:
${sourcesSection}

---

This skill group has ${totalCharacterCount.toLocaleString()} characters of content across ${sources.length} sources.

${volumeLevel === "critical"
  ? `⚠️ CRITICAL: This exceeds ${SKILL_VOLUME.SPLIT_THRESHOLD.toLocaleString()} characters and should likely be split into multiple focused skills.`
  : `⚠️ WARNING: This exceeds ${SKILL_VOLUME.WARNING_THRESHOLD.toLocaleString()} characters and may benefit from splitting.`}

Your task: Analyze if this content naturally divides into DISTINCT SUBTOPICS that warrant separate skills.

Consider:
1. Are there 2-3 clear subtopics with minimal overlap?
2. Would splitting improve clarity and focused learning?
3. Does each subtopic have sufficient content (>5000 chars) to stand alone?
4. Are the subtopics distinct enough to justify separate skills?

Return a JSON object:
{
  "shouldSplit": boolean,
  "reason": "<why split is or isn't recommended>",
  "suggestedSplits": [
    {
      "title": "<suggested skill title>",
      "subtopic": "<description of what this covers>",
      "relevantSources": [<array of source indices 0-based>],
      "estimatedSize": <approximate character count>,
      "reason": "<why this grouping makes sense>"
    }
  ]
}

Guidelines:
- Only recommend split if there are truly distinct subtopics (not just arbitrary division)
- Each split should cover a coherent, focused area
- If content is just detailed on one topic, shouldSplit = false (better as comprehensive single skill)
- Aim for 2-3 splits maximum - more fragmentation reduces usefulness
- If shouldSplit = false, omit suggestedSplits array

Return ONLY the JSON object.`;

  const speed = getEffectiveSpeed("skills-refresh");
  const model = speed === "fast" ? "claude-3-5-haiku-20241022" : getModel(speed);

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 3000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format from volume analysis");
  }

  const parsed = parseJsonResponse<{
    shouldSplit: boolean;
    reason: string;
    suggestedSplits?: SplitSuggestion[];
  }>(content.text);

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "skill-volume-analysis",
    model,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { groupTitle, sourceCount: sources.length, totalChars: totalCharacterCount },
  });

  return {
    shouldSplit: parsed.shouldSplit,
    reason: parsed.reason,
    totalCharacterCount,
    volumeLevel,
    suggestedSplits: parsed.suggestedSplits,
  };
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
