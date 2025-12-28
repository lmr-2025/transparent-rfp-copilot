import { prisma } from "@/lib/prisma";

export interface Category {
  name: string;
  color: string;
  description?: string;
}

/**
 * Get all categories
 */
export async function getAllCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return categories.map((cat) => ({
    name: cat.name,
    color: cat.color || "#6b7280",
    description: cat.description || undefined,
  }));
}

/**
 * Get a single category by name
 */
export async function getCategoryByName(name: string): Promise<Category | null> {
  const category = await prisma.category.findUnique({
    where: { name },
  });

  if (!category) return null;

  return {
    name: category.name,
    color: category.color || "#6b7280",
    description: category.description || undefined,
  };
}

/**
 * Create a new category
 */
export async function createCategory(data: {
  name: string;
  color?: string;
  description?: string;
}): Promise<Category> {
  const category = await prisma.category.create({
    data: {
      name: data.name,
      color: data.color || "#6b7280",
      description: data.description,
    },
  });

  return {
    name: category.name,
    color: category.color || "#6b7280",
    description: category.description || undefined,
  };
}

/**
 * Update a category
 */
export async function updateCategory(
  name: string,
  updates: {
    color?: string;
    description?: string;
  }
): Promise<Category> {
  const category = await prisma.category.update({
    where: { name },
    data: updates,
  });

  return {
    name: category.name,
    color: category.color || "#6b7280",
    description: category.description || undefined,
  };
}

/**
 * Delete a category
 */
export async function deleteCategory(name: string): Promise<void> {
  await prisma.category.delete({
    where: { name },
  });
}

/**
 * Get usage statistics for categories
 */
export async function getCategoryStats(): Promise<
  Array<{
    name: string;
    color: string;
    skillCount: number;
    documentCount: number;
    urlCount: number;
  }>
> {
  const [categories, skills, documents, urls] = await Promise.all([
    getAllCategories(),
    prisma.skill.findMany({ select: { categories: true } }),
    prisma.knowledgeDocument.findMany({ select: { categories: true } }),
    prisma.referenceUrl.findMany({ select: { categories: true } }),
  ]);

  return categories.map((cat) => {
    const skillCount = skills.filter((skill) =>
      (skill.categories as string[])?.includes(cat.name)
    ).length;

    const documentCount = documents.filter((doc) =>
      (doc.categories as string[])?.includes(cat.name)
    ).length;

    const urlCount = urls.filter((url) => (url.categories as string[])?.includes(cat.name)).length;

    return {
      name: cat.name,
      color: cat.color,
      skillCount,
      documentCount,
      urlCount,
    };
  });
}

/**
 * Get items by category
 */
export async function getItemsByCategory(categoryName: string): Promise<{
  skills: Array<{ id: string; title: string }>;
  documents: Array<{ id: string; title: string }>;
  urls: Array<{ id: string; title: string; url: string }>;
}> {
  const [skills, documents, urls] = await Promise.all([
    prisma.skill.findMany({
      where: {
        categories: {
          has: categoryName,
        },
      },
      select: { id: true, title: true },
    }),
    prisma.knowledgeDocument.findMany({
      where: {
        categories: {
          has: categoryName,
        },
      },
      select: { id: true, title: true },
    }),
    prisma.referenceUrl.findMany({
      where: {
        categories: {
          has: categoryName,
        },
      },
      select: { id: true, title: true, url: true },
    }),
  ]);

  return {
    skills,
    documents,
    urls: urls.map((url) => ({
      id: url.id,
      title: url.title || url.url,
      url: url.url,
    })),
  };
}

/**
 * Merge two categories (move all items from source to target, then delete source)
 */
export async function mergeCategories(
  sourceName: string,
  targetName: string
): Promise<void> {
  // Verify both categories exist
  const [source, target] = await Promise.all([
    getCategoryByName(sourceName),
    getCategoryByName(targetName),
  ]);

  if (!source) {
    throw new Error(`Source category "${sourceName}" not found`);
  }
  if (!target) {
    throw new Error(`Target category "${targetName}" not found`);
  }

  // Get all items in source category
  const items = await getItemsByCategory(sourceName);

  // Update skills
  for (const skill of items.skills) {
    const fullSkill = await prisma.skill.findUnique({
      where: { id: skill.id },
      select: { categories: true },
    });

    if (fullSkill) {
      const categories = (fullSkill.categories as string[]) || [];
      const newCategories = categories
        .filter((c) => c !== sourceName)
        .concat(targetName)
        .filter((c, i, arr) => arr.indexOf(c) === i); // dedupe

      await prisma.skill.update({
        where: { id: skill.id },
        data: { categories: newCategories },
      });
    }
  }

  // Update documents
  for (const doc of items.documents) {
    const fullDoc = await prisma.knowledgeDocument.findUnique({
      where: { id: doc.id },
      select: { categories: true },
    });

    if (fullDoc) {
      const categories = (fullDoc.categories as string[]) || [];
      const newCategories = categories
        .filter((c) => c !== sourceName)
        .concat(targetName)
        .filter((c, i, arr) => arr.indexOf(c) === i);

      await prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { categories: newCategories },
      });
    }
  }

  // Update URLs
  for (const url of items.urls) {
    const fullUrl = await prisma.referenceUrl.findUnique({
      where: { id: url.id },
      select: { categories: true },
    });

    if (fullUrl) {
      const categories = (fullUrl.categories as string[]) || [];
      const newCategories = categories
        .filter((c) => c !== sourceName)
        .concat(targetName)
        .filter((c, i, arr) => arr.indexOf(c) === i);

      await prisma.referenceUrl.update({
        where: { id: url.id },
        data: { categories: newCategories },
      });
    }
  }

  // Delete source category
  await deleteCategory(sourceName);
}
