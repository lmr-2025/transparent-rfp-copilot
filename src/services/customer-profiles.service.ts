import { prisma } from "@/lib/prisma";
import { CustomerProfile } from "@/types/customer";

/**
 * Get all customer profiles
 */
export async function getAllCustomerProfiles(): Promise<CustomerProfile[]> {
  const profiles = await prisma.customerProfile.findMany({
    orderBy: { name: "asc" },
  });

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    industry: profile.industry || undefined,
    content: profile.content || undefined,
    considerations: (profile.considerations as string[]) || undefined,
    // Legacy fields
    overview: profile.overview || undefined,
    products: profile.products || undefined,
    challenges: profile.challenges || undefined,
    keyFacts: (profile.keyFacts as Array<{ label: string; value: string }>) || undefined,
    isActive: profile.isActive ?? true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }));
}

/**
 * Get active customer profiles only
 */
export async function getActiveCustomerProfiles(): Promise<CustomerProfile[]> {
  const allProfiles = await getAllCustomerProfiles();
  return allProfiles.filter((p) => p.isActive !== false);
}

/**
 * Get a single customer profile by ID
 */
export async function getCustomerProfileById(id: string): Promise<CustomerProfile | null> {
  const profile = await prisma.customerProfile.findUnique({
    where: { id },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    industry: profile.industry || undefined,
    content: profile.content || undefined,
    considerations: (profile.considerations as string[]) || undefined,
    overview: profile.overview || undefined,
    products: profile.products || undefined,
    challenges: profile.challenges || undefined,
    keyFacts: (profile.keyFacts as Array<{ label: string; value: string }>) || undefined,
    isActive: profile.isActive ?? true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Create a new customer profile
 */
export async function createCustomerProfile(data: {
  name: string;
  industry?: string;
  content?: string;
  considerations?: string[];
  overview?: string;
  products?: string;
  challenges?: string;
  keyFacts?: Array<{ label: string; value: string }>;
  isActive?: boolean;
}): Promise<CustomerProfile> {
  const profile = await prisma.customerProfile.create({
    data: {
      name: data.name,
      industry: data.industry,
      content: data.content,
      considerations: data.considerations || [],
      overview: data.overview,
      products: data.products,
      challenges: data.challenges,
      keyFacts: data.keyFacts || [],
      isActive: data.isActive ?? true,
    },
  });

  return {
    id: profile.id,
    name: profile.name,
    industry: profile.industry || undefined,
    content: profile.content || undefined,
    considerations: (profile.considerations as string[]) || undefined,
    overview: profile.overview || undefined,
    products: profile.products || undefined,
    challenges: profile.challenges || undefined,
    keyFacts: (profile.keyFacts as Array<{ label: string; value: string }>) || undefined,
    isActive: profile.isActive ?? true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Update a customer profile
 */
export async function updateCustomerProfile(
  id: string,
  updates: Partial<
    Omit<CustomerProfile, "id" | "createdAt" | "updatedAt">
  >
): Promise<CustomerProfile> {
  const profile = await prisma.customerProfile.update({
    where: { id },
    data: {
      ...updates,
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    id: profile.id,
    name: profile.name,
    industry: profile.industry || undefined,
    content: profile.content || undefined,
    considerations: (profile.considerations as string[]) || undefined,
    overview: profile.overview || undefined,
    products: profile.products || undefined,
    challenges: profile.challenges || undefined,
    keyFacts: (profile.keyFacts as Array<{ label: string; value: string }>) || undefined,
    isActive: profile.isActive ?? true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Delete a customer profile
 */
export async function deleteCustomerProfile(id: string): Promise<void> {
  await prisma.customerProfile.delete({
    where: { id },
  });
}

/**
 * Search customer profiles by name or industry
 */
export async function searchCustomerProfiles(
  query: string,
  options?: {
    activeOnly?: boolean;
    limit?: number;
  }
): Promise<CustomerProfile[]> {
  const allProfiles = options?.activeOnly
    ? await getActiveCustomerProfiles()
    : await getAllCustomerProfiles();

  const searchLower = query.toLowerCase();
  let filtered = allProfiles.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchLower) ||
      profile.industry?.toLowerCase().includes(searchLower) ||
      profile.content?.toLowerCase().includes(searchLower) ||
      profile.overview?.toLowerCase().includes(searchLower)
  );

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Get customer profile with documents
 */
export async function getCustomerProfileWithDocuments(id: string): Promise<{
  profile: CustomerProfile;
  documents: Array<{
    id: string;
    title: string;
    content: string;
    docType: string | null;
    createdAt: string;
  }>;
} | null> {
  const profile = await getCustomerProfileById(id);
  if (!profile) return null;

  const documents = await prisma.customerDocument.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      docType: true,
      createdAt: true,
    },
  });

  return {
    profile,
    documents: documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content || "",
      docType: doc.docType,
      createdAt: doc.createdAt,
    })),
  };
}

/**
 * Add a document to a customer profile
 */
export async function addCustomerDocument(data: {
  customerId: string;
  title: string;
  content: string;
  docType?: string;
}): Promise<{
  id: string;
  title: string;
  content: string;
  docType: string | null;
}> {
  const doc = await prisma.customerDocument.create({
    data: {
      customerId: data.customerId,
      title: data.title,
      content: data.content,
      docType: data.docType,
    },
  });

  return {
    id: doc.id,
    title: doc.title,
    content: doc.content || "",
    docType: doc.docType,
  };
}

/**
 * Remove a document from a customer profile
 */
export async function deleteCustomerDocument(documentId: string): Promise<void> {
  await prisma.customerDocument.delete({
    where: { id: documentId },
  });
}

/**
 * Get customer profile statistics
 */
export async function getCustomerProfileStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  byIndustry: Record<string, number>;
  withDocuments: number;
}> {
  const [allProfiles, profilesWithDocs] = await Promise.all([
    getAllCustomerProfiles(),
    prisma.customerDocument.groupBy({
      by: ["customerId"],
    }),
  ]);

  const active = allProfiles.filter((p) => p.isActive).length;
  const inactive = allProfiles.length - active;

  const byIndustry: Record<string, number> = {};
  for (const profile of allProfiles) {
    const industry = profile.industry || "Not specified";
    byIndustry[industry] = (byIndustry[industry] || 0) + 1;
  }

  return {
    total: allProfiles.length,
    active,
    inactive,
    byIndustry,
    withDocuments: profilesWithDocs.length,
  };
}

/**
 * Migrate legacy profile fields to unified content field
 */
export async function migrateLegacyProfile(id: string): Promise<CustomerProfile> {
  const profile = await getCustomerProfileById(id);
  if (!profile) {
    throw new Error("Customer profile not found");
  }

  // If already has content field, no migration needed
  if (profile.content) {
    return profile;
  }

  // Build unified content from legacy fields
  const sections: string[] = [];

  if (profile.overview) {
    sections.push(`## Overview\n${profile.overview}`);
  }

  if (profile.products) {
    sections.push(`## Products & Services\n${profile.products}`);
  }

  if (profile.challenges) {
    sections.push(`## Challenges & Needs\n${profile.challenges}`);
  }

  if (profile.keyFacts && profile.keyFacts.length > 0) {
    sections.push(
      `## Key Facts\n${profile.keyFacts.map((f) => `- **${f.label}:** ${f.value}`).join("\n")}`
    );
  }

  const unifiedContent = sections.join("\n\n");

  // Update profile with unified content
  return updateCustomerProfile(id, {
    content: unifiedContent,
  });
}

/**
 * Bulk migrate all legacy profiles
 */
export async function bulkMigrateLegacyProfiles(): Promise<{
  migrated: number;
  skipped: number;
  errors: number;
}> {
  const allProfiles = await getAllCustomerProfiles();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of allProfiles) {
    try {
      // Skip if already has content
      if (profile.content) {
        skipped++;
        continue;
      }

      // Skip if no legacy fields to migrate
      if (!profile.overview && !profile.products && !profile.challenges && !profile.keyFacts) {
        skipped++;
        continue;
      }

      await migrateLegacyProfile(profile.id);
      migrated++;
    } catch (error) {
      console.error(`Failed to migrate profile ${profile.id}:`, error);
      errors++;
    }
  }

  return { migrated, skipped, errors };
}
