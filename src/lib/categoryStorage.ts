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

// Load from localStorage (for initial hydration or fallback)
function loadFromLocalStorage(): SkillCategoryItem[] {
  if (typeof window === "undefined") {
    return getDefaultCategories();
  }

  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultCategories();
      saveToLocalStorage(defaults);
      return defaults;
    }

    const parsed = JSON.parse(raw) as SkillCategoryItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = getDefaultCategories();
      saveToLocalStorage(defaults);
      return defaults;
    }

    return parsed;
  } catch {
    const defaults = getDefaultCategories();
    saveToLocalStorage(defaults);
    return defaults;
  }
}

// Save to localStorage (cache)
function saveToLocalStorage(categories: SkillCategoryItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

// Track if we've loaded from API yet
let apiLoaded = false;
let cachedCategories: SkillCategoryItem[] = [];

// Synchronous load for initial render (uses localStorage)
export function loadCategories(): SkillCategoryItem[] {
  if (!apiLoaded && typeof window !== "undefined") {
    cachedCategories = loadFromLocalStorage();
  }
  return cachedCategories.length > 0 ? cachedCategories : getDefaultCategories();
}

// Async version that fetches from API
export async function loadCategoriesFromApi(): Promise<SkillCategoryItem[]> {
  try {
    const response = await fetch("/api/skill-categories");
    if (!response.ok) throw new Error("API fetch failed");
    const data = await response.json();
    cachedCategories = data.map((cat: { id: string; name: string; description?: string; color?: string; createdAt: string }) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      color: cat.color,
      createdAt: cat.createdAt,
    }));
    apiLoaded = true;
    saveToLocalStorage(cachedCategories);
    return cachedCategories;
  } catch {
    cachedCategories = loadFromLocalStorage();
    return cachedCategories;
  }
}

// Save categories (backwards compatibility - updates cache and localStorage)
export function saveCategories(categories: SkillCategoryItem[]): void {
  cachedCategories = categories;
  saveToLocalStorage(categories);
}

// Add a new category (with fire-and-forget API sync)
export function addCategory(name: string, description?: string): SkillCategoryItem {
  const newCategory: SkillCategoryItem = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description?.trim(),
    createdAt: new Date().toISOString(),
  };
  cachedCategories = [...loadCategories(), newCategory];
  saveToLocalStorage(cachedCategories);

  // Fire and forget API call
  fetch("/api/skill-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), description: description?.trim() }),
  }).catch(() => {});

  return newCategory;
}

// Update a category
export function updateCategory(
  id: string,
  updates: Partial<Omit<SkillCategoryItem, "id" | "createdAt">>
): void {
  cachedCategories = loadCategories().map((cat) =>
    cat.id === id ? { ...cat, ...updates } : cat
  );
  saveToLocalStorage(cachedCategories);

  // Fire and forget API call
  fetch(`/api/skill-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  }).catch(() => {});
}

// Delete a category
export function deleteCategory(id: string): void {
  cachedCategories = loadCategories().filter((cat) => cat.id !== id);
  saveToLocalStorage(cachedCategories);

  // Fire and forget API call
  fetch(`/api/skill-categories/${id}`, {
    method: "DELETE",
  }).catch(() => {});
}

// Get just the category names (for prompts)
export function getCategoryNames(): string[] {
  return loadCategories().map((cat) => cat.name);
}

// Async version for API routes
export async function getCategoryNamesFromApi(): Promise<string[]> {
  const categories = await loadCategoriesFromApi();
  return categories.map((cat) => cat.name);
}

// Helper to migrate old single category to new array format
export function migrateSkillCategories(skill: {
  category?: string;
  categories?: string[];
}): string[] {
  if (skill.categories && skill.categories.length > 0) {
    return skill.categories;
  }
  if (skill.category) {
    return [skill.category];
  }
  return [];
}
