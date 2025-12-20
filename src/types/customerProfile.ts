// Customer Profile types (The Rolodex)

export type CustomerProfileSourceUrl = {
  url: string;
  addedAt: string;
  lastFetchedAt?: string;
};

export type CustomerProfileSourceDocument = {
  id: string;
  filename: string;
  uploadedAt: string;
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

/**
 * @deprecated Since 2024-12 - Use content field (markdown prose) instead.
 * Will be removed in a future version.
 */
export type CustomerProfileKeyFact = {
  /** e.g., "Founded", "Employees", "Revenue" */
  label: string;
  /** e.g., "2015", "500+", "$50M ARR" */
  value: string;
};

export type CustomerProfile = {
  id: string;
  name: string;
  industry?: string;
  website?: string;

  // Static fields from Salesforce (read-only in app)
  salesforceId?: string; // Salesforce Account ID - used to link GTM data
  region?: string; // e.g., "NA", "EMEA", "APAC"
  tier?: string; // e.g., "Enterprise", "Mid-Market", "SMB"
  employeeCount?: number; // NumberOfEmployees
  annualRevenue?: number; // AnnualRevenue in USD
  accountType?: string; // Customer, Prospect, Partner, etc.
  billingLocation?: string; // Combined BillingCity, State, Country
  lastSalesforceSync?: string; // When static fields were last synced

  /** New unified content field (markdown-structured prose) - preferred over legacy fields */
  content?: string;
  /** Special notes/caveats about this customer */
  considerations: string[];
  sourceDocuments?: CustomerProfileSourceDocument[];

  /**
   * @deprecated Since 2024-12 - Use content field instead.
   * Kept for backwards compatibility. Will be migrated to content field.
   */
  overview: string;
  /**
   * @deprecated Since 2024-12 - Use content field instead.
   * Kept for backwards compatibility. Will be migrated to content field.
   */
  products?: string;
  /**
   * @deprecated Since 2024-12 - Use content field instead.
   * Kept for backwards compatibility. Will be migrated to content field.
   */
  challenges?: string;
  /**
   * @deprecated Since 2024-12 - Use content field instead.
   * Kept for backwards compatibility. Will be migrated to content field.
   */
  keyFacts: CustomerProfileKeyFact[];

  sourceUrls: CustomerProfileSourceUrl[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt?: string;
  createdBy?: string;
  owners?: CustomerProfileOwner[];
  history?: CustomerProfileHistoryEntry[];
  // Git sync tracking (Phase 2 of git-first architecture)
  syncStatus?: "synced" | "pending" | "failed" | null;
  lastSyncedAt?: string;
  gitCommitSha?: string;
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

// Draft returned from AI suggest endpoint (new format with content)
export type CustomerProfileDraft = {
  name: string;
  industry?: string;
  website?: string;
  content: string; // Unified markdown content
  considerations?: string[];
};

/**
 * @deprecated Use CustomerProfileDraft instead (with content field).
 * Legacy draft format for backwards compatibility.
 */
export type CustomerProfileDraftLegacy = {
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
