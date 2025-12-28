import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logSkillChange, getUserFromSession } from "@/lib/auditLog";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { SourceUrl, SkillHistoryEntry } from "@/types/skill";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { getSkillSlug } from "@/lib/skillFiles";
import { updateSkillAndCommit } from "@/lib/skillGitSync";
import type { SkillFile } from "@/lib/skillFiles";

export const maxDuration = 120; // 2 minutes for URL fetching + LLM generation

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Response type for draft updates
type DraftUpdateResponse = {
  hasChanges: boolean;
  summary: string;
  title: string;
  content: string;
  changeHighlights: string[];
};

// POST /api/skills/[id]/refresh - Refresh a skill from its source URLs
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

    // Get the skill
    const skill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return errors.notFound("Skill");
    }

    // Check if skill has source URLs
    const sourceUrls = (skill.sourceUrls as SourceUrl[]) || [];
    if (sourceUrls.length === 0) {
      return errors.badRequest("This skill has no source URLs to refresh from");
    }

    // Fetch content from all source URLs
    const urlStrings = sourceUrls.map((s) => s.url);
    const sourceContent = await buildSourceMaterial(urlStrings);

    // Check for contradictions in sources (scales to any number of sources)
    let coherenceResult = null;
    if (urlStrings.length >= 1) {
      try {
        coherenceResult = await analyzeSourceCoherence(urlStrings, skill.title, auth.session);
      } catch (error) {
        logger.warn("Failed to analyze source coherence during refresh", { skillId: skill.id, error });
        // Continue without coherence analysis - non-blocking
      }
    }

    // Generate draft update comparing existing content with fresh source
    const draftResult = await generateDraftUpdate(
      { title: skill.title, content: skill.content },
      sourceContent,
      urlStrings,
      auth.session
    );

    // If no meaningful changes, just update lastRefreshedAt
    if (!draftResult.hasChanges) {
      const now = new Date();
      const updatedUrls = sourceUrls.map((u) => ({
        ...u,
        lastFetchedAt: now.toISOString(),
      }));

      const existingHistory = (skill.history as SkillHistoryEntry[]) || [];
      const newHistory: SkillHistoryEntry[] = [
        ...existingHistory,
        {
          date: now.toISOString(),
          action: "refreshed",
          summary: "Refreshed from source URLs - no changes needed",
          user: auth.session.user.email || undefined,
        },
      ];

      await prisma.skill.update({
        where: { id },
        data: {
          lastRefreshedAt: now,
          sourceUrls: updatedUrls,
          history: newHistory,
        },
      });

      // Build message with coherence info
      let message = "Source URLs re-fetched. No updates needed - skill is already up to date.";
      if (coherenceResult) {
        if (coherenceResult.coherent) {
          message += ` Sources are ${coherenceResult.coherencePercentage}% aligned with no discrepancies found.`;
        } else {
          message += ` However, ${coherenceResult.conflicts.length} discrepancy(ies) detected in sources.`;
        }
      }

      return apiSuccess({
        hasChanges: false,
        message,
        coherenceAnalysis: coherenceResult,
      });
    }

    // Return the draft for user review (don't auto-apply changes)
    return apiSuccess({
      hasChanges: true,
      draft: {
        title: draftResult.title,
        content: draftResult.content,
        changeHighlights: draftResult.changeHighlights,
        summary: draftResult.summary,
      },
      originalTitle: skill.title,
      originalContent: skill.content,
      coherenceAnalysis: coherenceResult,
    });
  } catch (error) {
    logger.error("Failed to refresh skill", error, { route: "/api/skills/[id]/refresh" });
    const message = error instanceof Error ? error.message : "Failed to refresh skill";
    return errors.internal(message);
  }
}

