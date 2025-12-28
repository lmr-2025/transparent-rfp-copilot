import { prisma } from "@/lib/prisma";
import { Skill } from "@/types/skill";
import { Anthropic } from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Fetch all skills from database
 */
export async function getAllSkills(): Promise<Skill[]> {
  const skills = await prisma.skill.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return skills.map((skill) => ({
    ...skill,
    categories: skill.categories as string[],
    tier: skill.tier as "core" | "extended" | "library",
    tierOverrides: skill.tierOverrides as Record<string, "core" | "extended" | "library"> | undefined,
    owners: skill.owners as Array<{
      userId?: string;
      name: string;
      email?: string;
      image?: string;
    }> | undefined,
    sourceUrls: skill.sourceUrls as Array<{
      url: string;
      addedAt: string;
      lastFetchedAt?: string;
    }> | undefined,
    sourceDocuments: skill.sourceDocuments as unknown,
    history: skill.history as Array<{
      date: string;
      action: string;
      summary: string;
      user?: string;
    }> | undefined,
    syncStatus: skill.syncStatus as "synced" | "pending" | "failed" | null,
  }));
}

/**
 * Fetch active skills only
 */
export async function getActiveSkills(): Promise<Skill[]> {
  const allSkills = await getAllSkills();
  return allSkills.filter((skill) => skill.isActive);
}

/**
 * Fetch a single skill by ID
 */
export async function getSkillById(id: string): Promise<Skill | null> {
  const skill = await prisma.skill.findUnique({
    where: { id },
  });

  if (!skill) return null;

  return {
    ...skill,
    categories: skill.categories as string[],
    tier: skill.tier as "core" | "extended" | "library",
    tierOverrides: skill.tierOverrides as Record<string, "core" | "extended" | "library"> | undefined,
    owners: skill.owners as Array<{
      userId?: string;
      name: string;
      email?: string;
      image?: string;
    }> | undefined,
    sourceUrls: skill.sourceUrls as Array<{
      url: string;
      addedAt: string;
      lastFetchedAt?: string;
    }> | undefined,
    sourceDocuments: skill.sourceDocuments as unknown,
    history: skill.history as Array<{
      date: string;
      action: string;
      summary: string;
      user?: string;
    }> | undefined,
    syncStatus: skill.syncStatus as "synced" | "pending" | "failed" | null,
  };
}

/**
 * Create a new skill
 */
export async function createSkill(data: {
  title: string;
  content: string;
  categories?: string[];
  tier?: "core" | "extended" | "library";
  isActive?: boolean;
  owners?: Array<{
    userId?: string;
    name: string;
    email?: string;
    image?: string;
  }>;
  sourceUrls?: Array<{
    url: string;
    addedAt: string;
  }>;
}): Promise<Skill> {
  const skill = await prisma.skill.create({
    data: {
      title: data.title,
      content: data.content,
      categories: data.categories || [],
      tier: data.tier || "core",
      isActive: data.isActive ?? true,
      owners: data.owners || [],
      sourceUrls: data.sourceUrls || [],
      history: [
        {
          date: new Date().toISOString(),
          action: "created",
          summary: "Skill created",
        },
      ],
    },
  });

  return {
    ...skill,
    categories: skill.categories as string[],
    tier: skill.tier as "core" | "extended" | "library",
    tierOverrides: skill.tierOverrides as Record<string, "core" | "extended" | "library"> | undefined,
    owners: skill.owners as Array<{
      userId?: string;
      name: string;
      email?: string;
      image?: string;
    }> | undefined,
    sourceUrls: skill.sourceUrls as Array<{
      url: string;
      addedAt: string;
      lastFetchedAt?: string;
    }> | undefined,
    sourceDocuments: skill.sourceDocuments as unknown,
    history: skill.history as Array<{
      date: string;
      action: string;
      summary: string;
      user?: string;
    }> | undefined,
    syncStatus: skill.syncStatus as "synced" | "pending" | "failed" | null,
  };
}

/**
 * Update an existing skill
 */
