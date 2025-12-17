import {
  CustomerProfile,
  CustomerProfileCreate,
  CustomerProfileUpdate,
  CustomerProfileKeyFact,
  CustomerProfileSourceUrl,
  CustomerProfileOwner,
  CustomerProfileHistoryEntry,
} from "@/types/customerProfile";
import { createApiClient } from "./apiClient";

/**
 * API client for customer profile CRUD operations (The Rolodex)
 */

// Type for database profile format (before transformation)
interface DbCustomerProfile {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  overview: string;
  products?: string | null;
  challenges?: string | null;
  keyFacts?: CustomerProfileKeyFact[] | null;
  sourceUrls?: CustomerProfileSourceUrl[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt?: string | null;
  createdBy?: string | null;
  owners?: CustomerProfileOwner[] | null;
  history?: CustomerProfileHistoryEntry[] | null;
}

/**
 * Transform database profile format to frontend CustomerProfile type
 */
function transformProfileFromDb(item: unknown): CustomerProfile {
  const p = item as DbCustomerProfile;
  return {
    id: p.id,
    name: p.name,
    industry: p.industry ?? undefined,
    website: p.website ?? undefined,
    overview: p.overview,
    products: p.products ?? undefined,
    challenges: p.challenges ?? undefined,
    keyFacts: p.keyFacts ?? [],
    sourceUrls: p.sourceUrls ?? [],
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    lastRefreshedAt: p.lastRefreshedAt ?? undefined,
    createdBy: p.createdBy ?? undefined,
    owners: p.owners ?? undefined,
    history: p.history ?? undefined,
  };
}

// Create the base API client with transformation
const profileClient = createApiClient<CustomerProfile, CustomerProfileCreate, CustomerProfileUpdate>({
  baseUrl: "/api/customers",
  singularKey: "profile",
  pluralKey: "profiles",
  transform: transformProfileFromDb,
});

// Re-export with specific function names for backward compatibility

export async function fetchAllProfiles(): Promise<CustomerProfile[]> {
  return profileClient.fetchAll();
}

export async function fetchActiveProfiles(): Promise<CustomerProfile[]> {
  return profileClient.fetchAll({ active: "true" });
}

export async function fetchProfile(id: string): Promise<CustomerProfile | null> {
  return profileClient.fetch(id);
}

export async function createProfile(
  profile: CustomerProfileCreate
): Promise<CustomerProfile> {
  return profileClient.create(profile);
}

export async function updateProfile(
  id: string,
  updates: CustomerProfileUpdate
): Promise<CustomerProfile> {
  return profileClient.update(id, updates);
}

export async function deleteProfile(id: string): Promise<void> {
  return profileClient.delete(id);
}
