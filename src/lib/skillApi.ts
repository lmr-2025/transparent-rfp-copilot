import { Skill } from "@/types/skill";
import { createApiClient } from "./apiClient";

// Types for create/update operations
type SkillCreate = Omit<Skill, "id" | "createdAt" | "updatedAt">;
type SkillUpdate = Partial<Skill> & { historyNote?: string; updatedBy?: string };

// Create the base API client
const skillClient = createApiClient<Skill, SkillCreate, SkillUpdate>({
  baseUrl: "/api/skills",
  singularKey: "skill",
  pluralKey: "skills",
});

// Re-export with specific function names for backward compatibility
export async function fetchAllSkills(options?: {
  activeOnly?: boolean;
  category?: string;
}): Promise<Skill[]> {
  const params: Record<string, string> = {};
  if (options?.activeOnly === false) params.active = "false";
  if (options?.category) params.category = options.category;

  return skillClient.fetchAll(params);
}

export async function fetchSkill(id: string): Promise<Skill> {
  const skill = await skillClient.fetch(id);
  if (!skill) {
    throw new Error("Skill not found");
  }
  return skill;
}

export async function createSkill(
  skill: Omit<Skill, "id" | "createdAt" | "updatedAt">
): Promise<Skill> {
  return skillClient.create(skill);
}

export async function updateSkill(
  id: string,
  updates: Partial<Skill> & { historyNote?: string; updatedBy?: string }
): Promise<Skill> {
  return skillClient.update(id, updates);
}

export async function deleteSkill(id: string): Promise<void> {
  return skillClient.delete(id);
}
