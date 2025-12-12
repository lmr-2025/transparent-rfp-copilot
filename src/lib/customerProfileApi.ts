import {
  CustomerProfile,
  CustomerProfileCreate,
  CustomerProfileUpdate,
  CustomerProfileKeyFact,
  CustomerProfileSourceUrl,
  CustomerProfileOwner,
  CustomerProfileHistoryEntry,
} from "@/types/customerProfile";

/**
 * API client for customer profile CRUD operations (The Rolodex)
 */

// Type for database profile format
interface DbCustomerProfile {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  overview: string;
  products?: string | null;
  challenges?: string | null;
  keyFacts?: CustomerProfileKeyFact[] | null;
  tags: string[];
  sourceUrls?: CustomerProfileSourceUrl[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt?: string | null;
  createdBy?: string | null;
  owners?: CustomerProfileOwner[] | null;
  history?: CustomerProfileHistoryEntry[] | null;
}

export async function fetchAllProfiles(): Promise<CustomerProfile[]> {
  const response = await fetch("/api/customers");
  if (!response.ok) {
    throw new Error("Failed to fetch customer profiles");
  }
  const data = await response.json();
  return data.profiles.map(transformProfileFromDb);
}

export async function fetchActiveProfiles(): Promise<CustomerProfile[]> {
  const response = await fetch("/api/customers?active=true");
  if (!response.ok) {
    throw new Error("Failed to fetch active customer profiles");
  }
  const data = await response.json();
  return data.profiles.map(transformProfileFromDb);
}

export async function fetchProfile(id: string): Promise<CustomerProfile | null> {
  const response = await fetch(`/api/customers/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to fetch customer profile");
  }
  const data = await response.json();
  return transformProfileFromDb(data.profile);
}

export async function createProfile(
  profile: CustomerProfileCreate
): Promise<CustomerProfile> {
  const response = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create customer profile");
  }
  const data = await response.json();
  return transformProfileFromDb(data.profile);
}

export async function updateProfile(
  id: string,
  updates: CustomerProfileUpdate
): Promise<CustomerProfile> {
  const response = await fetch(`/api/customers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update customer profile");
  }
  const data = await response.json();
  return transformProfileFromDb(data.profile);
}

export async function deleteProfile(id: string): Promise<void> {
  const response = await fetch(`/api/customers/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete customer profile");
  }
}

/**
 * Transform database profile format to frontend CustomerProfile type
 */
function transformProfileFromDb(dbProfile: DbCustomerProfile): CustomerProfile {
  return {
    id: dbProfile.id,
    name: dbProfile.name,
    industry: dbProfile.industry ?? undefined,
    website: dbProfile.website ?? undefined,
    overview: dbProfile.overview,
    products: dbProfile.products ?? undefined,
    challenges: dbProfile.challenges ?? undefined,
    keyFacts: dbProfile.keyFacts ?? [],
    tags: dbProfile.tags ?? [],
    sourceUrls: dbProfile.sourceUrls ?? [],
    isActive: dbProfile.isActive,
    createdAt: dbProfile.createdAt,
    updatedAt: dbProfile.updatedAt,
    lastRefreshedAt: dbProfile.lastRefreshedAt ?? undefined,
    createdBy: dbProfile.createdBy ?? undefined,
    owners: dbProfile.owners ?? undefined,
    history: dbProfile.history ?? undefined,
  };
}
