import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";

type ExistingSkillInfo = {
  id: string;
  title: string;
  tags: string[];
  contentPreview: string; // First ~500 chars to keep prompt small
  sourceUrls?: string[]; // URLs already used to build this skill
};

type AnalyzeRequestBody = {
  sourceUrls: string[];
  existingSkills: ExistingSkillInfo[];
};

type SkillSuggestion = {
  action: "create_new" | "update_existing" | "split_topics";
  // For update_existing
  existingSkillId?: string;
  existingSkillTitle?: string;
  // For create_new or split_topics
  suggestedTitle?: string;
  suggestedTags?: string[];
  // For split_topics - multiple skills to create
  splitSuggestions?: {
    title: string;
    description: string;
    relevantUrls: string[];
  }[];
  // Explanation
  reason: string;
  // URL match info
  urlMatchedSkillId?: string;
  urlMatchedSkillTitle?: string;
};

type AnalyzeResponse = {
  suggestion: SkillSuggestion;
  sourcePreview: string; // Brief summary of what the URLs contain
  urlAlreadyUsed?: {
    skillId: string;
    skillTitle: string;
    matchedUrls: string[];
  };
};

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls.map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  if (sourceUrls.length === 0) {
    return NextResponse.json({ error: "Provide at least one source URL." }, { status: 400 });
  }

  const existingSkills: ExistingSkillInfo[] = Array.isArray(body?.existingSkills) ? body.existingSkills : [];

  try {
    // First, check if any URLs are already used in existing skills
    const urlMatches = findUrlMatches(sourceUrls, existingSkills);

    // Fetch URL content (limited)
    const sourceContent = await fetchSourceContent(sourceUrls);
    if (!sourceContent) {
      return NextResponse.json({ error: "Could not fetch any content from the provided URLs." }, { status: 400 });
    }

    // Analyze with LLM
    const analysis = await analyzeContent(sourceContent, sourceUrls, existingSkills);

    // If we found URL matches, include that info and potentially override suggestion
    if (urlMatches) {
      // If ALL URLs match a single skill, strongly suggest updating that skill
      const allUrlsMatchSameSkill = urlMatches.matchedUrls.length === sourceUrls.length;

      if (allUrlsMatchSameSkill) {
        return NextResponse.json({
          ...analysis,
          urlAlreadyUsed: urlMatches,
          suggestion: {
            ...analysis.suggestion,
            action: "update_existing" as const,
            existingSkillId: urlMatches.skillId,
            existingSkillTitle: urlMatches.skillTitle,
            reason: `These URLs were previously used to build "${urlMatches.skillTitle}". Updating that skill will refresh it with the latest content.`,
          },
        });
      }

      // Some URLs match - include the info but let LLM suggestion stand
      return NextResponse.json({
        ...analysis,
        urlAlreadyUsed: urlMatches,
      });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to analyze URLs:", error);
    const message = error instanceof Error ? error.message : "Unable to analyze URLs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Check if any of the input URLs were already used to build existing skills
function findUrlMatches(
  inputUrls: string[],
  existingSkills: ExistingSkillInfo[]
): { skillId: string; skillTitle: string; matchedUrls: string[] } | null {
  // Normalize URLs for comparison (remove trailing slashes, lowercase)
  const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, "");

  for (const skill of existingSkills) {
    if (!skill.sourceUrls || skill.sourceUrls.length === 0) continue;

    const skillUrlsNormalized = skill.sourceUrls.map(normalizeUrl);
    const matchedUrls = inputUrls.filter(url =>
      skillUrlsNormalized.includes(normalizeUrl(url))
    );

    if (matchedUrls.length > 0) {
      return {
        skillId: skill.id,
        skillTitle: skill.title,
        matchedUrls,
      };
    }
  }

  return null;
}

async function fetchSourceContent(urls: string[]): Promise<string | null> {
  const sections: string[] = [];

  for (const url of urls.slice(0, 10)) { // Limit to 10 URLs
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;

      const response = await fetch(parsed.toString(), {
        headers: { "User-Agent": "GRCMinionAnalyzer/1.0" },
      });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text")) continue;

      const text = await response.text();
      // Take first 5000 chars per URL for analysis (we just need to understand the topic)
      sections.push(`Source: ${url}\n${text.slice(0, 5000)}`);
    } catch {
      continue;
    }
  }

  if (sections.length === 0) return null;
  return sections.join("\n\n---\n\n").slice(0, 30000); // Cap total at 30k
}

async function analyzeContent(
  sourceContent: string,
  sourceUrls: string[],
  existingSkills: { id: string; title: string; tags: string[]; contentPreview: string }[]
): Promise<AnalyzeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const skillsSummary = existingSkills.length > 0
    ? existingSkills.map(s => `- "${s.title}" (ID: ${s.id})\n  Tags: ${s.tags.join(", ") || "none"}\n  Preview: ${s.contentPreview.substring(0, 200)}...`).join("\n\n")
    : "No existing skills in the knowledge base.";

  const systemPrompt = `You are a knowledge management expert helping organize security documentation into focused, topic-specific skills.

Your task is to analyze new source material and decide how it should be organized:

PRINCIPLES:
1. Skills should be FOCUSED on a single topic area (like "Data Encryption", "Access Control", "Incident Response")
2. Avoid creating overly broad skills that cover multiple unrelated topics
3. If content matches an existing skill's topic, UPDATE that skill rather than creating duplicates
4. If content covers multiple distinct topics, suggest SPLITTING into separate skills

DECISION TREE:
1. First, check if the content is clearly about ONE topic that matches an existing skill → UPDATE_EXISTING
2. If it's ONE topic but no existing skill matches → CREATE_NEW
3. If the content covers MULTIPLE distinct topics → SPLIT_TOPICS (suggest 2-4 focused skills)

OUTPUT FORMAT:
Return a JSON object:
{
  "suggestion": {
    "action": "create_new" | "update_existing" | "split_topics",

    // For update_existing:
    "existingSkillId": "id of the skill to update",
    "existingSkillTitle": "title of the skill",

    // For create_new:
    "suggestedTitle": "Concise, specific title",
    "suggestedTags": ["relevant", "tags"],

    // For split_topics:
    "splitSuggestions": [
      {
        "title": "First Topic Skill",
        "description": "What this skill would cover",
        "relevantUrls": ["urls that relate to this topic"]
      },
      {
        "title": "Second Topic Skill",
        "description": "What this skill would cover",
        "relevantUrls": ["urls that relate to this topic"]
      }
    ],

    "reason": "Brief explanation of why this action was chosen"
  },
  "sourcePreview": "2-3 sentence summary of what the source material contains"
}

GUIDELINES:
- Be specific with titles (not "Security Policy" but "Data Classification Policy" or "Network Security Controls")
- Consider semantic overlap, not just keyword matching
- If updating existing, the content should genuinely expand/update that skill's topic
- For splits, each resulting skill should be independently useful`;

  const userPrompt = `EXISTING SKILLS IN KNOWLEDGE BASE:
${skillsSummary}

---

NEW SOURCE MATERIAL FROM ${sourceUrls.length} URL(s):
${sourceUrls.join("\n")}

Content preview:
${sourceContent}

---

Analyze this content and decide: Should it update an existing skill, create a new focused skill, or be split into multiple topic-specific skills?

Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  // Parse JSON response
  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    const lines = jsonText.split("\n");
    lines.shift();
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    jsonText = lines.join("\n");
  }

  return JSON.parse(jsonText) as AnalyzeResponse;
}
