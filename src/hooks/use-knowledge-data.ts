import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadSkillsFromApi, updateSkillViaApi, deleteSkillViaApi } from "@/lib/skillStorage";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import { Skill } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { ContextSnippet } from "@/types/contextSnippet";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
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
};

// Stale times for caching - data stays "fresh" for this duration before refetching
// This significantly reduces redundant API calls during active sessions
const STALE_TIMES = {
  skills: 30 * 60 * 1000, // 30 minutes - skills are stable after initial build
  documents: 30 * 60 * 1000, // 30 minutes - documents are stable
  urls: 30 * 60 * 1000, // 30 minutes - URLs rarely change
  customers: 15 * 60 * 1000, // 15 minutes - customer profiles may be updated
  snippets: 60 * 60 * 1000, // 1 hour - snippets are very stable
  categories: 60 * 60 * 1000, // 1 hour - categories rarely change
  users: 30 * 60 * 1000, // 30 minutes - users list is fairly stable
};

// Fetch all skills
export function useAllSkills() {
  return useQuery({
    queryKey: knowledgeQueryKeys.skills,
    queryFn: loadSkillsFromApi,
    staleTime: STALE_TIMES.skills,
  });
}

// Fetch documents
export function useAllDocuments() {
  return useApiQuery<KnowledgeDocument[]>({
    queryKey: knowledgeQueryKeys.documents,
    url: "/api/documents",
    responseKey: "documents",
    transform: (data) => (Array.isArray(data) ? data : []),
    staleTime: STALE_TIMES.documents,
  });
}

// Fetch reference URLs
export function useAllReferenceUrls() {
  return useApiQuery<ReferenceUrl[]>({
    queryKey: knowledgeQueryKeys.urls,
    url: "/api/reference-urls",
    transform: (data) => (Array.isArray(data) ? data : []),
    staleTime: STALE_TIMES.urls,
  });
}

// Fetch customer profiles
export function useAllCustomers() {
  return useQuery({
    queryKey: knowledgeQueryKeys.customers,
    queryFn: fetchActiveProfiles,
    staleTime: STALE_TIMES.customers,
  });
}

// Fetch context snippets
export function useAllSnippets() {
  return useApiQuery<ContextSnippet[]>({
    queryKey: knowledgeQueryKeys.snippets,
    url: "/api/context-snippets",
    responseKey: "snippets",
    transform: (data) => (Array.isArray(data) ? data : []),
    staleTime: STALE_TIMES.snippets,
  });
}

// Fetch categories
export function useAllCategories() {
  return useQuery({
    queryKey: knowledgeQueryKeys.categories,
    queryFn: loadCategoriesFromApi,
    staleTime: STALE_TIMES.categories,
  });
}

// Fetch users (for owner management)
export function useAllUsers() {
  return useApiQuery<AppUser[]>({
    queryKey: knowledgeQueryKeys.users,
    url: "/api/users",
    responseKey: "users",
    transform: (data) => (Array.isArray(data) ? data : []),
    staleTime: STALE_TIMES.users,
  });
}

// Update skill mutation
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

// Delete skill mutation
export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSkillViaApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.skills });
    },
  });
}

// Delete document mutation
export function useDeleteDocument() {
  return useApiMutation<void, string>({
    url: (id) => `/api/documents/${id}`,
    method: "DELETE",
    invalidateKeys: [knowledgeQueryKeys.documents],
  });
}

// Delete URL mutation
export function useDeleteUrl() {
  return useApiMutation<void, string>({
    url: (id) => `/api/reference-urls/${id}`,
    method: "DELETE",
    invalidateKeys: [knowledgeQueryKeys.urls],
  });
}

// Delete snippet mutation
export function useDeleteSnippet() {
  return useApiMutation<void, string>({
    url: (id) => `/api/context-snippets/${id}`,
    method: "DELETE",
    invalidateKeys: [knowledgeQueryKeys.snippets],
  });
}

// Refresh skill from source URLs
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

export function useRefreshSkill() {
  return useApiMutation<RefreshResult, string>({
    url: (id) => `/api/skills/${id}/refresh`,
    method: "POST",
    invalidateKeys: [knowledgeQueryKeys.skills],
  });
}

// Apply refresh changes after user review
export type ApplyRefreshInput = {
  id: string;
  title: string;
  content: string;
  changeHighlights?: string[];
};

export function useApplyRefreshChanges() {
  return useApiMutation<RefreshResult, ApplyRefreshInput>({
    url: (vars) => `/api/skills/${vars.id}/refresh`,
    method: "PUT",
    invalidateKeys: [knowledgeQueryKeys.skills],
  });
}

// Helper types for unified library items
export type LibraryItemType = "skill" | "document" | "url" | "customer" | "snippet";

// Source document info (for skills built from uploaded documents)
export interface SourceDocument {
  id: string;
  filename: string;
  uploadedAt: string;
}

// Sync status type for git-backed skills
export type SyncStatus = "synced" | "pending" | "failed" | null;

export interface UnifiedLibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  subtitle?: string;
  content?: string;
  categories?: string[];
  tier?: "core" | "extended" | "library"; // Default skill tier for progressive loading
  tierOverrides?: Record<string, "core" | "extended" | "library">; // Category-specific tier overrides
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  owners?: SkillOwner[];
  // Expanded details for skills
  sourceUrls?: SourceUrl[];
  sourceDocuments?: SourceDocument[];
  history?: HistoryEntry[];
  lastRefreshedAt?: string;
  // Git sync tracking (skills only)
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  // Document-specific
  filename?: string;
  fileSize?: number;
  fileType?: string;
  // Snippet-specific
  snippetKey?: string;
  // Linked skill info (for sources)
  linkedSkillId?: string;
  // Skill count (for sources) - via SkillSource join table
  skillCount?: number;
}

// Transform skills to unified items
export function skillToUnifiedItem(skill: Skill): UnifiedLibraryItem {
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
    // Git sync tracking
    syncStatus: skill.syncStatus as SyncStatus,
    lastSyncedAt: skill.lastSyncedAt,
  };
}

// Transform documents to unified items
export function documentToUnifiedItem(doc: KnowledgeDocument): UnifiedLibraryItem {
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

// Transform URLs to unified items
export function urlToUnifiedItem(url: ReferenceUrl): UnifiedLibraryItem {
  return {
    id: url.id,
    type: "url",
    title: url.title || url.url, // Fallback to URL if no title
    subtitle: url.url,
    content: url.description || undefined,
    categories: url.categories,
    createdAt: url.addedAt,
    updatedAt: url.lastUsedAt || url.addedAt,
    skillCount: url.skillCount,
  };
}

// Transform snippets to unified items
export function snippetToUnifiedItem(snippet: ContextSnippet): UnifiedLibraryItem {
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
