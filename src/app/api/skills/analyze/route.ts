import { NextRequest } from "next/server";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { SkillCategory } from "@/types/skill";
import { getCategoryNamesFromDb } from "@/lib/categoryStorageServer";
import { validateUrlForSSRF } from "@/lib/ssrfProtection";
import { getAnthropicClient, parseJsonResponse } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

type ExistingSkillInfo = {
  id: string;
  title: string;
  category?: SkillCategory;
  categories?: string[];
  contentPreview: string; // First ~500 chars to keep prompt small
  sourceUrls?: string[]; // URLs already used to build this skill
};

type AnalyzeRequestBody = {
  sourceUrls?: string[];
  sourceDocuments?: { id: string; filename: string; content: string }[]; // Documents with extracted text
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
  documentIds?: string[]; // Document IDs if source is documents
  category?: string; // AI-suggested category for new skills
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
    return errors.badRequest("Invalid JSON body.");
  }

  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls.map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  const sourceDocuments = Array.isArray(body?.sourceDocuments)
    ? body.sourceDocuments.filter((doc) => doc.id && doc.content)
    : [];

  if (sourceUrls.length === 0 && sourceDocuments.length === 0) {
    return errors.badRequest("Provide at least one source URL or document.");
  }

  const existingSkills: ExistingSkillInfo[] = Array.isArray(body?.existingSkills) ? body.existingSkills : [];
  const groupUrls = body?.groupUrls === true;

  try {
    // For grouped analysis (bulk import), use the dedicated grouped analysis function
    // Now supports both URLs and documents
    const totalSources = sourceUrls.length + sourceDocuments.length;
    if (groupUrls && totalSources >= 1) {
      const groupedAnalysis = await analyzeAndGroupSources(sourceUrls, sourceDocuments, existingSkills);
      return apiSuccess(groupedAnalysis);
    }

    // Single URL analysis (original behavior)
    // First, check if any URLs are already used in existing skills
    const urlMatches = findUrlMatches(sourceUrls, existingSkills);

    // Fetch URL content (limited)
    const sourceContent = await fetchSourceContent(sourceUrls);
    if (!sourceContent) {
      return errors.badRequest("Could not fetch any content from the provided URLs.");
    }

    // Analyze with LLM
    const analysis = await analyzeContent(sourceContent, sourceUrls, existingSkills);

    // If we found URL matches, include that info and potentially override suggestion
    if (urlMatches) {
      // If ALL URLs match a single skill, strongly suggest updating that skill
      const allUrlsMatchSameSkill = urlMatches.matchedUrls.length === sourceUrls.length;

      if (allUrlsMatchSameSkill) {
        return apiSuccess({
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
      return apiSuccess({
        ...analysis,
        urlAlreadyUsed: urlMatches,
      });
    }

    return apiSuccess(analysis);
  } catch (error) {
    logger.error("Failed to analyze URLs", error, { route: "/api/skills/analyze" });
    const message = error instanceof Error ? error.message : "Unable to analyze URLs.";
    return errors.internal(message);
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
        logger.warn("SSRF check failed for URL", { url, error: ssrfCheck.error });
        return null;
      }

      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

      const response = await fetch(parsed.toString(), {
        headers: { "User-Agent": "GRCMinionAnalyzer/1.0" },
        signal: AbortSignal.timeout(10000), // 10 second timeout per URL
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

  // Load base prompt from block system
  const basePrompt = await loadSystemPrompt("skill_analyze", "You are a knowledge management expert.");

  // Build system prompt with dynamic categories
  const systemPrompt = `${basePrompt}

CATEGORIES:
Every skill must belong to exactly one category. Available categories:
${categoriesList}`;

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

  // Determine model speed
  const speed = getEffectiveSpeed("skills-analyze");
  const model = getModel(speed);

  const response = await anthropic.messages.create({
    model,
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

// Analyze multiple URLs and/or documents and group them into skill recommendations
async function analyzeAndGroupSources(
  sourceUrls: string[],
  sourceDocuments: { id: string; filename: string; content: string }[],
  existingSkills: ExistingSkillInfo[]
): Promise<GroupedAnalyzeResponse> {
  const anthropic = getAnthropicClient();

  // Pre-check: identify URLs that already exist in skills
  const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, "");
  const existingUrlMap = new Map<string, { skillId: string; skillTitle: string }>();

  for (const skill of existingSkills) {
    if (!skill.sourceUrls) continue;
    for (const url of skill.sourceUrls) {
      existingUrlMap.set(normalizeUrl(url), { skillId: skill.id, skillTitle: skill.title });
    }
  }

  // Separate URLs into new vs already-in-skills
  const newUrls: string[] = [];
  const duplicateUrlsBySkill = new Map<string, { skillId: string; skillTitle: string; urls: string[] }>();

  for (const url of sourceUrls) {
    const normalized = normalizeUrl(url);
    const existingSkill = existingUrlMap.get(normalized);
    if (existingSkill) {
      const key = existingSkill.skillId;
      if (!duplicateUrlsBySkill.has(key)) {
        duplicateUrlsBySkill.set(key, { ...existingSkill, urls: [] });
      }
      duplicateUrlsBySkill.get(key)!.urls.push(url);
    } else {
      newUrls.push(url);
    }
  }

  // If ALL URLs are duplicates and no documents, create update groups directly without LLM
  if (newUrls.length === 0 && sourceDocuments.length === 0 && duplicateUrlsBySkill.size > 0) {
    const skillGroups: SkillGroup[] = Array.from(duplicateUrlsBySkill.values()).map(dup => ({
      action: "update_existing" as const,
      skillTitle: dup.skillTitle,
      existingSkillId: dup.skillId,
      urls: dup.urls,
      reason: `These URLs are already sources for "${dup.skillTitle}". Refreshing the skill with latest content.`,
    }));

    return {
      skillGroups,
      summary: `All ${sourceUrls.length} URL(s) already exist in your skill library. Grouped for refresh.`,
    };
  }

  // Pre-build update groups for duplicate URLs (no LLM needed for these)
  const preBuiltGroups: SkillGroup[] = Array.from(duplicateUrlsBySkill.values()).map(dup => ({
    action: "update_existing" as const,
    skillTitle: dup.skillTitle,
    existingSkillId: dup.skillId,
    urls: dup.urls,
    reason: `These URLs are already sources for "${dup.skillTitle}". Refreshing with latest content.`,
  }));

  // If no new URLs and no documents, we already returned above
  // Otherwise, we need to analyze the new URLs and/or documents with the LLM

  // Fetch content from NEW URLs only (duplicates don't need content analysis)
  const urlContents: { type: "url"; url: string; content: string }[] = [];
  const urlsToFetch = newUrls.length > 0 ? newUrls : sourceUrls; // Fall back to all if somehow empty
  if (urlsToFetch.length > 0) {
    const fetchPromises = urlsToFetch.slice(0, 20).map(async (url): Promise<{ type: "url"; url: string; content: string }> => {
      try {
        const ssrfCheck = await validateUrlForSSRF(url);
        if (!ssrfCheck.valid) return { type: "url", url, content: "[Could not fetch content]" };

        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { type: "url", url, content: "[Could not fetch content]" };
        }

        const response = await fetch(parsed.toString(), {
          headers: { "User-Agent": "GRCMinionAnalyzer/1.0" },
          signal: AbortSignal.timeout(10000), // 10 second timeout per URL
        });
        if (!response.ok) return { type: "url", url, content: "[Could not fetch content]" };

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text")) return { type: "url", url, content: "[Could not fetch content]" };

        const text = await response.text();
        // Take first 3000 chars per URL to fit more in context
        return { type: "url", url, content: text.slice(0, 3000) };
      } catch {
        return { type: "url", url, content: "[Could not fetch content]" };
      }
    });
    urlContents.push(...await Promise.all(fetchPromises));
  }

  // Prepare document contents
  const docContents: { type: "document"; id: string; filename: string; content: string }[] = sourceDocuments.map(doc => ({
    type: "document",
    id: doc.id,
    filename: doc.filename,
    // Take first 3000 chars per document to fit more in context
    content: doc.content.slice(0, 3000),
  }));

  const skillsSummary = existingSkills.length > 0
    ? existingSkills.map(s => `- "${s.title}" (ID: ${s.id})\n  Category: ${s.category || s.categories?.[0] || "Uncategorized"}\n  Preview: ${s.contentPreview.substring(0, 150)}...`).join("\n")
    : "No existing skills in the knowledge base.";

  // Build source summary combining URLs and documents
  let sourceCounter = 0;
  const sourceSummaryParts: string[] = [];

  for (const urlItem of urlContents) {
    sourceCounter++;
    sourceSummaryParts.push(`[SOURCE ${sourceCounter}] URL: ${urlItem.url}\nContent preview: ${urlItem.content.substring(0, 500)}...`);
  }

  for (const docItem of docContents) {
    sourceCounter++;
    sourceSummaryParts.push(`[SOURCE ${sourceCounter}] DOCUMENT: ${docItem.filename} (ID: ${docItem.id})\nContent preview: ${docItem.content.substring(0, 500)}...`);
  }

  const sourceSummary = sourceSummaryParts.join("\n\n");
  const hasUrls = sourceUrls.length > 0;
  const hasDocs = sourceDocuments.length > 0;

  // Load base role/mission prompt from block system
  const basePrompt = await loadSystemPrompt("skill_analyze", "You are a knowledge management expert.");

  // Get available categories for AI to suggest
  const availableCategories = await getCategoryNamesFromDb();

  // Build system prompt with grouped-specific output format
  const systemPrompt = `${basePrompt}

Your task is to analyze ${hasUrls && hasDocs ? "URLs and documents" : hasUrls ? "URLs" : "documents"} and GROUP them into skill recommendations. Each group becomes one skill.

RULES:
1. Group sources by TOPIC SIMILARITY - sources about the same feature/capability go together
2. PREFER updating existing skills over creating new ones
3. Each source (URL or document) must appear in exactly one group
4. A group can have 1 or many sources
5. Sources can be mixed (URLs and documents in the same group if they cover the same topic)
6. For new skills (action: "create"), suggest a category from the available list

AVAILABLE CATEGORIES:
${availableCategories.join(", ")}

OUTPUT FORMAT:
Return a JSON object:
{
  "skillGroups": [
    {
      "action": "create" | "update_existing",
      "skillTitle": "Name of the skill",
      "existingSkillId": "ID if updating existing skill (omit for create)",
      "category": "Category name from available list (only for create action)",
      "urls": ["array of URLs in this group - only include if there are URLs"],
      "documentIds": ["array of document IDs in this group - only include if there are documents"],
      "reason": "Why these sources belong together and why this action"
    }
  ],
  "summary": "Brief overall summary of how sources were organized"
}

GROUPING GUIDELINES:
- Sources from the same topic/feature → same group
- If a source clearly relates to an existing skill → update_existing
- Only create new skills for genuinely new topics
- Don't create empty arrays - only include "urls" if there are URLs, only include "documentIds" if there are documents
- Choose the most appropriate category for new skills based on content`;

  const userPrompt = `EXISTING SKILLS:
${skillsSummary}

---

SOURCES TO ANALYZE (${sourceUrls.length} URLs, ${sourceDocuments.length} documents):
${sourceSummary}

---

Group these sources into skill recommendations. Each group will become or update one skill.
Related sources should be grouped together.
Sources that match existing skills should update those skills.

Return ONLY the JSON object.`;

  // Determine model speed
  const speed = getEffectiveSpeed("skills-analyze");
  const model = getModel(speed);

  const response = await anthropic.messages.create({
    model,
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

  // Validate and ensure skillGroups exists
  if (!parsed.skillGroups || !Array.isArray(parsed.skillGroups)) {
    logger.error("LLM returned invalid skillGroups", new Error("Invalid response"), { route: "/api/skills/analyze", response: JSON.stringify(parsed).slice(0, 500) });
    throw new Error("LLM response missing skillGroups array");
  }

  // Ensure all NEW sources are accounted for (duplicates are handled separately)
  const groupedUrls = new Set(parsed.skillGroups.flatMap(g => g.urls || []));
  const groupedDocIds = new Set(parsed.skillGroups.flatMap(g => g.documentIds || []));

  // Only check for missing NEW URLs (duplicates are in preBuiltGroups)
  const missingNewUrls = newUrls.filter(url => !groupedUrls.has(url));
  const missingDocIds = sourceDocuments.filter(doc => !groupedDocIds.has(doc.id)).map(d => d.id);

  if (missingNewUrls.length > 0 || missingDocIds.length > 0) {
    // Add missing sources to a "Miscellaneous" group
    parsed.skillGroups.push({
      action: "create",
      skillTitle: "Miscellaneous Documentation",
      urls: missingNewUrls.length > 0 ? missingNewUrls : [],
      documentIds: missingDocIds.length > 0 ? missingDocIds : undefined,
      reason: "Sources that couldn't be categorized into other groups",
    });
  }

  // Merge pre-built groups (for duplicate URLs) with LLM-generated groups
  const allGroups = [...preBuiltGroups, ...parsed.skillGroups];

  // Update summary to reflect both
  const duplicateCount = Array.from(duplicateUrlsBySkill.values()).reduce((sum, d) => sum + d.urls.length, 0);
  const summaryParts: string[] = [];
  if (duplicateCount > 0) {
    summaryParts.push(`${duplicateCount} URL(s) matched existing skills (auto-grouped for refresh)`);
  }
  if (parsed.summary) {
    summaryParts.push(parsed.summary);
  }

  return {
    skillGroups: allGroups,
    summary: summaryParts.join(". ") || parsed.summary,
  };
}
