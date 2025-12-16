import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import { getApiErrorMessage } from "@/lib/utils";
import { Skill } from "@/types/skill";
import { ReferenceUrl } from "@/types/referenceUrl";
import { CustomerProfile } from "@/types/customerProfile";
import { KnowledgeDocument } from "@/types/document";

// Query keys for cache management
export const chatQueryKeys = {
  skills: ["skills"] as const,
  documents: ["documents"] as const,
  urls: ["reference-urls"] as const,
  customers: ["customers"] as const,
  categories: ["categories"] as const,
  presets: ["instruction-presets"] as const,
  sessions: (limit?: number) => ["chat-sessions", limit] as const,
};

// Fetch skills
export function useSkills() {
  return useQuery({
    queryKey: chatQueryKeys.skills,
    queryFn: async () => {
      const skills = await loadSkillsFromApi();
      return skills.filter((s) => s.isActive);
    },
  });
}

// Fetch documents
export function useDocuments() {
  return useQuery({
    queryKey: chatQueryKeys.documents,
    queryFn: async (): Promise<KnowledgeDocument[]> => {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const json = await res.json();
      // API returns { data: { documents: [...] } } format
      const data = json.data?.documents ?? json.documents ?? [];
      return Array.isArray(data) ? data : [];
    },
  });
}

// Fetch reference URLs
export function useReferenceUrls() {
  return useQuery({
    queryKey: chatQueryKeys.urls,
    queryFn: async () => {
      const res = await fetch("/api/reference-urls");
      if (!res.ok) throw new Error("Failed to fetch URLs");
      const json = await res.json();
      // API returns { data: [...] } format
      const data = json.data ?? json.urls ?? json;
      return Array.isArray(data) ? data : [];
    },
  });
}

// Fetch customer profiles
export function useCustomerProfiles() {
  return useQuery({
    queryKey: chatQueryKeys.customers,
    queryFn: async () => {
      return fetchActiveProfiles();
    },
  });
}

// Fetch categories
export function useCategories() {
  return useQuery({
    queryKey: chatQueryKeys.categories,
    queryFn: loadCategoriesFromApi,
  });
}

// Fetch instruction presets
export function useInstructionPresets() {
  return useQuery({
    queryKey: chatQueryKeys.presets,
    queryFn: async () => {
      const res = await fetch("/api/instruction-presets");
      if (!res.ok) throw new Error("Failed to fetch presets");
      const json = await res.json();
      // API returns { data: { presets: [...] } } format
      const data = json.data?.presets ?? json.presets ?? [];
      return Array.isArray(data) ? data : [];
    },
  });
}

// Fetch chat sessions
export function useChatSessions(limit = 20) {
  return useQuery({
    queryKey: chatQueryKeys.sessions(limit),
    queryFn: async () => {
      const res = await fetch(`/api/chat-sessions?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const json = await res.json();
      // API returns { data: { sessions: [...] } } format
      const data = json.data?.sessions ?? json.sessions ?? [];
      return Array.isArray(data) ? data : [];
    },
  });
}

// Send chat message mutation
type SendMessageParams = {
  message: string;
  skills: { id: string; title: string; content: string }[];
  customerProfiles: {
    id: string;
    name: string;
    industry?: string;
    overview?: string;
    products?: string;
    challenges?: string;
    keyFacts?: { label: string; value: string }[];
  }[];
  documentIds: string[];
  referenceUrls: { id: string; url: string; title: string }[];
  conversationHistory: { role: string; content: string }[];
  userInstructions: string;
};

export function useSendMessage() {
  return useMutation({
    mutationFn: async (params: SendMessageParams) => {
      const res = await fetch("/api/knowledge-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(getApiErrorMessage(errorData, "Failed to get response"));
      }

      return res.json();
    },
  });
}

// Save chat session mutation
type SaveSessionParams = {
  sessionId: string | null;
  messages: { role: string; content: string; timestamp: string }[];
  skillsUsed: { id: string; title: string }[];
  documentsUsed: { id: string; title: string }[];
  customersUsed: { id: string; name: string }[];
  urlsUsed: { id: string; title: string }[];
};

export function useSaveSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SaveSessionParams) => {
      const { sessionId, ...body } = params;

      if (sessionId) {
        // Update existing
        const res = await fetch(`/api/chat-sessions/${sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to update session");
        return { id: sessionId };
      } else {
        // Create new
        const res = await fetch("/api/chat-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to create session");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
    },
  });
}
