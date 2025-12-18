export type UploadedDocument = {
  name: string;
  content: string;
  size: number;
  file: File; // Keep original file for attaching to profile after save
  docType?: string; // Optional document type (proposal, meeting_notes, etc.)
};

export type SalesforceSearchResult = {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  type?: string;
};

export type SalesforceEnrichment = {
  name: string;
  industry: string | null;
  website: string | null;
  overview: string;
  keyFacts: { label: string; value: string }[];
  salesforceId: string;
  // Static fields from Salesforce
  region: string | null;
  tier: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  accountType: string | null;
  billingLocation: string | null;
};

export type TransparencyData = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
};

export type AnalysisResult = {
  suggestion: {
    action: "create_new" | "update_existing";
    existingProfileId?: string;
    existingProfileName?: string;
    suggestedName?: string;
    suggestedIndustry?: string;
    reason: string;
  };
  sourcePreview: string;
  urlAlreadyUsed?: {
    profileId: string;
    profileName: string;
    matchedUrls: string[];
  };
  transparency?: TransparencyData;
};
