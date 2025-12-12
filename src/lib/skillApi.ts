import { Skill } from "@/types/skill";

// Skill API client

export async function fetchAllSkills(options?: {
  activeOnly?: boolean;
  category?: string;
}): Promise<Skill[]> {
  const params = new URLSearchParams();
  if (options?.activeOnly === false) params.set("active", "false");
  if (options?.category) params.set("category", options.category);

  const url = `/api/skills${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch skills");
  }
  return response.json();
}

export async function fetchSkill(id: string): Promise<Skill> {
  const response = await fetch(`/api/skills/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch skill");
  }
  return response.json();
}

export async function createSkill(
  skill: Omit<Skill, "id" | "createdAt" | "updatedAt">
): Promise<Skill> {
  const response = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skill),
  });
  if (!response.ok) {
    throw new Error("Failed to create skill");
  }
  return response.json();
}

export async function updateSkill(
  id: string,
  updates: Partial<Skill> & { historyNote?: string; updatedBy?: string }
): Promise<Skill> {
  const response = await fetch(`/api/skills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error("Failed to update skill");
  }
  return response.json();
}

export async function deleteSkill(id: string): Promise<void> {
  const response = await fetch(`/api/skills/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete skill");
  }
}
