import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getModel } from "@/lib/config";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

export const maxDuration = 60;

// Fallback prompt in case the prompt blocks fail to load
const FALLBACK_PLANNING_PROMPT = `You are a knowledge architect helping users plan how to organize source materials into skills.

You have access to:
- Summaries of the URLs and documents the user has added
- The existing skill library (titles and content previews)

Your job is to help the user decide:
1. How many skills should be created from these sources?
2. What should each skill be named and cover?
3. Should any sources be combined or kept separate?
4. Is there overlap with existing skills that should be addressed?
5. What key questions should each skill answer?

Be conversational and helpful. Ask 1-2 questions at a time.
When the user approves a plan, output it in this format:
---SKILL_PLAN---
Skills:
- [Skill Name]: Sources: [list], Scope: [description], Questions: [key questions it answers]
Merge with existing: [existing skill name, or 'None']
---END_PLAN---`;

type Message = {
  role: "assistant" | "user";
  content: string;
};

type SourceUrl = {
  url: string;
  title?: string;
  preview?: string;
};

type SourceDocument = {
  id: string;
  filename: string;
  preview?: string;
};

type ExistingSkill = {
  id: string;
  title: string;
  contentPreview: string;
};

type SkillWithSources = {
  id: string;
  title: string;
  content: string;
  sourceUrls?: string[];
};

type ModeContext =
  | { mode: "normal" }
  | { mode: "merge"; skillsToMerge: SkillWithSources[] }
  | { mode: "split"; skillToSplit: SkillWithSources }
  | { mode: "gap"; topic: string };

type PlanRequest = {
  message: string;
  conversationHistory: Message[];
  sources: {
    urls: SourceUrl[];
    documents: SourceDocument[];
  };
  existingSkills: ExistingSkill[];
  modeContext?: ModeContext;
};

// Parse the skill plan from the response
function parseSkillPlan(response: string): {
  skills: Array<{
    name: string;
    sources: string[];
    scope: string;
    questions: string[];
    mergeWith?: string;
  }>;
} | null {
  const planMatch = response.match(/---SKILL_PLAN---\s*([\s\S]*?)---END_PLAN---/);
  if (!planMatch) return null;

  const planContent = planMatch[1].trim();
  const skills: Array<{
    name: string;
    sources: string[];
    scope: string;
    questions: string[];
    mergeWith?: string;
  }> = [];

  // Parse skill lines
  const lines = planContent.split("\n");
  let mergeWith: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for merge directive
    if (trimmed.toLowerCase().startsWith("merge with existing:")) {
      const mergeValue = trimmed.replace(/merge with existing:/i, "").trim();
      if (mergeValue.toLowerCase() !== "none") {
        mergeWith = mergeValue;
      }
      continue;
    }

    // Parse skill line: "- [Name]: Sources: [list], Scope: [desc], Questions: [list]"
    const skillMatch = trimmed.match(/^-\s*(.+?):\s*Sources?:\s*(.+?),\s*Scope:\s*(.+?),\s*Questions?:\s*(.+)$/i);
    if (skillMatch) {
      const [, name, sourcesStr, scope, questionsStr] = skillMatch;
      skills.push({
        name: name.trim(),
        sources: sourcesStr.split(",").map((s: string) => s.trim()),
        scope: scope.trim(),
        questions: questionsStr.split(",").map((q: string) => q.trim()),
        mergeWith,
      });
    }
  }

  return skills.length > 0 ? { skills } : null;
}

