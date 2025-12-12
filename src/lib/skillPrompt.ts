import { buildPromptFromSections, defaultSkillSections } from "./promptSections";

// Re-export for backwards compatibility
export const defaultSkillPromptSections = defaultSkillSections;

export const defaultSkillPrompt = buildPromptFromSections(defaultSkillSections);
