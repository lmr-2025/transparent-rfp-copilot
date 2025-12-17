import { SkillCategoryItem, DEFAULT_SKILL_CATEGORIES } from "@/types/skill";
import { parseApiData, getApiErrorMessage } from "./apiClient";

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
    const result = await response.json();
    const data = parseApiData<{ id: string; name: string; description?: string; color?: string; createdAt: string }[]>(result, "categories");
    const categories = Array.isArray(data) ? data : [];
    cachedCategories = categories.map((cat) => ({
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

// Add a new category via API (sync with proper error handling)
export async function addCategory(name: string, description?: string): Promise<SkillCategoryItem> {
  // Call API first - if it fails, we throw before updating local state
  const response = await fetch("/api/skill-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), description: description?.trim() }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to create category" }));
    throw new Error(getApiErrorMessage(error, "Failed to create category"));
  }

  const result = await response.json();
  const created = parseApiData<{ id: string; name: string; description?: string; color?: string; createdAt: string }>(result, "category");
  const newCategory: SkillCategoryItem = {
    id: created.id,
    name: created.name,
    description: created.description,
    color: created.color,
    createdAt: created.createdAt,
  };

  // Update local cache after successful API call
  cachedCategories = [...loadCategories(), newCategory];
  saveToLocalStorage(cachedCategories);

  return newCategory;
}

// Update a category via API (sync with proper error handling)
export async function updateCategory(
  id: string,
  updates: Partial<Omit<SkillCategoryItem, "id" | "createdAt">>
): Promise<void> {
  // Call API first - if it fails, we throw before updating local state
  const response = await fetch(`/api/skill-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to update category" }));
    throw new Error(getApiErrorMessage(error, "Failed to update category"));
  }

  // Update local cache after successful API call
  cachedCategories = loadCategories().map((cat) =>
    cat.id === id ? { ...cat, ...updates } : cat
  );
  saveToLocalStorage(cachedCategories);
}

// Delete a category via API (sync with proper error handling)
export async function deleteCategory(id: string): Promise<void> {
  // Call API first - if it fails, we throw before updating local state
  const response = await fetch(`/api/skill-categories/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to delete category" }));
    throw new Error(getApiErrorMessage(error, "Failed to delete category"));
  }

  // Update local cache after successful API call
  cachedCategories = loadCategories().filter((cat) => cat.id !== id);
  saveToLocalStorage(cachedCategories);
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