// GET - Fetch the system prompt for transparency
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const systemPrompt = await loadSystemPrompt(
      "skill_planning",
      FALLBACK_PLANNING_PROMPT
    );

    const model = getModel("quality");

    return apiSuccess({
      systemPrompt,
      model,
    });
  } catch (error) {
    logger.error("Failed to fetch planning prompt", error, {
      route: "/api/skills/plan",
    });
    return errors.internal("Failed to fetch prompts");
  }
}

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
    const body = await request.json() as PlanRequest;
    const { message, conversationHistory, sources, existingSkills, modeContext } = body;

    if (!message?.trim()) {
      return errors.badRequest("Message is required");
    }

    // Load the planning system prompt
    const systemPrompt = await loadSystemPrompt(
      "skill_planning",
      FALLBACK_PLANNING_PROMPT
    );

    // Build context about sources
    const sourceContext = buildSourceContext(sources, existingSkills);

    // Build mode-specific context
    const modeContextStr = buildModeContextString(modeContext);

    // Build the full system prompt with context
    const fullSystemPrompt = `${systemPrompt}
${modeContextStr}
## Current Sources

${sourceContext}`;

    // Build conversation messages
    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    const anthropic = new Anthropic();
    const model = getModel("quality"); // Use quality model for better planning

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: fullSystemPrompt,
      messages,
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Try to parse a skill plan from the response
    const plan = parseSkillPlan(responseText);

    return apiSuccess({
      response: responseText,
      plan,
      transparency: {
        systemPrompt: fullSystemPrompt,
        model,
        sourceCount: (sources?.urls?.length || 0) + (sources?.documents?.length || 0),
        existingSkillCount: existingSkills?.length || 0,
      },
    });
  } catch (error) {
    logger.error("Failed to plan skills", error, {
      route: "/api/skills/plan",
    });
    return errors.internal("Failed to generate response");
  }
}

function buildSourceContext(
  sources: PlanRequest["sources"],
  existingSkills: ExistingSkill[]
): string {
  const parts: string[] = [];

  // Add URL sources
  if (sources?.urls?.length > 0) {
    parts.push("### URLs Added");
    for (const url of sources.urls) {
      if (url.title && url.preview) {
        parts.push(`- **${url.title}** (${url.url})\n  ${url.preview}`);
      } else if (url.title) {
        parts.push(`- **${url.title}** (${url.url})`);
      } else {
        parts.push(`- ${url.url}`);
      }
    }
  }

  // Add document sources
  if (sources?.documents?.length > 0) {
    parts.push("\n### Documents Added");
    for (const doc of sources.documents) {
      if (doc.preview) {
        parts.push(`- **${doc.filename}**\n  ${doc.preview}`);
      } else {
        parts.push(`- ${doc.filename}`);
      }
    }
  }

  // Add existing skills
  if (existingSkills?.length > 0) {
    parts.push("\n### Existing Skills in Library");
    for (const skill of existingSkills) {
      parts.push(`- **${skill.title}**\n  ${skill.contentPreview}`);
    }
  } else {
    parts.push("\n### Existing Skills in Library\nNo existing skills yet.");
  }

  return parts.join("\n");
}

function buildModeContextString(modeContext?: ModeContext): string {
  if (!modeContext || modeContext.mode === "normal") {
    return "";
  }

  const parts: string[] = [];

  if (modeContext.mode === "merge") {
    parts.push("## MERGE MODE");
    parts.push("The user wants to MERGE the following skills into a single unified skill:");
    parts.push("");
    for (const skill of modeContext.skillsToMerge) {
      parts.push(`### ${skill.title}`);
      parts.push(skill.content);
      if (skill.sourceUrls && skill.sourceUrls.length > 0) {
        parts.push("");
        parts.push("**Original Sources:**");
        for (const url of skill.sourceUrls) {
          parts.push(`- ${url}`);
        }
      }
      parts.push("");
    }
    parts.push("Help the user combine these skills effectively. Identify overlaps, suggest a unified structure, and recommend what to keep from each.");
    parts.push("");
  } else if (modeContext.mode === "split") {
    parts.push("## SPLIT MODE");
    parts.push("The user wants to SPLIT this skill into multiple focused skills:");
    parts.push("");
    parts.push(`### ${modeContext.skillToSplit.title}`);
    parts.push(modeContext.skillToSplit.content);
    if (modeContext.skillToSplit.sourceUrls && modeContext.skillToSplit.sourceUrls.length > 0) {
      parts.push("");
      parts.push("**Original Sources:**");
      for (const url of modeContext.skillToSplit.sourceUrls) {
        parts.push(`- ${url}`);
      }
    }
    parts.push("");
    parts.push("Help the user identify distinct topics within this skill that could become separate skills. Suggest how to divide the content logically.");
    parts.push("");
  } else if (modeContext.mode === "gap") {
    parts.push("## GAP MODE");
    parts.push(`The user identified a gap in their knowledge library and wants to create a skill about: **${modeContext.topic}**`);
    parts.push("");
    parts.push("Help the user plan this new skill. Suggest what it should cover, what sources might be helpful, and what questions it should answer.");
    parts.push("");
  }

  return parts.join("\n");
}