// Apply refresh changes after user approval
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { title, content, changeHighlights } = body;

    if (!title || !content) {
      return errors.badRequest("title and content are required");
    }

    // Get the skill
    const skill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return errors.notFound("Skill");
    }

    const now = new Date();
    const sourceUrls = (skill.sourceUrls as SourceUrl[]) || [];
    const updatedUrls = sourceUrls.map((u) => ({
      ...u,
      lastFetchedAt: now.toISOString(),
    }));

    const existingHistory = (skill.history as SkillHistoryEntry[]) || [];
    const changeSummary = Array.isArray(changeHighlights) && changeHighlights.length > 0
      ? changeHighlights.join("; ")
      : "Content updated from source URLs";

    const newHistory: SkillHistoryEntry[] = [
      ...existingHistory,
      {
        date: now.toISOString(),
        action: "refreshed",
        summary: `Refreshed: ${changeSummary}`,
        user: auth.session.user.email || undefined,
      },
    ];

    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: {
        title,
        content,
        lastRefreshedAt: now,
        sourceUrls: updatedUrls,
        history: newHistory,
      },
    });

    // Commit refresh to git (only if PUBLISHED - reviews disabled)
    if (updatedSkill.status === "PUBLISHED") {
      try {
        const oldSlug = getSkillSlug(skill.title);
        const newSlug = getSkillSlug(updatedSkill.title);

        // Build commit message with change highlights
        const changesSummary = Array.isArray(changeHighlights) && changeHighlights.length > 0
          ? `\n\n${changeHighlights.join("\n")}`
          : "";

        // Parse owners for git commit
        const owners = [
          ...(updatedSkill.ownerId && auth.session.user
            ? [
                {
                  name: auth.session.user.name || "Unknown",
                  email: auth.session.user.email || undefined,
                  userId: updatedSkill.ownerId,
                },
              ]
            : []),
          ...((updatedSkill.owners as Array<{ name: string; email?: string; userId?: string }>) || []),
        ];

        const skillFile: SkillFile = {
          id: updatedSkill.id,
          slug: newSlug,
          title: updatedSkill.title,
          content: updatedSkill.content,
          categories: updatedSkill.categories,
          owners,
          sources: (updatedSkill.sourceUrls as SkillFile["sources"]) || [],
          created: updatedSkill.createdAt.toISOString(),
          updated: updatedSkill.updatedAt.toISOString(),
          active: updatedSkill.isActive,
        };

        await updateSkillAndCommit(
          oldSlug,
          skillFile,
          `Refresh skill: ${updatedSkill.title}${changesSummary}`,
          {
            name: auth.session.user.name || auth.session.user.email || "Unknown",
            email: auth.session.user.email || "unknown@example.com",
          }
        );

        logger.info("Skill refresh committed to git", { skillId: updatedSkill.id, oldSlug, newSlug });
      } catch (gitError) {
        // Log git error but don't fail the request
        logger.error("Failed to commit skill refresh to git", gitError, {
          skillId: updatedSkill.id,
          title: updatedSkill.title,
        });
      }
    }

    // Audit log
    await logSkillChange(
      "REFRESHED",
      skill.id,
      skill.title,
      getUserFromSession(auth.session),
      { changeHighlights }
    );

    return apiSuccess({ skill: updatedSkill });
  } catch (error) {
    logger.error("Failed to apply refresh changes", error, { route: "/api/skills/[id]/refresh" });
    const message = error instanceof Error ? error.message : "Failed to apply changes";
    return errors.internal(message);
  }
}

async function buildSourceMaterial(sourceUrls: string[]): Promise<string> {
  const sections: string[] = [];

  // Fetch all URLs in parallel
  const urlResults = await Promise.all(
    sourceUrls.map(async (url) => {
      const text = await fetchUrlContent(url, { maxLength: 20000 });
      return text ? `Source: ${url}\n${text}` : null;
    })
  );
  sections.push(...urlResults.filter((s): s is string => s !== null));

  if (sections.length === 0) {
    throw new Error("Unable to load any content from the source URLs.");
  }

  const combined = sections.join("\n\n---\n\n").trim();
  return combined.slice(0, 100000);
}

async function generateDraftUpdate(
  existingSkill: { title: string; content: string },
  newSourceContent: string,
  sourceUrls: string[],
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<DraftUpdateResponse> {
  const anthropic = getAnthropicClient();

  // Load system prompt from block system
  const systemPrompt = await loadSystemPrompt("skill_refresh", "You are a knowledge extraction specialist.");

  const userPrompt = `EXISTING SKILL:
Title: ${existingSkill.title}

Current Content:
${existingSkill.content}

---

REFRESHED SOURCE MATERIAL:
${newSourceContent}

${sourceUrls.length > 0 ? `\nSource URLs: ${sourceUrls.join(", ")}` : ""}

---

Review the refreshed source material against the existing skill.
- If there's significant new/changed information, return an updated draft with hasChanges=true
- If the source is the same or doesn't add value, return hasChanges=false

Return ONLY the JSON object.`;

  // Determine model speed
  const speed = getEffectiveSpeed("skills-refresh");
  const model = getModel(speed);

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 32000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const parsed = parseJsonResponse<DraftUpdateResponse>(content.text);

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "skills-refresh",
    model,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { urlCount: sourceUrls.length },
  });

  return parsed;
}

