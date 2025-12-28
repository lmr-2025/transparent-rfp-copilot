import { create } from "zustand";
import { useShallow } from "zustand/shallow";

// Types (moved from page.tsx for reusability)
export type DraftContent = {
  title: string;
  content: string;
  hasChanges?: boolean;
  changeHighlights?: string[];
  // Transparency fields
  reasoning?: string;
  inference?: string;
  sources?: string;
};

// Document source info
export type DocumentSource = {
  id: string;
  title: string;
  filename: string;
  content: string;
};

// Discrepancy analysis for UPDATE groups (new URL vs existing skill content)
export type DiscrepancyAnalysis = {
  changeLevel: "minimal" | "moderate" | "significant";
  changePercentage: number;
  changeSummary: {
    newTopics: string[];
    updatedContent: string[];
    removedContent: string[];
  };
  recommendation: string;
};

// Coherence analysis for all groups (sources within the group)
export type CoherenceConflict = {
  type: "technical_contradiction" | "version_mismatch" | "scope_mismatch" | "outdated_vs_current" | "different_perspectives";
  description: string;
  affectedSources: number[];
  severity: "low" | "medium" | "high";
};

export type CoherenceAnalysis = {
  coherent: boolean;
  coherenceLevel: "high" | "medium" | "low";
  coherencePercentage: number;
  conflicts: CoherenceConflict[];
  recommendation: string;
  summary: string;
};

export type SkillGroup = {
  id: string;
  type: "create" | "update";
  skillTitle: string;
  existingSkillId?: string;
  urls: string[];
  documentIds?: string[]; // Document IDs in this group
  documents?: DocumentSource[]; // Full document data for generation
  category?: string; // AI-suggested or user-selected category
  status:
    | "pending"
    | "approved"
    | "generating"
    | "ready_for_review"
    | "reviewed"
    | "saving"
    | "done"
    | "error"
    | "rejected";
  error?: string;
  reason?: string;
  notes?: string; // User guidance for content generation (e.g., "focus on security aspects")
  draft?: DraftContent;
  originalContent?: string;
  originalTitle?: string;
  originalTags?: string[];
  discrepancyAnalysis?: DiscrepancyAnalysis; // For UPDATE groups - shows content differences vs existing skill
  coherenceAnalysis?: CoherenceAnalysis; // For all groups with 2+ sources - shows internal conflicts
};

export type WorkflowStep =
  | "input"
  | "analyzing"
  | "review_groups"
  | "generating"
  | "review_drafts"
  | "saving"
  | "done";

export type ProcessedResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type SnippetDraft = {
  name: string;
  key: string;
  content: string;
  category: string | null;
  description: string | null;
  _sourceUrls?: string[];
};

export type BuildType = "skill" | "snippet";

interface BulkImportState {
  // Workflow
  workflowStep: WorkflowStep;
  buildType: BuildType;

  // Data
  urlInput: string;
  uploadedDocuments: DocumentSource[]; // Documents uploaded for import
  skillGroups: SkillGroup[];
  snippetDraft: SnippetDraft | null;
  processedResult: ProcessedResult | null;
  errorMessage: string | null;

  // UI State
  expandedGroups: Set<string>;
  previewGroup: SkillGroup | null;
  editingDraft: { groupId: string; field: "title" | "content" } | null;

  // Actions - Workflow
  setWorkflowStep: (step: WorkflowStep) => void;
  setBuildType: (type: BuildType) => void;

  // Actions - Data
  setUrlInput: (input: string) => void;
  addUploadedDocument: (doc: DocumentSource) => void;
  removeUploadedDocument: (docId: string) => void;
  clearUploadedDocuments: () => void;
  setSkillGroups: (groups: SkillGroup[]) => void;
  updateSkillGroup: (
    groupId: string,
    updates: Partial<SkillGroup>
  ) => void;
  setSnippetDraft: (draft: SnippetDraft | null) => void;
  setProcessedResult: (result: ProcessedResult | null) => void;
  setErrorMessage: (message: string | null) => void;

  // Actions - UI
  setExpandedGroups: (groups: Set<string>) => void;
  toggleGroupExpanded: (groupId: string) => void;
  setPreviewGroup: (group: SkillGroup | null) => void;
  setEditingDraft: (
    editing: { groupId: string; field: "title" | "content" } | null
  ) => void;

  // Actions - Group Management
  toggleGroupApproval: (groupId: string) => void;
  rejectGroup: (groupId: string) => void;
  approveAll: () => void;
  approveDraft: (groupId: string) => void;
  approveAllDrafts: () => void;
  rejectDraft: (groupId: string) => void;
  updateDraftField: (
    groupId: string,
    field: "title" | "content",
    value: string
  ) => void;
  moveUrl: (fromGroupId: string, url: string, toGroupId: string) => void;
  createNewGroupFromUrl: (
    fromGroupId: string,
    url: string,
    newTitle: string
  ) => void;

