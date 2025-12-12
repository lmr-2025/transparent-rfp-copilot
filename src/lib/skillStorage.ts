import { Skill, SourceUrl, SkillOwner, SkillHistoryEntry } from "@/types/skill";

export const SKILLS_STORAGE_KEY = "grc-minion-skills";

// Legacy fields that may exist in old stored data
interface LegacySkillFields {
  responseTemplate?: string;
  sourceMapping?: string[];
}

export function loadSkillsFromStorage(): Skill[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SKILLS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    let needsMigration = false;
    const skills = (parsed as Partial<Skill>[])
      .filter((item) => typeof item === "object" && item !== null)
      .map((item) => {
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

        const legacyItem = item as Partial<Skill> & LegacySkillFields;
        const legacyResponseTemplate =
          typeof legacyItem.responseTemplate === "string" ? legacyItem.responseTemplate : undefined;
        const legacySources = Array.isArray(legacyItem.sourceMapping)
          ? legacyItem.sourceMapping
              .map((entry) => entry?.toString() ?? "")
              .filter(Boolean)
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

        // Migrate to new sourceUrls format
        // Priority: existing sourceUrls (if populated) > information.sources > lastSourceLink
        let sourceUrls: SourceUrl[] = [];

        // Check if item already has new sourceUrls format WITH actual entries
        const rawSourceUrls = (item as Record<string, unknown>).sourceUrls;
        if (Array.isArray(rawSourceUrls) && rawSourceUrls.length > 0) {
          sourceUrls = (rawSourceUrls as SourceUrl[])
            .filter(s => s && typeof s.url === "string")
            .map(s => ({
              url: s.url,
              addedAt: s.addedAt || item.createdAt || new Date().toISOString(),
              lastFetchedAt: s.lastFetchedAt,
            }));
        }

        // If no sourceUrls (or empty array), migrate from legacy sources
        if (sourceUrls.length === 0 && sources && sources.length > 0) {
          const addedAt = item.createdAt || new Date().toISOString();
          sourceUrls = sources.map(url => ({
            url,
            addedAt,
          }));
          needsMigration = true;
        }

        // If still no sourceUrls, check lastSourceLink
        if (sourceUrls.length === 0 && typeof item.lastSourceLink === "string" && item.lastSourceLink.trim()) {
          sourceUrls = [{
            url: item.lastSourceLink,
            addedAt: item.lastRefreshedAt || item.createdAt || new Date().toISOString(),
          }];
          needsMigration = true;
        }

        // Parse owners if present
        const rawOwners = (item as Record<string, unknown>).owners;
        const owners: SkillOwner[] | undefined = Array.isArray(rawOwners)
          ? (rawOwners as SkillOwner[])
              .filter(o => o && typeof o.name === "string")
              .map(o => ({
                name: o.name,
                email: typeof o.email === "string" ? o.email : undefined,
              }))
          : undefined;

        // Parse history if present
        const rawHistory = (item as Record<string, unknown>).history;
        const history: SkillHistoryEntry[] | undefined = Array.isArray(rawHistory)
          ? (rawHistory as SkillHistoryEntry[])
              .filter(h => h && typeof h.date === "string" && typeof h.action === "string")
              .map(h => ({
                date: h.date,
                action: h.action,
                summary: h.summary || "",
                user: typeof h.user === "string" ? h.user : undefined,
              }))
          : undefined;

        return {
          id: item.id ?? crypto.randomUUID(),
          title: item.title ?? "",
          tags: Array.isArray(item.tags) ? (item.tags as string[]).filter(Boolean) : [],
          content: item.content ?? "",
          quickFacts,
          edgeCases,
          sourceUrls,
          information,
          isActive: item.isActive ?? true,
          createdAt: item.createdAt ?? new Date().toISOString(),
          lastRefreshedAt:
            typeof item.lastRefreshedAt === "string" ? item.lastRefreshedAt : undefined,
          lastSourceLink:
            typeof item.lastSourceLink === "string" ? item.lastSourceLink : undefined,
          owners: owners && owners.length > 0 ? owners : undefined,
          history: history && history.length > 0 ? history : undefined,
        };
      });

    // Auto-persist migrated data back to storage
    if (needsMigration) {
      saveSkillsToStorage(skills);
    }

    return skills;
  } catch {
    return [];
  }
}

export function saveSkillsToStorage(skills: Skill[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(skills));
  } catch {
    // ignore quota/storage errors
  }
}
