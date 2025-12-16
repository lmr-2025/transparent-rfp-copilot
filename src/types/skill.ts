export type SkillFact = {
  question: string;
  answer: string;
};

export type SkillInformation = {
  responseTemplate?: string;
  sources?: string[]; // Deprecated - use sourceUrls instead
};

// Default categories - users can customize via the Categories page
export const DEFAULT_SKILL_CATEGORIES = [
  "Security & Compliance",
  "Data Platform",
  "Integrations & APIs",
  "Monitoring & Observability",
  "Infrastructure",
  "Authentication & Access",
  "Product Features",
  "Pricing & Licensing",
  "Support & SLAs",
  "Company & Culture",
  "Privacy & Data Handling",
  "Development & DevOps",
  "Documentation & Training",
  "Marketing & Positioning",
  "Other",
] as const;

// Category type for user-defined categories
export type SkillCategoryItem = {
  id: string;
  name: string;
  description?: string;
  color?: string; // Optional color for UI display
  createdAt: string;
};

// Legacy type for backwards compatibility
export type SkillCategory = string;

export type SourceUrl = {
  url: string;
  title?: string; // User-friendly name for the URL
  addedAt: string;
  lastFetchedAt?: string;
};

// Source document info (for skills built from uploaded documents)
export type SourceDocument = {
  id: string;
  filename: string;
  uploadedAt: string;
};

export type SkillOwner = {
  userId?: string; // Links to User table for SSO users
  name: string;
  email?: string;
  image?: string; // User avatar URL
};

export type SkillHistoryEntry = {
  date: string;
  action: 'created' | 'updated' | 'refreshed' | 'owner_added' | 'owner_removed';
  summary: string;
  user?: string;
};

export type Skill = {
  id: string;
  title: string;
  categories?: string[]; // Broad capability areas this skill belongs to (can be multiple)
  category?: SkillCategory; // Deprecated - use categories[] instead
  content: string;
  quickFacts: SkillFact[];
  edgeCases: string[];
  sourceUrls: SourceUrl[]; // URLs used to build/update this skill
  sourceDocuments?: SourceDocument[]; // Documents used to build this skill
  information?: SkillInformation; // Deprecated - keeping for backwards compatibility
  isActive: boolean;
  createdAt: string;
  lastRefreshedAt?: string;
  lastSourceLink?: string; // Deprecated - use sourceUrls instead
  owners?: SkillOwner[]; // Subject matter experts responsible for this skill
  history?: SkillHistoryEntry[]; // Audit trail of changes
};
