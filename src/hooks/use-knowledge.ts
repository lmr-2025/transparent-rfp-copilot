import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadSkillsFromApi, updateSkillViaApi, deleteSkillViaApi } from "@/lib/skillStorage";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
import { Skill } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { ContextSnippet } from "@/types/contextSnippet";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";

// Define types locally to avoid Turbopack export issues with `export type`
export interface SkillOwner {
  userId?: string;
  name: string;
  email?: string;
  image?: string;
}

export interface SourceUrl {
  url: string;
  addedAt: string;
  lastFetchedAt?: string;
}

export interface HistoryEntry {
  date: string;
  action: string;
  summary: string;
  user?: string;
}

// User type for owner management
export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

// Query keys for cache management
export const knowledgeQueryKeys = {
  skills: ["skills"] as const,
  documents: ["documents"] as const,
  urls: ["reference-urls"] as const,
  customers: ["customers"] as const,
  snippets: ["context-snippets"] as const,
  categories: ["categories"] as const,
  users: ["users"] as const,
  presets: ["instruction-presets"] as const,
};

// Stale times for caching - data stays "fresh" for this duration before refetching
// This significantly reduces redundant API calls during active sessions
const STALE_TIMES = {
  skills: 60 * 60 * 1000, // 1 hour - core skills are very stable
  documents: 30 * 60 * 1000, // 30 minutes - documents are fairly stable
  urls: 30 * 60 * 1000, // 30 minutes - URLs rarely change
  customers: 15 * 60 * 1000, // 15 minutes - customer profiles may be updated
  snippets: 60 * 60 * 1000, // 1 hour - snippets are very stable
  categories: 60 * 60 * 1000, // 1 hour - categories rarely change
  users: 30 * 60 * 1000, // 30 minutes - users list is fairly stable
  presets: 4 * 60 * 60 * 1000, // 4 hours - library/extended skills are very stable
};

// ============================================================================
// UNIFIED HOOKS - Single source of truth for all knowledge data
// ============================================================================

/**
 * Fetch skills with optional filtering, search, and pagination
 * @param options.activeOnly - Only return active skills (default: false)
 * @param options.search - Search term to filter by title/content
 * @param options.categories - Filter by categories
 * @param options.limit - Maximum number of results to return
 * @param options.offset - Number of results to skip (for pagination)
 */
export function useSkills(options: {
  activeOnly?: boolean;
  search?: string;
  categories?: string[];
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: [...knowledgeQueryKeys.skills, options],
    queryFn: async () => {
      const allSkills = await loadSkillsFromApi();

      // Apply filters
      let filtered = allSkills;

      if (options.activeOnly) {
        filtered = filtered.filter((s) => s.isActive);
      }

      if (options.search) {
        const searchLower = options.search.toLowerCase();
        filtered = filtered.filter((s) =>
          s.title.toLowerCase().includes(searchLower) ||
          s.content.toLowerCase().includes(searchLower)
        );
      }

      if (options.categories && options.categories.length > 0) {
        filtered = filtered.filter((s) =>
          s.categories?.some((cat) => options.categories!.includes(cat))
        );
      }

      // Apply pagination
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;

      return {
        skills: filtered.slice(start, end),
        total: filtered.length,
        hasMore: end ? filtered.length > end : false,
      };
    },
    staleTime: STALE_TIMES.skills,
  });
}

/**
 * Fetch documents with optional filtering
 * @param options.categories - Filter by categories
 */
export function useDocuments(options: { categories?: string[] } = {}) {
  return useApiQuery<KnowledgeDocument[]>({
    queryKey: [...knowledgeQueryKeys.documents, { categories: options.categories }],
    url: "/api/documents",
    responseKey: "documents",
    transform: (data) => {
      const docs = Array.isArray(data) ? data : [];
      if (options.categories && options.categories.length > 0) {
        return docs.filter((doc) =>
          doc.categories?.some((cat: string) => options.categories!.includes(cat))
        );
      }
      return docs;
    },
    staleTime: STALE_TIMES.documents,
  });
}

