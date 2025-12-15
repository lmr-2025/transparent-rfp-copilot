// Customer Profile types (The Rolodex)

export type CustomerProfileSourceUrl = {
  url: string;
  addedAt: string;
  lastFetchedAt?: string;
};

export type CustomerProfileOwner = {
  name: string;
  email?: string;
};

export type CustomerProfileHistoryEntry = {
  date: string;
  action: "created" | "updated" | "refreshed" | "owner_added" | "owner_removed";
  summary: string;
  user?: string;
};

export type CustomerProfileKeyFact = {
  label: string; // e.g., "Founded", "Employees", "Revenue"
  value: string; // e.g., "2015", "500+", "$50M ARR"
};

export type CustomerProfile = {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  overview: string;
  products?: string;
  challenges?: string;
  keyFacts: CustomerProfileKeyFact[];
  sourceUrls: CustomerProfileSourceUrl[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt?: string;
  createdBy?: string;
  owners?: CustomerProfileOwner[];
  history?: CustomerProfileHistoryEntry[];
};

// For creating a new profile (omit auto-generated fields)
export type CustomerProfileCreate = Omit<
  CustomerProfile,
  "id" | "createdAt" | "updatedAt"
>;

// For updating a profile
export type CustomerProfileUpdate = Partial<
  Omit<CustomerProfile, "id" | "createdAt" | "updatedAt">
>;

// Draft returned from AI suggest endpoint
export type CustomerProfileDraft = {
  name: string;
  industry?: string;
  website?: string;
  overview: string;
  products?: string;
  challenges?: string;
  keyFacts: CustomerProfileKeyFact[];
};

// Simplified profile for selection UI (chat, projects)
export type CustomerProfileSelection = {
  id: string;
  name: string;
  industry?: string;
  selected: boolean;
};