// Analyze source coherence for contradictions (source-vs-skill comparison)
async function analyzeSourceCoherence(
  sourceUrls: string[],
  skillTitle: string,
  authSession: { user?: { id?: string; email?: string | null } } | null
) {
  const skill = await prisma.skill.findFirst({
    where: { title: skillTitle },
    select: { content: true },
  });

  if (!skill) {
    throw new Error("Skill not found for coherence analysis");
  }

  const anthropic = getAnthropicClient();

  // Fetch all source contents in parallel
  const sourceContents = await Promise.all(
    sourceUrls.map(async (url, idx) => {
      const content = await fetchUrlContent(url, { maxLength: 15000 });
      return {
        index: idx,
        url,
        content: content || "[Could not fetch content]",
      };
    })
  );

  // Analyze each source against the skill content in parallel
  const analyses = await Promise.all(
    sourceContents.map(async (source) => {
      const systemPrompt = await loadSystemPrompt(
        "source_skill_coherence",
        "You are a content analysis specialist who identifies contradictions between source materials and finalized content."
      );

      const userPrompt = `FINALIZED SKILL: "${skillTitle}"

Skill Content (established truth):
${skill.content}

---

SOURCE TO ANALYZE:
URL: ${source.url}

${source.content}

---

Your task: Determine if this source CONTRADICTS the finalized skill content.

The skill content represents the agreed-upon information. Check if the source:
1. Contradicts technical details in the skill
2. Provides outdated information that conflicts with the skill
3. Recommends different approaches than the skill establishes
4. Contains version mismatches or deprecated information
5. Takes an incompatible stance on topics covered by the skill

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
  "recommendation": "<should this source be updated, removed, or is it acceptable?>",
  "summary": "<brief summary of alignment or conflicts>"
}

Guidelines:
- contradicts = false if source aligns with or complements the skill
- contradicts = true ONLY if actual contradictions exist (and issues array is populated)
- Be specific about what contradicts and provide examples
- If contradicts = true, issues array MUST have at least one detailed entry

Return ONLY the JSON object.`;

      const speed = getEffectiveSpeed("skills-refresh");
      const model = speed === "fast" ? "claude-3-5-haiku-20241022" : getModel(speed);

      const stream = anthropic.messages.stream({
        model,
        max_tokens: 2000,
        temperature: 0.1,
        system: systemPrompt,
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
        feature: "skill-refresh-coherence",
        model,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        metadata: { skillTitle, sourceUrl: source.url },
      });

      return {
        sourceIndex: source.index,
        sourceUrl: source.url,
        ...parsed,
      };
    })
  );

  // Aggregate results
  const conflictingSources = analyses.filter((a) => a.contradicts);
  const avgAlignment = Math.round(
    analyses.reduce((sum, a) => sum + a.alignment, 0) / analyses.length
  );

  // Flatten all issues with source attribution
  const allConflicts = conflictingSources.flatMap((source) =>
    source.issues.map((issue) => ({
      type: issue.type,
      description: `Source ${source.sourceIndex + 1} (${source.sourceUrl}): ${issue.description}`,
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
        ? "All sources align with the skill content"
        : `${conflictingSources.length} of ${sourceUrls.length} sources contain contradictions - review recommended`,
    summary:
      conflictingSources.length === 0
        ? `All ${sourceUrls.length} sources align with the finalized skill content`
        : `${conflictingSources.length} source(s) contradict the skill content`,
    sourceAnalyses: analyses.map((a) => ({
      sourceIndex: a.sourceIndex,
      sourceUrl: a.sourceUrl,
      contradicts: a.contradicts,
      alignment: a.alignment,
      issues: a.issues,
      recommendation: a.recommendation,
      summary: a.summary,
    })),
  };
}