/**
 * Fetch reference URLs with optional filtering
 * @param options.categories - Filter by categories
 */
export function useReferenceUrls(options: { categories?: string[] } = {}) {
  return useApiQuery<ReferenceUrl[]>({
    queryKey: [...knowledgeQueryKeys.urls, { categories: options.categories }],
    url: "/api/reference-urls",
    transform: (data) => {
      const urls = Array.isArray(data) ? data : [];
      if (options.categories && options.categories.length > 0) {
        return urls.filter((url) =>
          url.categories?.some((cat: string) => options.categories!.includes(cat))
        );
      }
      return urls;
    },
    staleTime: STALE_TIMES.urls,
  });
}

/**
 * Fetch customer profiles with optional filtering
 * @param options.activeOnly - Only return active profiles (default: true)
 */
export function useCustomerProfiles(options: { activeOnly?: boolean } = { activeOnly: true }) {
  return useQuery({
    queryKey: [...knowledgeQueryKeys.customers, { activeOnly: options.activeOnly }],
    queryFn: async () => {
      const profiles = await fetchActiveProfiles();
      return options.activeOnly ? profiles.filter((p) => p.isActive !== false) : profiles;
    },
    staleTime: STALE_TIMES.customers,
  });
}

/**
 * Fetch context snippets with optional filtering
 * @param options.category - Filter by category
 */
export function useContextSnippets(options: { category?: string } = {}) {
  return useApiQuery<ContextSnippet[]>({
    queryKey: [...knowledgeQueryKeys.snippets, { category: options.category }],
    url: "/api/context-snippets",
    responseKey: "snippets",
    transform: (data) => {
      const snippets = Array.isArray(data) ? data : [];
      if (options.category) {
        return snippets.filter((s) => s.category === options.category);
      }
      return snippets;
    },
    staleTime: STALE_TIMES.snippets,
  });
}

/**
 * Fetch categories
 */
export function useCategories() {
  return useQuery({
    queryKey: knowledgeQueryKeys.categories,
    queryFn: loadCategoriesFromApi,
    staleTime: STALE_TIMES.categories,
  });
}

/**
 * Fetch instruction presets
 */
export function useInstructionPresets() {
  return useApiQuery<unknown[]>({
    queryKey: knowledgeQueryKeys.presets,
    url: "/api/instruction-presets",
    responseKey: "presets",
    transform: (data) => (Array.isArray(data) ? data : []),
    staleTime: STALE_TIMES.presets,
  });
}

/**
 * Fetch users (for owner management)
 */
export function useUsers() {
  return useApiQuery<AppUser[]>({
    queryKey: knowledgeQueryKeys.users,
    url: "/api/users",
    responseKey: "users",
    transform: (data) => (Array.isArray(data) ? data : []),
    staleTime: STALE_TIMES.users,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update skill mutation
 */
export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Skill> }) =>
      updateSkillViaApi(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.skills });
    },
  });
}

/**
 * Delete skill mutation
 */
export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSkillViaApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.skills });
    },
  });
}

/**
 * Delete document mutation
 */
export function useDeleteDocument() {
  return useApiMutation<void, string>({
    url: (id) => `/api/documents/${id}`,
    method: "DELETE",
    invalidateKeys: [knowledgeQueryKeys.documents],
  });
}

/**
 * Delete URL mutation
 */
export function useDeleteUrl() {
  return useApiMutation<void, string>({
    url: (id) => `/api/reference-urls/${id}`,
    method: "DELETE",
    invalidateKeys: [knowledgeQueryKeys.urls],
  });
}

/**
 * Delete snippet mutation
 */
export function useDeleteSnippet() {
  return useApiMutation<void, string>({
    url: (id) => `/api/context-snippets/${id}`,
    method: "DELETE",
    invalidateKeys: [knowledgeQueryKeys.snippets],
  });
}

// ============================================================================
// SKILL REFRESH OPERATIONS
// ============================================================================

