import { create } from "zustand";

export type FeedbackRating = "THUMBS_UP" | "THUMBS_DOWN" | null;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  // Transparency data for assistant messages
  skillsUsed?: { id: string; title: string }[];
  documentsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  urlsUsed?: { id: string; title: string }[];
  systemPrompt?: string;
  model?: string;
  // Response transparency metadata (parsed from LLM response)
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  // Feedback data
  feedback?: {
    rating: FeedbackRating;
    comment?: string;
    flaggedForReview?: boolean;
    flagNote?: string;
  };
};

type SidebarTab = "instructions" | "knowledge" | "customers";

interface ChatState {
  // Messages
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentSessionId: string | null;

  // UI state
  sidebarTab: SidebarTab;
  showHistory: boolean;
  inputValue: string;

  // User instructions
  userInstructions: string;
  selectedPresetId: string | null;

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessageFeedback: (messageId: string, feedback: ChatMessage["feedback"]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setShowHistory: (show: boolean) => void;
  setInputValue: (value: string) => void;
  setUserInstructions: (instructions: string) => void;
  setSelectedPresetId: (id: string | null) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  messages: [],
  isLoading: false,
  error: null,
  currentSessionId: null,
  sidebarTab: "instructions",
  showHistory: false,
  inputValue: "",
  userInstructions: "",
  selectedPresetId: null,

  // Actions
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessageFeedback: (messageId, feedback) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ),
    })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setShowHistory: (showHistory) => set({ showHistory }),
  setInputValue: (inputValue) => set({ inputValue }),
  setUserInstructions: (userInstructions) => set({ userInstructions }),
  setSelectedPresetId: (selectedPresetId) => set({ selectedPresetId }),
  clearChat: () =>
    set({
      messages: [],
      currentSessionId: null,
      error: null,
    }),
}));
