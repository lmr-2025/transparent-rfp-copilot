import { prisma } from "@/lib/prisma";
import { KnowledgeDocument } from "@/types/document";

/**
 * Get all documents
 */
export async function getAllDocuments(): Promise<KnowledgeDocument[]> {
  const documents = await prisma.knowledgeDocument.findMany({
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    content: doc.content || "",
    categories: (doc.categories as string[]) || [],
    uploadedAt: doc.uploadedAt,
    fileSize: doc.fileSize || 0,
    fileType: doc.fileType || "unknown",
    skillCount: 0, // Will be calculated separately if needed
  }));
}

/**
 * Get a single document by ID
 */
export async function getDocumentById(id: string): Promise<KnowledgeDocument | null> {
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id },
  });

  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    content: doc.content || "",
    categories: (doc.categories as string[]) || [],
    uploadedAt: doc.uploadedAt,
    fileSize: doc.fileSize || 0,
    fileType: doc.fileType || "unknown",
    skillCount: 0,
  };
}

/**
 * Get documents by category
 */
export async function getDocumentsByCategory(category: string): Promise<KnowledgeDocument[]> {
  const documents = await prisma.knowledgeDocument.findMany({
    where: {
      categories: {
        has: category,
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    content: doc.content || "",
    categories: (doc.categories as string[]) || [],
    uploadedAt: doc.uploadedAt,
    fileSize: doc.fileSize || 0,
    fileType: doc.fileType || "unknown",
    skillCount: 0,
  }));
}

/**
 * Create a new document
 */
export async function createDocument(data: {
  title: string;
  filename: string;
  content?: string;
  categories?: string[];
  fileSize?: number;
  fileType?: string;
  fileData?: Buffer;
}): Promise<KnowledgeDocument> {
  const doc = await prisma.knowledgeDocument.create({
    data: {
      title: data.title,
      filename: data.filename,
      content: data.content || "",
      categories: data.categories || [],
      fileSize: data.fileSize || 0,
      fileType: data.fileType || "unknown",
      fileData: data.fileData,
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    content: doc.content || "",
    categories: (doc.categories as string[]) || [],
    uploadedAt: doc.uploadedAt,
    fileSize: doc.fileSize || 0,
    fileType: doc.fileType || "unknown",
    skillCount: 0,
  };
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  updates: {
    title?: string;
    content?: string;
    categories?: string[];
  }
): Promise<KnowledgeDocument> {
  const doc = await prisma.knowledgeDocument.update({
    where: { id },
    data: updates,
  });

  return {
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    content: doc.content || "",
    categories: (doc.categories as string[]) || [],
    uploadedAt: doc.uploadedAt,
    fileSize: doc.fileSize || 0,
    fileType: doc.fileType || "unknown",
    skillCount: 0,
  };
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  await prisma.knowledgeDocument.delete({
    where: { id },
  });
}

/**
 * Search documents by keyword
 */
export async function searchDocuments(
  query: string,
  options?: {
    categories?: string[];
    limit?: number;
  }
): Promise<KnowledgeDocument[]> {
  const allDocuments = await getAllDocuments();

  const searchLower = query.toLowerCase();
  let filtered = allDocuments.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchLower) ||
      doc.filename.toLowerCase().includes(searchLower) ||
      doc.content.toLowerCase().includes(searchLower)
  );

  if (options?.categories && options.categories.length > 0) {
    filtered = filtered.filter((doc) =>
      doc.categories?.some((cat) => options.categories!.includes(cat))
    );
  }

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Get document usage stats (which skills reference this document)
 */
export async function getDocumentUsageStats(documentId: string): Promise<{
  skillCount: number;
  skills: Array<{ id: string; title: string }>;
}> {
  // Find skills that reference this document
  const skills = await prisma.skill.findMany({
    where: {
      sourceDocuments: {
        path: "$[*].id",
        array_contains: documentId,
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  return {
    skillCount: skills.length,
    skills,
  };
}

/**
 * Bulk update document categories
 */
export async function bulkUpdateDocumentCategories(
  documentIds: string[],
  categories: string[]
): Promise<number> {
  const result = await prisma.knowledgeDocument.updateMany({
    where: {
      id: {
        in: documentIds,
      },
    },
    data: {
      categories,
    },
  });

  return result.count;
}

/**
 * Get documents with no categories
 */
export async function getUncategorizedDocuments(): Promise<KnowledgeDocument[]> {
  const documents = await prisma.knowledgeDocument.findMany({
    where: {
      OR: [{ categories: { equals: [] } }, { categories: null }],
    },
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    content: doc.content || "",
    categories: (doc.categories as string[]) || [],
    uploadedAt: doc.uploadedAt,
    fileSize: doc.fileSize || 0,
    fileType: doc.fileType || "unknown",
    skillCount: 0,
  }));
}

/**
 * Get document statistics
 */
export async function getDocumentStats(): Promise<{
  total: number;
  byFileType: Record<string, number>;
  totalSize: number;
  averageSize: number;
}> {
  const documents = await getAllDocuments();

  const byFileType: Record<string, number> = {};
  let totalSize = 0;

  for (const doc of documents) {
    const fileType = doc.fileType || "unknown";
    byFileType[fileType] = (byFileType[fileType] || 0) + 1;
    totalSize += doc.fileSize || 0;
  }

  return {
    total: documents.length,
    byFileType,
    totalSize,
    averageSize: documents.length > 0 ? totalSize / documents.length : 0,
  };
}
