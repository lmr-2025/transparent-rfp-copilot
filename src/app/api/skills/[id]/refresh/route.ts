import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { logSkillChange, getUserFromSession } from "@/lib/auditLog";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { CLAUDE_MODEL } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { SourceUrl, SkillHistoryEntry } from "@/types/skill";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

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

      return apiSuccess({
        hasChanges: false,
        message: "Source URLs re-fetched. No updates needed - skill is already up to date.",
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

  const systemPrompt = `You are a knowledge extraction specialist reviewing an existing skill against refreshed source material.

YOUR GOAL: Ensure the skill comprehensively covers ALL the information from the source URLs.

RETURN hasChanges: true IF ANY of these are true:
- Source contains information about platforms/integrations NOT in existing skill
- Source has specific technical details (numbers, versions, capabilities) not captured
- Source describes features, limitations, or requirements not mentioned
- Source covers topics/sections that the existing skill doesn't address
- Multiple source URLs exist but existing skill only covers content from one

RETURN hasChanges: false ONLY IF:
- The existing skill already covers ALL topics from ALL source URLs
- New content is purely marketing fluff with no concrete facts
- Changes would only be cosmetic rewording of existing information

IMPORTANT: If there are multiple source URLs about different topics (e.g., Snowflake, Teradata, Salesforce) but the existing skill only covers ONE topic, you MUST add the missing topics.

DIFF-FRIENDLY EDITING:
- Make SURGICAL edits - only change what needs to change
- PRESERVE the original structure and formatting
- ADD new sections for new topics at the end
- ADD new bullet points within existing sections where appropriate
- DO NOT rewrite content that doesn't need to change

OUTPUT (JSON only):
{
  "hasChanges": true/false,
  "summary": "What new facts/sections were added" OR "Skill already covers all source content",
  "title": "Keep same unless topic scope genuinely changed",
  "content": "COMPLETE skill content including both original AND new information",
  "changeHighlights": ["Added Snowflake integration details", "Added Teradata support info", ...] // Empty if no changes
}`;

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

  const stream = anthropic.messages.stream({
    model: CLAUDE_MODEL,
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
    model: CLAUDE_MODEL,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { urlCount: sourceUrls.length },
  });

  return parsed;
}