export async function updateSkill(
  id: string,
  updates: Partial<Omit<Skill, "id" | "createdAt" | "updatedAt">>
): Promise<Skill> {
  const skill = await prisma.skill.update({
    where: { id },
    data: {
      ...updates,
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    ...skill,
    categories: skill.categories as string[],
    tier: skill.tier as "core" | "extended" | "library",
    tierOverrides: skill.tierOverrides as Record<string, "core" | "extended" | "library"> | undefined,
    owners: skill.owners as Array<{
      userId?: string;
      name: string;
      email?: string;
      image?: string;
    }> | undefined,
    sourceUrls: skill.sourceUrls as Array<{
      url: string;
      addedAt: string;
      lastFetchedAt?: string;
    }> | undefined,
    sourceDocuments: skill.sourceDocuments as unknown,
    history: skill.history as Array<{
      date: string;
      action: string;
      summary: string;
      user?: string;
    }> | undefined,
    syncStatus: skill.syncStatus as "synced" | "pending" | "failed" | null,
  };
}

/**
 * Delete a skill
 */
export async function deleteSkill(id: string): Promise<void> {
  await prisma.skill.delete({
    where: { id },
  });
}

/**
 * Refresh skill content from source URLs using AI
 */
export async function refreshSkillFromSources(
  skillId: string
): Promise<{
  hasChanges: boolean;
  message?: string;
  draft?: {
    title: string;
    content: string;
    changeHighlights: string[];
    summary: string;
  };
  originalTitle?: string;
  originalContent?: string;
}> {
  const skill = await getSkillById(skillId);
  if (!skill) {
    throw new Error("Skill not found");
  }

  const sourceUrls = skill.sourceUrls as Array<{ url: string }> | undefined;
  if (!sourceUrls || sourceUrls.length === 0) {
    return {
      hasChanges: false,
      message: "No source URLs to refresh from",
    };
  }

  // Fetch content from source URLs
  const urlContents = await Promise.all(
    sourceUrls.map(async (source) => {
      try {
        const response = await fetch(source.url);
        if (!response.ok) {
          return { url: source.url, content: null, error: `HTTP ${response.status}` };
        }
        const text = await response.text();
        return { url: source.url, content: text, error: null };
      } catch (error) {
        return {
          url: source.url,
          content: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    })
  );

  const successfulFetches = urlContents.filter((fetch) => fetch.content !== null);
  if (successfulFetches.length === 0) {
    return {
      hasChanges: false,
      message: "Failed to fetch content from all source URLs",
    };
  }

  // Use AI to analyze changes and generate updated skill
  const prompt = `You are updating a skill based on fresh content from source URLs.

Current Skill:
Title: ${skill.title}
Content: ${skill.content}

Fresh Content from Sources:
${successfulFetches
  .map(
    (fetch, i) => `
Source ${i + 1}: ${fetch.url}
${fetch.content}
`
  )
  .join("\n\n")}

Compare the current skill with the fresh content. If there are meaningful changes:
1. Generate an updated version of the skill
2. Highlight what changed
3. Provide a brief summary

Respond in JSON format:
{
  "hasChanges": true/false,
  "updatedTitle": "new title if changed, or original",
  "updatedContent": "updated content",
  "changeHighlights": ["change 1", "change 2", ...],
  "summary": "brief summary of changes"
}

If there are no meaningful changes, respond with:
{
  "hasChanges": false,
  "message": "No significant updates found"
}`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 8192,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].type === "text" ? response.content[0].text : "";

  // Parse AI response
  let result;
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;
    result = JSON.parse(jsonText);
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return {
      hasChanges: false,
      message: "Failed to analyze changes",
    };
  }

  if (!result.hasChanges) {
    return {
      hasChanges: false,
      message: result.message || "No changes detected",
    };
  }

  return {
    hasChanges: true,
    draft: {
      title: result.updatedTitle || skill.title,
      content: result.updatedContent || skill.content,
      changeHighlights: result.changeHighlights || [],
      summary: result.summary || "Content updated from source URLs",
    },
    originalTitle: skill.title,
    originalContent: skill.content,
  };
}

/**
 * Apply refresh changes to a skill
 */
export async function applyRefreshChanges(
  skillId: string,
  updates: {
    title: string;
    content: string;
    changeHighlights?: string[];
  }
): Promise<Skill> {
  const skill = await getSkillById(skillId);
  if (!skill) {
    throw new Error("Skill not found");
  }

  // Build history entry
  const historyEntry = {
    date: new Date().toISOString(),
    action: "refreshed",
    summary: updates.changeHighlights?.join("; ") || "Content refreshed from sources",
  };

  const existingHistory = (skill.history as Array<{
    date: string;
    action: string;
    summary: string;
    user?: string;
  }>) || [];

  return updateSkill(skillId, {
    title: updates.title,
    content: updates.content,
    lastRefreshedAt: new Date().toISOString(),
    history: [...existingHistory, historyEntry],
  });
}

/**
 * Search skills by keyword
 */
export async function searchSkills(query: string, options?: {
  activeOnly?: boolean;
  categories?: string[];
  limit?: number;
}): Promise<Skill[]> {
  const allSkills = options?.activeOnly ? await getActiveSkills() : await getAllSkills();

  const searchLower = query.toLowerCase();
  let filtered = allSkills.filter(
    (skill) =>
      skill.title.toLowerCase().includes(searchLower) ||
      skill.content.toLowerCase().includes(searchLower)
  );

  if (options?.categories && options.categories.length > 0) {
    filtered = filtered.filter((skill) =>
      skill.categories?.some((cat) => options.categories!.includes(cat))
    );
  }

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}
