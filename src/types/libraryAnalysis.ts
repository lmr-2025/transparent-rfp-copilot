export type LibraryRecommendation = {
  type: "merge" | "split" | "rename" | "retag" | "gap";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedSkillIds: string[];
  affectedSkillTitles: string[];
  suggestedAction?: string;
};

export type AnalyzeLibraryResponse = {
  recommendations: LibraryRecommendation[];
  summary: string;
  healthScore: number; // 0-100
  // Transparency data
  transparency: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
    skillCount: number;
  };
};
