// Types for the Knowledge Library
import { Skill, SkillOwner, SourceUrl } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { CustomerProfile } from "@/types/customerProfile";
import { ContextSnippet } from "@/types/contextSnippet";
import { AnalyzeLibraryResponse, LibraryRecommendation } from "@/types/libraryAnalysis";

export type TabType = "skills" | "documents" | "urls" | "customers" | "snippets";

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

// Unified item type for display
export interface LibraryItem {
  id: string;
  title: string;
  description?: string;
  categories: string[];
  type: TabType;
  createdAt: string;
  // Type-specific data
  skillData?: Skill;
  documentData?: KnowledgeDocument;
  urlData?: ReferenceUrl;
  customerData?: CustomerProfile;
  snippetData?: ContextSnippet;
}

// Library analysis state
export type AnalysisTransparency = AnalyzeLibraryResponse["transparency"];

export type LibraryAnalysisState = {
  isAnalyzing: boolean;
  recommendations: LibraryRecommendation[];
  summary: string;
  healthScore: number;
  showPanel: boolean;
  dismissedIds: Set<string>;
  error: string | null;
  transparency: AnalysisTransparency | null;
  showTransparencyModal: boolean;
};

export const createAnalysisState = (): LibraryAnalysisState => ({
  isAnalyzing: false,
  recommendations: [],
  summary: "",
  healthScore: 0,
  showPanel: false,
  dismissedIds: new Set(),
  error: null,
  transparency: null,
  showTransparencyModal: false,
});

// Merge preview state
export interface MergePreviewState {
  recIndex: number;
  targetSkill: Skill;
  skillsToMerge: Skill[];
  mergedTitle: string;
  mergedContent: string;
  mergedTags: string[];
  mergedSourceUrls: SourceUrl[];
  mergedOwners: SkillOwner[];
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;
}

// Owner management state
export type OwnerEditState = {
  skillId: string | null;
  isSelecting: boolean;
  isSaving: boolean;
};
