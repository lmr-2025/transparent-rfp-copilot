import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadSkillsFromApi, updateSkillViaApi, deleteSkillViaApi } from "@/lib/skillStorage";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import { Skill } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { CustomerProfile } from "@/types/customerProfile";
import { ContextSnippet } from "@/types/contextSnippet";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";

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

// Fetch all skills
export function useAllSkills() {
  return useQuery({
    queryKey: knowledgeQueryKeys.skills,
    queryFn: loadSkillsFromApi,
  });
}

// Fetch documents
export function useAllDocuments() {
  return useQuery({
    queryKey: knowledgeQueryKeys.documents,
    queryFn: async (): Promise<KnowledgeDocument[]> => {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      return (data.documents || []) as KnowledgeDocument[];
    },
  });
}

// Fetch reference URLs
export function useAllReferenceUrls() {
  return useQuery({
    queryKey: knowledgeQueryKeys.urls,
    queryFn: async (): Promise<ReferenceUrl[]> => {
      const res = await fetch("/api/reference-urls");
      if (!res.ok) throw new Error("Failed to fetch URLs");
      const json = await res.json();
      // API returns { data: [...] } format
      const data = json.data ?? json;
      return Array.isArray(data) ? data : [];
    },
  });
}

// Fetch customer profiles
export function useAllCustomers() {
  return useQuery({
    queryKey: knowledgeQueryKeys.customers,
    queryFn: fetchActiveProfiles,
  });
}

// Fetch context snippets
export function useAllSnippets() {
  return useQuery({
    queryKey: knowledgeQueryKeys.snippets,
    queryFn: async (): Promise<ContextSnippet[]> => {
      const res = await fetch("/api/context-snippets");
      if (!res.ok) throw new Error("Failed to fetch snippets");
      const data = await res.json();
      return (data.snippets || []) as ContextSnippet[];
    },
  });
}

// Fetch categories
export function useAllCategories() {
  return useQuery({
    queryKey: knowledgeQueryKeys.categories,
    queryFn: loadCategoriesFromApi,
  });
}

// Fetch users (for owner management)
export function useAllUsers() {
  return useQuery({
    queryKey: knowledgeQueryKeys.users,
    queryFn: async (): Promise<AppUser[]> => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return (data.users || []) as AppUser[];
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete document");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents });
    },
  });
}

// Delete URL mutation
export function useDeleteUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reference-urls/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete URL");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.urls });
    },
  });
}

// Delete snippet mutation
export function useDeleteSnippet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/context-snippets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete snippet");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.snippets });
    },
  });
}

// Helper types for unified library items
export type LibraryItemType = "skill" | "document" | "url" | "customer" | "snippet";

export interface UnifiedLibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  subtitle?: string;
  content?: string;
  categories?: string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  owners?: SkillOwner[];
  // Expanded details for skills
  sourceUrls?: SourceUrl[];
  history?: HistoryEntry[];
  lastRefreshedAt?: string;
  // Document-specific
  filename?: string;
  fileSize?: number;
  fileType?: string;
  // Snippet-specific
  snippetKey?: string;
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
    isActive: skill.isActive,
    createdAt: skill.createdAt,
    updatedAt: skill.lastRefreshedAt || skill.createdAt,
    owners: skill.owners,
    sourceUrls: skill.sourceUrls,
    history: skill.history,
    lastRefreshedAt: skill.lastRefreshedAt,
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
  };
}

// Transform URLs to unified items
export function urlToUnifiedItem(url: ReferenceUrl): UnifiedLibraryItem {
  return {
    id: url.id,
    type: "url",
    title: url.title,
    subtitle: url.url,
    content: url.description || undefined,
    categories: url.categories,
    createdAt: url.addedAt,
    updatedAt: url.lastUsedAt || url.addedAt,
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
