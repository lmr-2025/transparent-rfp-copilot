import { SkillCategoryItem } from "@/types/skill";
import { parseApiData } from "./apiClient";

// Map DB model to frontend type
type DbSkillCategory = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function mapToFrontend(cat: DbSkillCategory): SkillCategoryItem {
  return {
    id: cat.id,
    name: cat.name,
    description: cat.description || undefined,
    color: cat.color || undefined,
    createdAt: cat.createdAt,
  };
}

export async function fetchAllCategories(): Promise<SkillCategoryItem[]> {
  const response = await fetch("/api/skill-categories");
  if (!response.ok) {
    throw new Error("Failed to fetch skill categories");
  }
  const result = await response.json();
  const data = parseApiData<DbSkillCategory[]>(result, "categories");
  return (Array.isArray(data) ? data : []).map(mapToFrontend);
}

export async function createCategory(
  name: string,
  description?: string,
  color?: string
): Promise<SkillCategoryItem> {
  const response = await fetch("/api/skill-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, color }),
  });
  if (!response.ok) {
    throw new Error("Failed to create skill category");
  }
  const result = await response.json();
  const data = parseApiData<DbSkillCategory>(result, "category");
  return mapToFrontend(data);
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<SkillCategoryItem, "id" | "createdAt">>
): Promise<SkillCategoryItem> {
  const response = await fetch(`/api/skill-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error("Failed to update skill category");
  }
  const result = await response.json();
  const data = parseApiData<DbSkillCategory>(result, "category");
  return mapToFrontend(data);
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await fetch(`/api/skill-categories/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete skill category");
  }
}

export async function reorderCategories(
  categories: Array<{ id: string; sortOrder: number }>
): Promise<SkillCategoryItem[]> {
  const response = await fetch("/api/skill-categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories }),
  });
  if (!response.ok) {
    throw new Error("Failed to reorder skill categories");
  }
  const result = await response.json();
  const data = parseApiData<DbSkillCategory[]>(result, "categories");
  return (Array.isArray(data) ? data : []).map(mapToFrontend);
}

// Helper to get just the category names (for prompts)
export async function getCategoryNames(): Promise<string[]> {
  const categories = await fetchAllCategories();
  return categories.map((c) => c.name);
}