  // Actions - Reset
  reset: () => void;
}

const initialState = {
  workflowStep: "input" as WorkflowStep,
  buildType: "skill" as BuildType,
  urlInput: "",
  uploadedDocuments: [] as DocumentSource[],
  skillGroups: [] as SkillGroup[],
  snippetDraft: null as SnippetDraft | null,
  processedResult: null as ProcessedResult | null,
  errorMessage: null as string | null,
  expandedGroups: new Set<string>(),
  previewGroup: null as SkillGroup | null,
  editingDraft: null as { groupId: string; field: "title" | "content" } | null,
};

export const useBulkImportStore = create<BulkImportState>((set) => ({
  ...initialState,

  // Workflow actions
  setWorkflowStep: (workflowStep) => set({ workflowStep }),
  setBuildType: (buildType) => set({ buildType }),

  // Data actions
  setUrlInput: (urlInput) => set({ urlInput }),
  addUploadedDocument: (doc) =>
    set((state) => ({
      uploadedDocuments: [...state.uploadedDocuments, doc],
    })),
  removeUploadedDocument: (docId) =>
    set((state) => ({
      uploadedDocuments: state.uploadedDocuments.filter((d) => d.id !== docId),
    })),
  clearUploadedDocuments: () => set({ uploadedDocuments: [] }),
  setSkillGroups: (skillGroups) => set({ skillGroups }),
  updateSkillGroup: (groupId, updates) =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      ),
    })),
  setSnippetDraft: (snippetDraft) => set({ snippetDraft }),
  setProcessedResult: (processedResult) => set({ processedResult }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),

  // UI actions
  setExpandedGroups: (expandedGroups) => set({ expandedGroups }),
  toggleGroupExpanded: (groupId) =>
    set((state) => {
      const next = new Set(state.expandedGroups);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return { expandedGroups: next };
    }),
  setPreviewGroup: (previewGroup) => set({ previewGroup }),
  setEditingDraft: (editingDraft) => set({ editingDraft }),

  // Group management actions
  toggleGroupApproval: (groupId) =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) =>
        g.id === groupId
          ? { ...g, status: g.status === "approved" ? "pending" : "approved" }
          : g
      ),
    })),

  rejectGroup: (groupId) =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) =>
        g.id === groupId ? { ...g, status: "rejected" } : g
      ),
    })),

  approveAll: () =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) => ({
        ...g,
        status: g.status === "pending" ? "approved" : g.status,
      })),
    })),

  approveDraft: (groupId) =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) =>
        g.id === groupId ? { ...g, status: "reviewed" } : g
      ),
    })),

  approveAllDrafts: () =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) => ({
        ...g,
        status: g.status === "ready_for_review" ? "reviewed" : g.status,
      })),
    })),

  rejectDraft: (groupId) =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) =>
        g.id === groupId ? { ...g, status: "rejected" } : g
      ),
    })),

  updateDraftField: (groupId, field, value) =>
    set((state) => ({
      skillGroups: state.skillGroups.map((g) => {
        if (g.id === groupId && g.draft) {
          return {
            ...g,
            draft: {
              ...g.draft,
              [field]: value,
            },
          };
        }
        return g;
      }),
    })),

  moveUrl: (fromGroupId, url, toGroupId) =>
    set((state) => {
      const newGroups = state.skillGroups
        .map((g) => {
          if (g.id === fromGroupId)
            return { ...g, urls: g.urls.filter((u) => u !== url) };
          if (g.id === toGroupId) return { ...g, urls: [...g.urls, url] };
          return g;
        })
        .filter((g) => g.urls.length > 0);
      return { skillGroups: newGroups };
    }),

  createNewGroupFromUrl: (fromGroupId, url, newTitle) =>
    set((state) => {
      const newGroups = state.skillGroups
        .map((g) => {
          if (g.id === fromGroupId)
            return { ...g, urls: g.urls.filter((u) => u !== url) };
          return g;
        })
        .filter((g) => g.urls.length > 0);

      newGroups.push({
        id: `group-${Date.now()}`,
        type: "create",
        skillTitle: newTitle,
        urls: [url],
        status: "pending",
      });

      return { skillGroups: newGroups };
    }),

  // Reset
  reset: () =>
    set({
      ...initialState,
      expandedGroups: new Set<string>(), // Create fresh Set instance
    }),
}));

// Selector hooks for computed values
// Use useShallow to prevent infinite re-renders when returning objects
export const useBulkImportCounts = () =>
  useBulkImportStore(
    useShallow((state) => ({
      pendingCount: state.skillGroups.filter((g) => g.status === "pending").length,
      approvedCount: state.skillGroups.filter((g) => g.status === "approved")
        .length,
      readyForReviewCount: state.skillGroups.filter(
        (g) => g.status === "ready_for_review"
      ).length,
      reviewedCount: state.skillGroups.filter((g) => g.status === "reviewed")
        .length,
      totalGroups: state.skillGroups.length,
    }))
  );
