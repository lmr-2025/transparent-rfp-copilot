import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parseApiData, getApiErrorMessage } from "@/lib/apiClient";
import { knowledgeQueryKeys } from "./use-knowledge";

// Query keys for cache management
export const chatQueryKeys = {
  sessions: ["chat-sessions"] as const,
};

// Chat session item type
export interface ChatSessionItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages?: { role: string; content: string; timestamp?: string; confidence?: string; notes?: string }[];
  skillsUsed?: { id: string; title: string }[];
  documentsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  urlsUsed?: { id: string; title: string }[];
}

/**
 * Fetch chat sessions
 * @param limit - Number of sessions to fetch (default: 20)
 */
export function useChatSessions(limit = 20) {
  return useQuery({
    queryKey: [...chatQueryKeys.sessions, { limit }],
    queryFn: async (): Promise<ChatSessionItem[]> => {
      const res = await fetch(`/api/chat-sessions?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const json = await res.json();
      const data = parseApiData<ChatSessionItem[]>(json, "sessions");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - sessions may be actively updated
  });
}

// ============================================================================
// CHAT MESSAGE MUTATION
// ============================================================================

type SendMessageParams = {
  message: string;
  skills: { id: string; title: string; content: string }[];
  customerProfiles: {
    id: string;
    name: string;
    industry?: string;
    content?: string;
    considerations?: string[];
    overview?: string;
    products?: string;
    challenges?: string;
    keyFacts?: { label: string; value: string }[];
  }[];
  documentIds: string[];
  referenceUrls: { id: string; url: string; title: string | null }[];
  conversationHistory: { role: string; content: string }[];
  userInstructions: string;
  quickMode?: boolean; // Use Haiku for faster responses
  callMode?: boolean; // Ultra-brief responses for live customer calls
};

type SendMessageResponse = {
  response: string;
  skillsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  documentsUsed?: { id: string; title: string }[];
  urlsUsed?: { id: string; title: string }[];
  contextTruncated?: boolean;
  transparency?: {
    systemPrompt: string;
    baseSystemPrompt?: string;
    knowledgeContext: string;
    customerContext?: string;
    documentContext?: string;
    urlContext?: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

/**
 * Send a message to the knowledge chat API
 */
export function useSendMessage() {
  return useMutation({
    mutationFn: async (params: SendMessageParams): Promise<SendMessageResponse> => {
      const res = await fetch("/api/knowledge-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(getApiErrorMessage(errorData, "Failed to get response"));
      }

      const json = await res.json();
      return parseApiData<SendMessageResponse>(json);
    },
  });
}

// ============================================================================
// CHAT SESSION MUTATIONS
// ============================================================================

type SaveSessionParams = {
  sessionId: string | null;
  messages: { role: string; content: string; timestamp: string; confidence?: string; notes?: string }[];
  skillsUsed: { id: string; title: string }[];
  documentsUsed: { id: string; title: string }[];
  customersUsed: { id: string; name: string }[];
  urlsUsed: { id: string; title: string }[];
};

/**
 * Save or update a chat session
 */
export function useSaveSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SaveSessionParams) => {
      const { sessionId, ...body } = params;

      if (sessionId) {
        // Update existing session
        const res = await fetch(`/api/chat-sessions/${sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to update session");
        return { id: sessionId };
      } else {
        // Create new session
        const res = await fetch("/api/chat-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to create session");
        const json = await res.json();
        const session = parseApiData<{ id: string }>(json, "session");
        return { id: session.id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions });
    },
  });
}

// Re-export knowledge query keys for convenience
export { knowledgeQueryKeys };
