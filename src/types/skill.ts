export type SkillFact = {
  question: string;
  answer: string;
};

export type SkillInformation = {
  responseTemplate?: string;
  sources?: string[]; // Deprecated - use sourceUrls instead
};

export type SourceUrl = {
  url: string;
  addedAt: string;
  lastFetchedAt?: string;
};

export type SkillOwner = {
  name: string;
  email?: string;
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
  tags: string[];
  content: string;
  quickFacts: SkillFact[];
  edgeCases: string[];
  sourceUrls: SourceUrl[]; // URLs used to build/update this skill
  information?: SkillInformation; // Deprecated - keeping for backwards compatibility
  isActive: boolean;
  createdAt: string;
  lastRefreshedAt?: string;
  lastSourceLink?: string; // Deprecated - use sourceUrls instead
  owners?: SkillOwner[]; // Subject matter experts responsible for this skill
  history?: SkillHistoryEntry[]; // Audit trail of changes
};
