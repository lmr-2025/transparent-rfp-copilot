import { Skill, SourceUrl, SkillOwner, SkillHistoryEntry } from "@/types/skill";
import { getApiErrorMessage } from "@/lib/utils";

export const SKILLS_STORAGE_KEY = "grc-minion-skills";

// Legacy fields that may exist in old stored data
interface LegacySkillFields {
  responseTemplate?: string;
  sourceMapping?: string[];
}

// Normalize a skill from any source (localStorage or API)
function normalizeSkill(item: Partial<Skill> & LegacySkillFields): Skill {
  const quickFacts = Array.isArray(item.quickFacts)
    ? (item.quickFacts as Skill["quickFacts"]).map((fact) => ({
        question: fact?.question ?? "",
        answer: fact?.answer ?? "",
      }))
    : [];

  const edgeCases = Array.isArray(item.edgeCases)
    ? (item.edgeCases as string[])
        .map((entry) => entry?.toString() ?? "")
        .filter(Boolean)
    : [];

  let infoFromObject: { responseTemplate?: string; sources?: string[] } | undefined;
  if (item.information && typeof item.information === "object") {
    const infoRecord = item.information as Record<string, unknown>;
    const rawSources = Array.isArray(infoRecord.sources)
      ? infoRecord.sources
          .map((entry) => entry?.toString() ?? "")
          .filter((entry): entry is string => entry.length > 0)
      : undefined;

    infoFromObject = {
      responseTemplate:
        typeof infoRecord.responseTemplate === "string"
          ? (infoRecord.responseTemplate as string)
          : undefined,
      sources: rawSources,
    };
  }

  const legacyResponseTemplate =
    typeof item.responseTemplate === "string" ? item.responseTemplate : undefined;
  const legacySources = Array.isArray(item.sourceMapping)
    ? item.sourceMapping.map((entry) => entry?.toString() ?? "").filter(Boolean)
    : [];

  const responseTemplate = infoFromObject?.responseTemplate ?? legacyResponseTemplate;
  const sources =
    infoFromObject?.sources && infoFromObject.sources.length > 0
      ? infoFromObject.sources
      : legacySources;

  const information =
    responseTemplate || (sources && sources.length > 0)
      ? {
          responseTemplate,
          sources: sources && sources.length > 0 ? sources : undefined,
        }
      : undefined;

  // Parse sourceUrls
  let sourceUrls: SourceUrl[] = [];
  const rawSourceUrls = (item as Record<string, unknown>).sourceUrls;
  if (Array.isArray(rawSourceUrls) && rawSourceUrls.length > 0) {
    sourceUrls = (rawSourceUrls as SourceUrl[])
      .filter((s) => s && typeof s.url === "string")
      .map((s) => ({
        url: s.url,
        addedAt: s.addedAt || item.createdAt || new Date().toISOString(),
        lastFetchedAt: s.lastFetchedAt,
      }));
  }

  // Migrate from legacy sources if needed
  if (sourceUrls.length === 0 && sources && sources.length > 0) {
    const addedAt = item.createdAt || new Date().toISOString();
    sourceUrls = sources.map((url) => ({ url, addedAt }));
  }

  // Check lastSourceLink
  if (
    sourceUrls.length === 0 &&
    typeof item.lastSourceLink === "string" &&
    item.lastSourceLink.trim()
  ) {
    sourceUrls = [
      {
        url: item.lastSourceLink,
        addedAt: item.lastRefreshedAt || item.createdAt || new Date().toISOString(),
      },
    ];
  }

  // Parse owners
  const rawOwners = (item as Record<string, unknown>).owners;
  const owners: SkillOwner[] | undefined = Array.isArray(rawOwners)
    ? (rawOwners as SkillOwner[])
        .filter((o) => o && typeof o.name === "string")
        .map((o) => ({
          userId: typeof o.userId === "string" ? o.userId : undefined,
          name: o.name,
          email: typeof o.email === "string" ? o.email : undefined,
          image: typeof o.image === "string" ? o.image : undefined,
        }))
    : undefined;

  // Parse history
  const rawHistory = (item as Record<string, unknown>).history;
  const history: SkillHistoryEntry[] | undefined = Array.isArray(rawHistory)
    ? (rawHistory as SkillHistoryEntry[])
        .filter((h) => h && typeof h.date === "string" && typeof h.action === "string")
        .map((h) => ({
          date: h.date,
          action: h.action,
          summary: h.summary || "",
          user: typeof h.user === "string" ? h.user : undefined,
        }))
    : undefined;

  // Handle categories (new multi-category format or legacy single category)
  const categories = Array.isArray(item.categories)
    ? item.categories
    : item.category
      ? [item.category]
      : [];

  return {
    id: item.id ?? crypto.randomUUID(),
    title: item.title ?? "",
    categories: categories.length > 0 ? categories : undefined,
    category: item.category, // Keep for backwards compatibility
    content: item.content ?? "",
    quickFacts,
    edgeCases,
    sourceUrls,
    information,
    isActive: item.isActive ?? true,
    createdAt: item.createdAt ?? new Date().toISOString(),
    lastRefreshedAt: typeof item.lastRefreshedAt === "string" ? item.lastRefreshedAt : undefined,
    lastSourceLink: typeof item.lastSourceLink === "string" ? item.lastSourceLink : undefined,
    owners: owners && owners.length > 0 ? owners : undefined,
    history: history && history.length > 0 ? history : undefined,
  };
}

