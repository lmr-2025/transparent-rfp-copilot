export type UploadedDocument = {
  name: string;
  content: string;
  size: number;
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
