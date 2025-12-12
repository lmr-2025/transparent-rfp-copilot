import { SkillCategoryItem, DEFAULT_SKILL_CATEGORIES } from "@/types/skill";

export const CATEGORIES_STORAGE_KEY = "transparent-trust-skill-categories";

// Initialize default categories on first load
function getDefaultCategories(): SkillCategoryItem[] {
  const now = new Date().toISOString();
  return DEFAULT_SKILL_CATEGORIES.map((name, index) => ({
    id: `default-${index}`,
    name,
    createdAt: now,
  }));
}

export function loadCategories(): SkillCategoryItem[] {
  if (typeof window === "undefined") {
    return getDefaultCategories();
  }

  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) {
      // First time - initialize with defaults
      const defaults = getDefaultCategories();
      saveCategories(defaults);
      return defaults;
    }

    const parsed = JSON.parse(raw) as SkillCategoryItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = getDefaultCategories();
      saveCategories(defaults);
      return defaults;
    }

    return parsed;
  } catch {
    const defaults = getDefaultCategories();
    saveCategories(defaults);
    return defaults;
  }
}

export function saveCategories(categories: SkillCategoryItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

export function addCategory(name: string, description?: string): SkillCategoryItem {
  const categories = loadCategories();

  const newCategory: SkillCategoryItem = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description?.trim(),
    createdAt: new Date().toISOString(),
  };

  saveCategories([...categories, newCategory]);
  return newCategory;
}

export function updateCategory(id: string, updates: Partial<Omit<SkillCategoryItem, "id" | "createdAt">>): void {
  const categories = loadCategories();
  const updated = categories.map((cat) =>
    cat.id === id ? { ...cat, ...updates } : cat
  );
  saveCategories(updated);
}

export function deleteCategory(id: string): void {
  const categories = loadCategories();
  saveCategories(categories.filter((cat) => cat.id !== id));
}

export function getCategoryNames(): string[] {
  return loadCategories().map((cat) => cat.name);
}

// Helper to migrate old single category to new array format
export function migrateSkillCategories(skill: { category?: string; categories?: string[] }): string[] {
  if (skill.categories && skill.categories.length > 0) {
    return skill.categories;
  }
  if (skill.category) {
    return [skill.category];
  }
  return [];
}