export type RefreshResult = {
  hasChanges: boolean;
  message?: string;
  draft?: {
    title: string;
    content: string;
    changeHighlights: string[];
    summary: string;
  };
  originalTitle?: string;
  originalContent?: string;
};

/**
 * Refresh skill from source URLs
 */
export function useRefreshSkill() {
  return useApiMutation<RefreshResult, string>({
    url: (id) => `/api/skills/${id}/refresh`,
    method: "POST",
    invalidateKeys: [knowledgeQueryKeys.skills],
  });
}

export type ApplyRefreshInput = {
  id: string;
  title: string;
  content: string;
  changeHighlights?: string[];
};

/**
 * Apply refresh changes after user review
 */
export function useApplyRefreshChanges() {
  return useApiMutation<RefreshResult, ApplyRefreshInput>({
    url: (vars) => `/api/skills/${vars.id}/refresh`,
    method: "PUT",
    invalidateKeys: [knowledgeQueryKeys.skills],
  });
}

// ============================================================================
// UNIFIED KNOWLEDGE ITEM TYPES & TRANSFORMS
// ============================================================================

export type LibraryItemType = "skill" | "document" | "url" | "customer" | "snippet";

export interface SourceDocument {
  id: string;
  filename: string;
  uploadedAt: string;
}

export type SyncStatus = "synced" | "pending" | "failed" | null;

export interface UnifiedKnowledgeItem {
  id: string;
  type: LibraryItemType;
  title: string;
  subtitle?: string;
  content?: string;
  categories?: string[];
  tier?: "core" | "extended" | "library";
  tierOverrides?: Record<string, "core" | "extended" | "library">;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  owners?: SkillOwner[];
  sourceUrls?: SourceUrl[];
  sourceDocuments?: SourceDocument[];
  history?: HistoryEntry[];
  lastRefreshedAt?: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  filename?: string;
  fileSize?: number;
  fileType?: string;
  snippetKey?: string;
  linkedSkillId?: string;
  skillCount?: number;
}

export function skillToUnifiedItem(skill: Skill): UnifiedKnowledgeItem {
  return {
    id: skill.id,
    type: "skill",
    title: skill.title,
    subtitle: skill.categories?.join(", "),
    content: skill.content,
    categories: skill.categories,
    tier: skill.tier,
    tierOverrides: skill.tierOverrides,
    isActive: skill.isActive,
    createdAt: skill.createdAt,
    updatedAt: skill.lastRefreshedAt || skill.createdAt,
    owners: skill.owners,
    sourceUrls: skill.sourceUrls,
    sourceDocuments: skill.sourceDocuments as SourceDocument[] | undefined,
    history: skill.history,
    lastRefreshedAt: skill.lastRefreshedAt,
    syncStatus: skill.syncStatus as SyncStatus,
    lastSyncedAt: skill.lastSyncedAt,
  };
}

export function documentToUnifiedItem(doc: KnowledgeDocument): UnifiedKnowledgeItem {
  return {
    id: doc.id,
    type: "document",
    title: doc.title,
    subtitle: doc.filename,
    content: doc.content,
    categories: doc.categories,
    createdAt: doc.uploadedAt,
    updatedAt: doc.uploadedAt,
    filename: doc.filename,
    fileSize: doc.fileSize,
    fileType: doc.fileType,
    skillCount: doc.skillCount,
  };
}

export function urlToUnifiedItem(url: ReferenceUrl): UnifiedKnowledgeItem {
  return {
    id: url.id,
    type: "url",
    title: url.title || url.url,
    subtitle: url.url,
    content: url.description || undefined,
    categories: url.categories,
    createdAt: url.addedAt,
    updatedAt: url.lastUsedAt || url.addedAt,
    skillCount: url.skillCount,
  };
}

export function snippetToUnifiedItem(snippet: ContextSnippet): UnifiedKnowledgeItem {
  return {
    id: snippet.id,
    type: "snippet",
    title: snippet.name,
    subtitle: snippet.key,
    content: snippet.content,
    categories: snippet.category ? [snippet.category] : [],
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
    snippetKey: snippet.key,
  };
}
