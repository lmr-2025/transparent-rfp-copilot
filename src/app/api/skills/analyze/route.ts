import { NextRequest, NextResponse } from "next/server";
import { CLAUDE_MODEL } from "@/lib/config";
import { SkillCategory } from "@/types/skill";
import { getCategoryNamesFromDb } from "@/lib/categoryStorageServer";
import { validateUrlForSSRF } from "@/lib/ssrfProtection";
import { getAnthropicClient, parseJsonResponse } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

type ExistingSkillInfo = {
  id: string;
  title: string;
  category?: SkillCategory;
  categories?: string[];
  contentPreview: string; // First ~500 chars to keep prompt small
  sourceUrls?: string[]; // URLs already used to build this skill
};

type AnalyzeRequestBody = {
  sourceUrls: string[];
  existingSkills: ExistingSkillInfo[];
  groupUrls?: boolean; // If true, return grouped skill recommendations for all URLs at once
};

type SkillSuggestion = {
  action: "create_new" | "update_existing" | "split_topics";
  // For update_existing
  existingSkillId?: string;
  existingSkillTitle?: string;
  // For create_new or split_topics
  suggestedTitle?: string;
  suggestedCategory?: SkillCategory;
  // For split_topics - multiple skills to create
  splitSuggestions?: {
    title: string;
    category: SkillCategory;
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

// For grouped URL analysis
type SkillGroup = {
  action: "create" | "update_existing";
  skillTitle: string;
  existingSkillId?: string;
  urls: string[];
  reason: string;
};

type GroupedAnalyzeResponse = {
  skillGroups: SkillGroup[];
  summary: string;
};

export async function POST(request: NextRequest) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

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
  const groupUrls = body?.groupUrls === true;

  try {
    // For grouped analysis (bulk import), use the dedicated grouped analysis function
    if (groupUrls && sourceUrls.length > 1) {
      const groupedAnalysis = await analyzeAndGroupUrls(sourceUrls, existingSkills);
      return NextResponse.json(groupedAnalysis);
    }

    // Single URL analysis (original behavior)
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
  // Fetch all URLs in parallel for better performance
  const fetchPromises = urls.slice(0, 10).map(async (url): Promise<string | null> => {
    try {
      // SSRF protection: validate URL before fetching
      const ssrfCheck = await validateUrlForSSRF(url);
      if (!ssrfCheck.valid) {
        console.warn(`SSRF check failed for URL ${url}: ${ssrfCheck.error}`);
        return null;
      }

      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

      const response = await fetch(parsed.toString(), {
        headers: { "User-Agent": "GRCMinionAnalyzer/1.0" },
      });
      if (!response.ok) return null;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text")) return null;

      const text = await response.text();
      // Take first 5000 chars per URL for analysis (we just need to understand the topic)
      return `Source: ${url}\n${text.slice(0, 5000)}`;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  const sections = results.filter((s): s is string => s !== null);

  if (sections.length === 0) return null;
  return sections.join("\n\n---\n\n").slice(0, 30000); // Cap total at 30k
}

async function analyzeContent(
  sourceContent: string,
  sourceUrls: string[],
  existingSkills: { id: string; title: string; category?: SkillCategory; categories?: string[]; contentPreview: string }[]
): Promise<AnalyzeResponse> {
  const anthropic = getAnthropicClient();

  const skillsSummary = existingSkills.length > 0
    ? existingSkills.map(s => `- "${s.title}" (ID: ${s.id})\n  Category: ${s.category || s.categories?.[0] || "Uncategorized"}\n  Preview: ${s.contentPreview.substring(0, 200)}...`).join("\n\n")
    : "No existing skills in the knowledge base.";

  const categoriesList = (await getCategoryNamesFromDb()).join(", ");

  const systemPrompt = `You are a knowledge management expert helping organize documentation into broad, comprehensive skills.

Your task is to analyze new source material and decide how it should be organized.

GOAL: Build a compact knowledge base of 15-30 comprehensive skills, NOT 100+ narrow ones.

PRINCIPLES:
1. Skills should cover BROAD CAPABILITY AREAS (like "Security & Compliance", "Data Platform", "Integrations & APIs", "Monitoring & Alerting")
2. STRONGLY PREFER updating existing skills over creating new ones
3. Only create a new skill if the content is genuinely unrelated to ALL existing skills
4. Think of skills like chapters in a book, not individual pages

DECISION TREE:
1. First, look for ANY existing skill that could reasonably contain this content → UPDATE_EXISTING
2. Only if no existing skill is even remotely related → CREATE_NEW
3. RARELY use split_topics - only if content covers 2+ completely unrelated domains

CONSOLIDATION BIAS:
- When in doubt, UPDATE an existing skill
- A skill about "Security" can absorb content about encryption, access control, compliance, etc.
- A skill about "Integrations" can absorb content about APIs, webhooks, SSO, authentication, etc.
- A skill about "Data Platform" can absorb content about pipelines, warehouses, queries, etc.

CATEGORIES:
Every skill must belong to exactly one category. Available categories:
${categoriesList}

OUTPUT FORMAT:
Return a JSON object:
{
  "suggestion": {
    "action": "create_new" | "update_existing" | "split_topics",

    // For update_existing:
    "existingSkillId": "id of the skill to update",
    "existingSkillTitle": "title of the skill",

    // For create_new:
    "suggestedTitle": "Broad capability area title",
    "suggestedCategory": "One of the categories above",
    "suggestedTags": ["relevant", "tags"],

    // For split_topics (use rarely):
    "splitSuggestions": [
      {
        "title": "First Capability Area",
        "category": "One of the categories above",
        "description": "What this skill would cover",
        "relevantUrls": ["urls that relate to this topic"]
      }
    ],

    "reason": "Brief explanation of why this action was chosen"
  },
  "sourcePreview": "2-3 sentence summary of what the source material contains"
}

TITLE GUIDELINES:
- Use broad titles: "Security & Compliance", "Monitoring & Observability", "Data Integration"
- Avoid narrow titles: "Password Policy", "Alert Thresholds", "Webhook Setup"
- Think: "What chapter of the docs would this belong in?"`;

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

  return parseJsonResponse<AnalyzeResponse>(content.text);
}

// Analyze multiple URLs and group them into skill recommendations
async function analyzeAndGroupUrls(
  sourceUrls: string[],
  existingSkills: ExistingSkillInfo[]
): Promise<GroupedAnalyzeResponse> {
  const anthropic = getAnthropicClient();

  // Fetch content from all URLs (with limits)
  const urlContents: { url: string; content: string }[] = [];
  for (const url of sourceUrls.slice(0, 20)) { // Limit to 20 URLs
    try {
      const ssrfCheck = await validateUrlForSSRF(url);
      if (!ssrfCheck.valid) continue;

      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;

      const response = await fetch(parsed.toString(), {
        headers: { "User-Agent": "GRCMinionAnalyzer/1.0" },
      });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text")) continue;

      const text = await response.text();
      // Take first 3000 chars per URL to fit more in context
      urlContents.push({ url, content: text.slice(0, 3000) });
    } catch {
      // Include URL even if we couldn't fetch it
      urlContents.push({ url, content: "[Could not fetch content]" });
    }
  }

  const skillsSummary = existingSkills.length > 0
    ? existingSkills.map(s => `- "${s.title}" (ID: ${s.id})\n  Category: ${s.category || s.categories?.[0] || "Uncategorized"}\n  Preview: ${s.contentPreview.substring(0, 150)}...`).join("\n")
    : "No existing skills in the knowledge base.";

  const urlSummary = urlContents.map((u, i) =>
    `[URL ${i + 1}] ${u.url}\nContent preview: ${u.content.substring(0, 500)}...`
  ).join("\n\n");

  const systemPrompt = `You are a knowledge management expert helping organize documentation URLs into skills.

Your task is to analyze multiple URLs and GROUP them into skill recommendations. Each group becomes one skill.

GOAL: Group related URLs together so each skill is comprehensive. A skill should cover a BROAD CAPABILITY AREA.

RULES:
1. Group URLs by TOPIC SIMILARITY - URLs about the same feature/capability go together
2. PREFER updating existing skills over creating new ones
3. Each URL must appear in exactly one group
4. A group can have 1 or many URLs
5. Skills should be broad (like book chapters, not individual pages)

OUTPUT FORMAT:
Return a JSON object:
{
  "skillGroups": [
    {
      "action": "create" | "update_existing",
      "skillTitle": "Name of the skill",
      "existingSkillId": "ID if updating existing skill",
      "urls": ["array of URLs in this group"],
      "reason": "Why these URLs belong together and why this action"
    }
  ],
  "summary": "Brief overall summary of how URLs were organized"
}

GROUPING GUIDELINES:
- URLs from the same documentation section → same group
- URLs about the same product feature → same group
- If a URL clearly relates to an existing skill → update_existing
- Only create new skills for genuinely new topics`;

  const userPrompt = `EXISTING SKILLS:
${skillsSummary}

---

URLs TO ANALYZE (${sourceUrls.length} total):
${urlSummary}

---

Group these URLs into skill recommendations. Each group will become or update one skill.
Related URLs should be grouped together.
URLs that match existing skills should update those skills.

Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const parsed = parseJsonResponse<GroupedAnalyzeResponse>(content.text);

  // Ensure all URLs are accounted for (add any missing ones)
  const groupedUrls = new Set(parsed.skillGroups.flatMap(g => g.urls));
  const missingUrls = sourceUrls.filter(url => !groupedUrls.has(url));

  if (missingUrls.length > 0) {
    // Add missing URLs to a "Miscellaneous" group
    parsed.skillGroups.push({
      action: "create",
      skillTitle: "Miscellaneous Documentation",
      urls: missingUrls,
      reason: "URLs that couldn't be categorized into other groups",
    });
  }

  return parsed;
}
