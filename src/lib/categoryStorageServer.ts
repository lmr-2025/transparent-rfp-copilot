import { prisma } from "@/lib/prisma";
import { DEFAULT_SKILL_CATEGORIES } from "@/types/skill";

// Server-side function to get category names from database
export async function getCategoryNamesFromDb(): Promise<string[]> {
  try {
    const categories = await prisma.skillCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    });

    // If no categories exist, seed with defaults and return
    if (categories.length === 0) {
      const now = new Date();
      await prisma.skillCategory.createMany({
        data: DEFAULT_SKILL_CATEGORIES.map((name, index) => ({
          name,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
      });
      return [...DEFAULT_SKILL_CATEGORIES];
    }

    return categories.map((c) => c.name);
  } catch (error) {
    console.error("Failed to fetch categories from DB:", error);
    // Fall back to defaults
    return [...DEFAULT_SKILL_CATEGORIES];
  }
}
