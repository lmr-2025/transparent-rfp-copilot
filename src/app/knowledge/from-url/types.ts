export type UploadStatus = {
  id: string;
  filename: string;
  status: "pending" | "processing" | "saved" | "error";
  message?: string;
};

export type SkillDraft = {
  title: string;
  content: string;
  sourceMapping?: string[];
  // Store source URLs directly in the draft so they survive any re-renders
  _sourceUrls?: string[];
  // For update mode - track what's changing
  _isUpdate?: boolean;
  _existingSkillId?: string;
  _originalTitle?: string;
  _originalContent?: string;
  _changeHighlights?: string[];
  _changeSummary?: string;
};

export type SnippetDraft = {
  name: string;
  key: string;
  content: string;
  category: string | null;
  description: string | null;
  // Store source URLs directly in the draft
  _sourceUrls?: string[];
};

// Analysis result types
export type SplitSuggestion = {
  title: string;
  category?: string;
  description: string;
  relevantUrls: string[];
};

export type SkillSuggestion = {
  action: "create_new" | "update_existing" | "split_topics";
  existingSkillId?: string;
  existingSkillTitle?: string;
  suggestedTitle?: string;
  suggestedCategory?: string;
  splitSuggestions?: SplitSuggestion[];
  reason: string;
};

export type AnalysisResult = {
  suggestion: SkillSuggestion;
  sourcePreview: string;
  urlAlreadyUsed?: {
    skillId: string;
    skillTitle: string;
    matchedUrls: string[];
  };
};