// Load from localStorage (for initial hydration or fallback)
function loadFromLocalStorage(): Skill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SKILLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === "object" && item !== null)
      .map(normalizeSkill);
  } catch {
    return [];
  }
}

// Save to localStorage (cache)
function saveToLocalStorage(skills: Skill[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(skills));
  } catch {
    // ignore quota/storage errors
  }
}

// Track if we've loaded from API yet
let apiLoaded = false;
let cachedSkills: Skill[] = [];

// Load skills - tries API first, falls back to localStorage
export function loadSkillsFromStorage(): Skill[] {
  // On initial load, use localStorage for fast hydration
  if (!apiLoaded && typeof window !== "undefined") {
    cachedSkills = loadFromLocalStorage();
  }
  return cachedSkills;
}

// Async version that fetches from API
export async function loadSkillsFromApi(): Promise<Skill[]> {
  try {
    const response = await fetch("/api/skills");
    if (!response.ok) throw new Error("API fetch failed");
    const data = await response.json();
    cachedSkills = (data as Partial<Skill>[]).map(normalizeSkill);
    apiLoaded = true;
    // Update localStorage cache
    saveToLocalStorage(cachedSkills);
    return cachedSkills;
  } catch {
    // Fall back to localStorage
    cachedSkills = loadFromLocalStorage();
    return cachedSkills;
  }
}

// Save skills - saves to both API and localStorage
export function saveSkillsToStorage(skills: Skill[]) {
  cachedSkills = skills;
  saveToLocalStorage(skills);
  // Note: Individual creates/updates should use the API directly
  // This is mainly for backwards compatibility
}

// Create a skill via API
export async function createSkillViaApi(
  skill: Omit<Skill, "id" | "createdAt">
): Promise<Skill> {
  const response = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skill),
  });
  if (!response.ok) throw new Error("Failed to create skill");
  const created = await response.json();
  const normalized = normalizeSkill(created);
  cachedSkills = [normalized, ...cachedSkills];
  saveToLocalStorage(cachedSkills);
  return normalized;
}

// Update a skill via API
export async function updateSkillViaApi(
  id: string,
  updates: Partial<Skill>
): Promise<Skill> {
  const response = await fetch(`/api/skills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(errorData, "Failed to update skill"));
  }
  const updated = await response.json();
  const normalized = normalizeSkill(updated);
  cachedSkills = cachedSkills.map((s) => (s.id === id ? normalized : s));
  saveToLocalStorage(cachedSkills);
  return normalized;
}

// Delete a skill via API
export async function deleteSkillViaApi(id: string): Promise<void> {
  const response = await fetch(`/api/skills/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete skill");
  cachedSkills = cachedSkills.filter((s) => s.id !== id);
  saveToLocalStorage(cachedSkills);
}
