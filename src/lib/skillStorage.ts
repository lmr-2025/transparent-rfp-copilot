import { Skill } from "@/types/skill";

export const SKILLS_STORAGE_KEY = "grc-minion-skills";

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
    return (parsed as Partial<Skill>[])
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

        const legacyResponseTemplate =
          typeof (item as any).responseTemplate === "string" ? (item as any).responseTemplate : undefined;
        const legacySources = Array.isArray((item as any).sourceMapping)
          ? ((item as any).sourceMapping as string[])
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

        return {
          id: item.id ?? crypto.randomUUID(),
          title: item.title ?? "",
          tags: Array.isArray(item.tags) ? (item.tags as string[]).filter(Boolean) : [],
          content: item.content ?? "",
          quickFacts,
          edgeCases,
          information,
          isActive: item.isActive ?? true,
          createdAt: item.createdAt ?? new Date().toISOString(),
          lastRefreshedAt:
            typeof item.lastRefreshedAt === "string" ? item.lastRefreshedAt : undefined,
          lastSourceLink:
            typeof item.lastSourceLink === "string" ? item.lastSourceLink : undefined,
        };
      });
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
