"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { Skill, SkillCategoryItem } from "@/types/skill";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
import { CustomerProfile } from "@/types/customerProfile";
import { ReferenceUrl } from "@/types/referenceUrl";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import {
  ChatPrompt,
  getAllPrompts,
  addUserPrompt,
  deleteUserPrompt,
  getEffectiveCategories,
  CategoryConfig,
} from "@/lib/chatPromptLibrary";
// User instructions are stored locally (separate from system prompts)
const USER_INSTRUCTIONS_STORAGE_KEY = "grc-minion-user-instructions";
const defaultUserInstructions = `You are a helpful assistant. Be professional but conversational. Use bullet points or numbered lists for complex information. Be concise but thorough.`;
import { CLAUDE_MODEL } from "@/lib/config";
import { getDefaultPrompt } from "@/lib/promptBlocks";
import TransparencyModal from "@/components/TransparencyModal";
import ChatProjectSelector from "@/components/ChatProjectSelector";
import SuggestedPrompts from "@/components/SuggestedPrompts";
import { ChatProjectTemplate } from "@/lib/chatProjectTemplates";

// Document type for chat context
type DocumentMeta = {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  categories: string[];
  content?: string; // Loaded on-demand when selected
};

// Selection types for documents and URLs
type DocumentSelection = {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  categories: string[];
  selected: boolean;
  content?: string;
};

type UrlSelection = {
  id: string;
  url: string;
  title: string;
  categories: string[];
  selected: boolean;
};

type TransparencyData = {
  systemPrompt: string; // Full prompt sent to API (with context embedded)
  baseSystemPrompt: string; // Just the system instructions (without context)
  knowledgeContext: string;
  customerContext: string;
  documentContext: string;
  urlContext: string;
  model: string;
  maxTokens: number;
  temperature: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  skillsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  documentsUsed?: { id: string; title: string }[];
  urlsUsed?: { id: string; title: string }[];
  transparency?: TransparencyData;
};

type SkillSelection = {
  id: string;
  title: string;
  selected: boolean;
  tags: string[];
  categories: string[];
};

type CustomerSelection = {
  id: string;
  name: string;
  industry?: string;
  selected: boolean;
};

type SidebarTab = "instructions" | "prompts" | "knowledge" | "customers";

// Instruction preset type
type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description?: string;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  createdBy?: string;
  createdByEmail?: string;
};

// Stored message format from API (timestamps are strings in JSON)
type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

type ChatSessionItem = {
  id: string;
  title: string;
  messages: StoredMessage[];
  skillsUsed?: { id: string; title: string }[];
  documentsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  urlsUsed?: { id: string; title: string }[];
  createdAt: string;
  updatedAt: string;
};

const formatSessionDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};


const styles = {
  container: {
    display: "flex",
    height: "calc(100vh - 60px)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  sidebar: {
    width: "300px",
    borderRight: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  sidebarTabs: {
    display: "flex",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  sidebarTab: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    backgroundColor: "transparent",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    color: "#64748b",
    borderBottom: "2px solid transparent",
    transition: "all 0.15s ease",
  },
  sidebarTabActive: {
    color: "#3b82f6",
    borderBottomColor: "#3b82f6",
    backgroundColor: "#f8fafc",
  },
  sidebarHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  sidebarContent: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "12px",
  },
  skillItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    marginBottom: "8px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  skillItemSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#fff",
  },
  chatHeader: {
    padding: "16px 24px",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "24px",
  },
  messageWrapper: {
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column" as const,
  },
  userMessage: {
    alignSelf: "flex-end",
    maxWidth: "70%",
    padding: "12px 16px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    borderRadius: "16px 16px 4px 16px",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    padding: "12px 16px",
    backgroundColor: "#f1f5f9",
    color: "#1e293b",
    borderRadius: "16px 16px 16px 4px",
  },
  inputArea: {
    padding: "16px 24px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  inputWrapper: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    padding: "12px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    fontSize: "15px",
    resize: "none" as const,
    minHeight: "48px",
    maxHeight: "150px",
    fontFamily: "inherit",
  },
  sendButton: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  skillsUsedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 500,
    marginTop: "8px",
    marginRight: "4px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#64748b",
    textAlign: "center" as const,
    padding: "40px",
  },
  tag: {
    display: "inline-block",
    padding: "2px 6px",
    backgroundColor: "#e2e8f0",
    color: "#64748b",
    borderRadius: "4px",
    fontSize: "10px",
    marginRight: "4px",
    marginTop: "4px",
  },
  promptItem: {
    padding: "10px 12px",
    marginBottom: "8px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  promptCategory: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 600,
    marginBottom: "6px",
  },
};

function ChatPageContent() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillSelections, setSkillSelections] = useState<SkillSelection[]>([]);
  const [, setDocuments] = useState<DocumentMeta[]>([]);
  const [documentSelections, setDocumentSelections] = useState<DocumentSelection[]>([]);
  const [urls, setUrls] = useState<ReferenceUrl[]>([]);
  const [urlSelections, setUrlSelections] = useState<UrlSelection[]>([]);
  const [knowledgeCategories, setKnowledgeCategories] = useState<SkillCategoryItem[]>([]);
  const [selectedKnowledgeCategory, setSelectedKnowledgeCategory] = useState<string>("all");
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [customerSelections, setCustomerSelections] = useState<CustomerSelection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("instructions");
  const [userInstructions, setUserInstructions] = useState<string>(() => {
    if (typeof window === "undefined") return defaultUserInstructions;
    const stored = localStorage.getItem(USER_INSTRUCTIONS_STORAGE_KEY);
    return stored || defaultUserInstructions;
  });
  const [instructionPresets, setInstructionPresets] = useState<InstructionPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDescription, setNewPresetDescription] = useState("");
  const [newPresetIsShared, setNewPresetIsShared] = useState(false);
  const [prompts, setPrompts] = useState<ChatPrompt[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [promptFilter, setPromptFilter] = useState<string>("all");
  const [showTransparency, setShowTransparency] = useState(false);
  const [selectedTransparency, setSelectedTransparency] = useState<TransparencyData | null>(null);
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedProjectTemplate, setSelectedProjectTemplate] = useState<ChatProjectTemplate | null>(null);
  const [usedPrompts, setUsedPrompts] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // Handle query parameter from suggested queries
  useEffect(() => {
    const query = searchParams.get("query");
    if (query && !inputValue) {
      setInputValue(query);
      // Focus the textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch chat history
  const fetchChatHistory = useCallback(async () => {
    if (!session?.user) return;
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/chat-sessions?limit=20");
      if (response.ok) {
        const data = await response.json();
        setChatHistory(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [session?.user]);

  // Create or update chat session
  const saveSession = async (newMessages: ChatMessage[]) => {
    if (!session?.user || newMessages.length === 0) return;

    // Get unique skills/docs/customers/urls used across all assistant messages
    const allSkillsUsed = new Map<string, { id: string; title: string }>();
    const allDocsUsed = new Map<string, { id: string; title: string }>();
    const allCustomersUsed = new Map<string, { id: string; name: string }>();
    const allUrlsUsed = new Map<string, { id: string; title: string }>();

    newMessages.forEach((msg) => {
      if (msg.role === "assistant") {
        msg.skillsUsed?.forEach((s) => allSkillsUsed.set(s.id, s));
        msg.documentsUsed?.forEach((d) => allDocsUsed.set(d.id, d));
        msg.customersUsed?.forEach((c) => allCustomersUsed.set(c.id, c));
        msg.urlsUsed?.forEach((u) => allUrlsUsed.set(u.id, u));
      }
    });

    const messagesForApi = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));

    try {
      if (currentSessionId) {
        // Update existing session
        await fetch(`/api/chat-sessions/${currentSessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesForApi,
            skillsUsed: Array.from(allSkillsUsed.values()),
            documentsUsed: Array.from(allDocsUsed.values()),
            customersUsed: Array.from(allCustomersUsed.values()),
            urlsUsed: Array.from(allUrlsUsed.values()),
          }),
        });
      } else {
        // Create new session
        const response = await fetch("/api/chat-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesForApi,
            skillsUsed: Array.from(allSkillsUsed.values()),
            documentsUsed: Array.from(allDocsUsed.values()),
            customersUsed: Array.from(allCustomersUsed.values()),
            urlsUsed: Array.from(allUrlsUsed.values()),
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentSessionId(data.id);
        }
      }
      // Refresh history after saving
      fetchChatHistory();
    } catch (error) {
      console.error("Failed to save chat session:", error);
    }
  };

  // Delete a chat session
  const deleteSession = async (id: string) => {
    try {
      const response = await fetch(`/api/chat-sessions/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setChatHistory((prev) => prev.filter((s) => s.id !== id));
        if (currentSessionId === id) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat session:", error);
    }
  };

  // Load a chat session
  const loadSession = (item: ChatSessionItem) => {
    // Convert stored messages back to ChatMessage format
    const loadedMessages: ChatMessage[] = (item.messages || []).map((m, idx) => ({
      id: `loaded-${idx}`,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
    setMessages(loadedMessages);
    setCurrentSessionId(item.id);
    setShowHistory(false);
  };

  // Start a new chat
  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
    setSelectedProjectTemplate(null);
    setUsedPrompts(new Set());
  };

  // Load skills, customer profiles, documents, URLs, and prompts on mount
  useEffect(() => {
    // Load skills
    loadSkillsFromApi().then((loaded) => {
      const activeSkills = loaded.filter(s => s.isActive);
      setSkills(activeSkills);
      setSkillSelections(
        activeSkills.map(s => ({
          id: s.id,
          title: s.title,
          tags: s.tags,
          categories: s.categories || [],
          selected: true,
        }))
      );
    }).catch(console.error);

    // Load documents from API
    fetch("/api/documents")
      .then(res => res.json())
      .then(data => {
        const docs = data.documents || [];
        setDocuments(docs);
        setDocumentSelections(
          docs.map((d: DocumentMeta) => ({
            id: d.id,
            title: d.title,
            filename: d.filename,
            fileSize: d.fileSize,
            categories: d.categories || [],
            selected: false, // Default to none selected
          }))
        );
      })
      .catch(err => console.error("Failed to load documents:", err));

    // Load reference URLs from database API
    fetch("/api/reference-urls")
      .then(res => res.json())
      .then(data => {
        const loadedUrls = data.urls || [];
        setUrls(loadedUrls);
        setUrlSelections(
          loadedUrls.map((u: ReferenceUrl) => ({
            id: u.id,
            url: u.url,
            title: u.title,
            categories: u.categories || [],
            selected: false, // Default to none selected
          }))
        );
      })
      .catch(err => console.error("Failed to load reference URLs:", err));

    // Load knowledge categories
    loadCategoriesFromApi()
      .then(cats => setKnowledgeCategories(cats))
      .catch(console.error);

    setPrompts(getAllPrompts());
    setCategories(getEffectiveCategories());

    // Load instruction presets
    fetch("/api/instruction-presets")
      .then(res => res.json())
      .then(data => {
        const presets = data.presets || [];
        setInstructionPresets(presets);
        // If there's a default preset, load its content
        const defaultPreset = presets.find((p: InstructionPreset) => p.isDefault);
        if (defaultPreset) {
          setSelectedPresetId(defaultPreset.id);
          setUserInstructions(defaultPreset.content);
        }
      })
      .catch(err => console.error("Failed to load instruction presets:", err));

    // Load customer profiles from database
    fetchActiveProfiles()
      .then(profiles => {
        setCustomerProfiles(profiles);
        setCustomerSelections(
          profiles.map(p => ({
            id: p.id,
            name: p.name,
            industry: p.industry || undefined,
            selected: false, // Default to none selected
          }))
        );
      })
      .catch(err => {
        console.error("Failed to load customer profiles:", err);
      });
  }, []);

  // Load chat history when session is available
  useEffect(() => {
    if (session?.user) {
      fetchChatHistory();
    }
  }, [session?.user, fetchChatHistory]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [inputValue]);

  const toggleSkill = (skillId: string) => {
    setSkillSelections(prev =>
      prev.map(s => (s.id === skillId ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectedCount = skillSelections.filter(s => s.selected).length;

  // Customer selection helpers
  const toggleCustomer = (customerId: string) => {
    setCustomerSelections(prev =>
      prev.map(c => (c.id === customerId ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAllCustomers = () => {
    setCustomerSelections(prev => prev.map(c => ({ ...c, selected: true })));
  };

  const selectNoCustomers = () => {
    setCustomerSelections(prev => prev.map(c => ({ ...c, selected: false })));
  };

  const selectedCustomerCount = customerSelections.filter(c => c.selected).length;

  // Document selection helpers
  const toggleDocument = (docId: string) => {
    setDocumentSelections(prev =>
      prev.map(d => (d.id === docId ? { ...d, selected: !d.selected } : d))
    );
  };

  const selectedDocCount = documentSelections.filter(d => d.selected).length;

  // URL selection helpers
  const toggleUrl = (urlId: string) => {
    setUrlSelections(prev =>
      prev.map(u => (u.id === urlId ? { ...u, selected: !u.selected } : u))
    );
  };

  const selectedUrlCount = urlSelections.filter(u => u.selected).length;

  // Category-based selection helpers
  const selectByCategory = (categoryName: string) => {
    // Select all items in the given category across skills, documents, and URLs
    setSkillSelections(prev =>
      prev.map(s => ({
        ...s,
        selected: s.selected || s.categories.includes(categoryName),
      }))
    );
    setDocumentSelections(prev =>
      prev.map(d => ({
        ...d,
        selected: d.selected || d.categories.includes(categoryName),
      }))
    );
    setUrlSelections(prev =>
      prev.map(u => ({
        ...u,
        selected: u.selected || u.categories.includes(categoryName),
      }))
    );
  };

  const deselectByCategory = (categoryName: string) => {
    // Deselect all items in the given category
    setSkillSelections(prev =>
      prev.map(s => ({
        ...s,
        selected: s.categories.includes(categoryName) ? false : s.selected,
      }))
    );
    setDocumentSelections(prev =>
      prev.map(d => ({
        ...d,
        selected: d.categories.includes(categoryName) ? false : d.selected,
      }))
    );
    setUrlSelections(prev =>
      prev.map(u => ({
        ...u,
        selected: u.categories.includes(categoryName) ? false : u.selected,
      }))
    );
  };

  const selectAllKnowledge = () => {
    setSkillSelections(prev => prev.map(s => ({ ...s, selected: true })));
    setDocumentSelections(prev => prev.map(d => ({ ...d, selected: true })));
    setUrlSelections(prev => prev.map(u => ({ ...u, selected: true })));
  };

  const selectNoKnowledge = () => {
    setSkillSelections(prev => prev.map(s => ({ ...s, selected: false })));
    setDocumentSelections(prev => prev.map(d => ({ ...d, selected: false })));
    setUrlSelections(prev => prev.map(u => ({ ...u, selected: false })));
  };

  // Calculate total context size (rough estimate)
  const calculateContextSize = () => {
    let totalChars = 0;

    // Skills content
    const selectedSkillIds = new Set(skillSelections.filter(s => s.selected).map(s => s.id));
    skills.filter(s => selectedSkillIds.has(s.id)).forEach(s => {
      totalChars += s.content.length;
    });

    // Document content (estimate based on file size if content not loaded)
    documentSelections.filter(d => d.selected).forEach(d => {
      totalChars += d.content?.length || d.fileSize * 0.8; // Rough estimate
    });

    // URLs (estimate ~5KB each when fetched)
    totalChars += selectedUrlCount * 5000;

    return totalChars;
  };

  const contextSize = calculateContextSize();
  const contextSizeWarning = contextSize > 100000; // Warn at ~100KB

  // Total knowledge items selected
  const totalKnowledgeSelected = selectedCount + selectedDocCount + selectedUrlCount;

  const handleSend = async (promptOverride?: string) => {
    const messageContent = promptOverride || inputValue.trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const selectedSkillIds = new Set(skillSelections.filter(s => s.selected).map(s => s.id));
      const selectedSkills = skills
        .filter(s => selectedSkillIds.has(s.id))
        .map(s => ({
          id: s.id,
          title: s.title,
          content: s.content,
          tags: s.tags,
        }));

      const selectedCustomerIds = new Set(customerSelections.filter(c => c.selected).map(c => c.id));
      const selectedCustomers = customerProfiles
        .filter(p => selectedCustomerIds.has(p.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          industry: p.industry || undefined,
          overview: p.overview,
          products: p.products || undefined,
          challenges: p.challenges || undefined,
          keyFacts: p.keyFacts,
        }));

      // Get selected document IDs
      const selectedDocIds = documentSelections.filter(d => d.selected).map(d => d.id);

      // Get selected URLs
      const selectedUrlIds = new Set(urlSelections.filter(u => u.selected).map(u => u.id));
      const selectedUrls = urls
        .filter(u => selectedUrlIds.has(u.id))
        .map(u => ({
          id: u.id,
          url: u.url,
          title: u.title,
        }));

      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Combine user instructions with project template if selected
      const effectiveInstructions = selectedProjectTemplate
        ? `${selectedProjectTemplate.systemPrompt}\n\n${userInstructions}`.trim()
        : userInstructions;

      const response = await fetch("/api/knowledge-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          skills: selectedSkills,
          customerProfiles: selectedCustomers,
          documentIds: selectedDocIds,
          referenceUrls: selectedUrls,
          conversationHistory,
          userInstructions: effectiveInstructions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        skillsUsed: data.skillsUsed,
        customersUsed: data.customersUsed,
        documentsUsed: data.documentsUsed,
        urlsUsed: data.urlsUsed,
        transparency: data.transparency,
      };

      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);

      // Auto-show transparency for the first message
      if (messages.length === 0 && data.transparency) {
        setSelectedTransparency(data.transparency);
      }

      // Save session to history (async, don't await)
      saveSession(updatedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setUsedPrompts(new Set());
  };

  // Handle selecting a suggested prompt
  const handleSuggestedPrompt = (prompt: string) => {
    setUsedPrompts(prev => new Set([...prev, prompt]));
    handleSend(prompt);
  };

  // Get available suggested prompts (not yet used)
  const getAvailableSuggestedPrompts = (): string[] => {
    if (!selectedProjectTemplate) return [];
    return selectedProjectTemplate.suggestedPrompts.filter(p => !usedPrompts.has(p));
  };

  const applyPrompt = (prompt: ChatPrompt) => {
    setInputValue(prompt.prompt);
    textareaRef.current?.focus();
  };

  const handleSavePrompt = () => {
    if (!newPromptTitle.trim() || !inputValue.trim()) return;
    addUserPrompt(newPromptTitle.trim(), inputValue.trim());
    setPrompts(getAllPrompts());
    setNewPromptTitle("");
    setShowSavePrompt(false);
  };

  const handleDeletePrompt = (id: string) => {
    if (deleteUserPrompt(id)) {
      setPrompts(getAllPrompts());
    }
  };

  const filteredPrompts = promptFilter === "all"
    ? prompts
    : prompts.filter(p => p.category === promptFilter);

  // Generate preview of what will be sent to the API
  const getPreviewPrompt = (): TransparencyData => {
    const selectedSkillIds = new Set(skillSelections.filter(s => s.selected).map(s => s.id));
    const selectedSkills = skills.filter(s => selectedSkillIds.has(s.id));

    const knowledgeContext = selectedSkills.length > 0
      ? selectedSkills.map((skill, idx) =>
          `=== SKILL ${idx + 1}: ${skill.title} ===\nTags: ${skill.tags.join(", ") || "none"}\n\n${skill.content}`
        ).join("\n\n---\n\n")
      : "";

    // Build document context preview (content not available in preview)
    const selectedDocs = documentSelections.filter(d => d.selected);
    const documentContext = selectedDocs.length > 0
      ? selectedDocs.map((doc, idx) =>
          `=== DOCUMENT ${idx + 1}: ${doc.title} ===\nFilename: ${doc.filename}\n\n[Document content will be loaded from database]`
        ).join("\n\n---\n\n")
      : "";

    // Build URL context preview
    const selectedUrlItems = urlSelections.filter(u => u.selected);
    const urlContext = selectedUrlItems.length > 0
      ? selectedUrlItems.map((url, idx) =>
          `=== REFERENCE URL ${idx + 1}: ${url.title} ===\nURL: ${url.url}`
        ).join("\n\n---\n\n")
      : "";

    // Build customer context
    const selectedCustomerIds = new Set(customerSelections.filter(c => c.selected).map(c => c.id));
    const selectedCustomers = customerProfiles.filter(p => selectedCustomerIds.has(p.id));

    const customerContext = selectedCustomers.length > 0
      ? selectedCustomers.map((profile) => {
          const keyFactsText = profile.keyFacts.length > 0
            ? `Key Facts:\n${profile.keyFacts.map(f => `  - ${f.label}: ${f.value}`).join("\n")}`
            : "";
          return `=== CUSTOMER PROFILE: ${profile.name} ===
Industry: ${profile.industry || "Not specified"}

Overview:
${profile.overview}
${profile.products ? `\nProducts & Services:\n${profile.products}` : ""}
${profile.challenges ? `\nChallenges & Needs:\n${profile.challenges}` : ""}
${keyFactsText}`;
        }).join("\n\n---\n\n")
      : "";

    // Build combined context with priority order
    let combinedKnowledgeContext = "";
    if (knowledgeContext) {
      combinedKnowledgeContext += `=== SKILLS (Primary Knowledge Sources) ===\n\n${knowledgeContext}`;
    }
    if (documentContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== DOCUMENTS (Supporting Documentation) ===\n\n${documentContext}`;
    }
    if (urlContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== REFERENCE URLS ===\n\n${urlContext}`;
    }
    if (customerContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== CUSTOMER INTELLIGENCE ===\n\n${customerContext}`;
    }
    if (!combinedKnowledgeContext) {
      combinedKnowledgeContext = "No knowledge base documents provided.";
    }

    // Build preview system prompt using the block-based system (matches server-side)
    const blockSystemPrompt = getDefaultPrompt("chat");
    const baseSystemPrompt = userInstructions
      ? `${blockSystemPrompt}\n\n## User Instructions\n${userInstructions}`
      : blockSystemPrompt;

    const systemPrompt = `${baseSystemPrompt}\n\n## Knowledge Base\n${combinedKnowledgeContext}`;

    return {
      systemPrompt,
      baseSystemPrompt,
      knowledgeContext: combinedKnowledgeContext,
      customerContext,
      documentContext,
      urlContext,
      model: CLAUDE_MODEL,
      maxTokens: 4000,
      temperature: 0.3,
    };
  };

  const groupedPrompts = filteredPrompts.reduce((acc, prompt) => {
    const category = prompt.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(prompt);
    return acc;
  }, {} as Record<string, ChatPrompt[]>);

  // Helper to get category config by id
  const getCategoryConfig = (id: string): CategoryConfig | undefined => {
    return categories.find(c => c.id === id);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTabs}>
          <button
            onClick={() => setSidebarTab("instructions")}
            style={{
              ...styles.sidebarTab,
              ...(sidebarTab === "instructions" ? styles.sidebarTabActive : {}),
            }}
          >
            Instructions
          </button>
          <button
            onClick={() => setSidebarTab("knowledge")}
            style={{
              ...styles.sidebarTab,
              ...(sidebarTab === "knowledge" ? styles.sidebarTabActive : {}),
            }}
          >
            Knowledge ({totalKnowledgeSelected})
          </button>
          <button
            onClick={() => setSidebarTab("customers")}
            style={{
              ...styles.sidebarTab,
              ...(sidebarTab === "customers" ? styles.sidebarTabActive : {}),
            }}
          >
            Customers ({selectedCustomerCount})
          </button>
        </div>

        {sidebarTab === "customers" ? (
          <>
            <div style={styles.sidebarHeader}>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                {selectedCustomerCount} of {customerSelections.length} customer profiles selected
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={selectAllCustomers}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={selectNoCustomers}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select None
                </button>
              </div>
            </div>
            <div style={styles.sidebarContent}>
              {customerSelections.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center", marginTop: "20px" }}>
                  No customer profiles yet.{" "}
                  <a href="/customers" style={{ color: "#3b82f6" }}>Build one</a>
                </p>
              ) : (
                customerSelections.map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => toggleCustomer(customer.id)}
                    style={{
                      ...styles.skillItem,
                      ...(customer.selected ? styles.skillItemSelected : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={customer.selected}
                      onChange={() => toggleCustomer(customer.id)}
                      style={{ marginTop: "2px" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#1e293b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {customer.name}
                      </div>
                      {customer.industry && (
                        <span style={{
                          ...styles.tag,
                          backgroundColor: "#f0fdf4",
                          color: "#166534",
                        }}>
                          {customer.industry}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {/* Link to Customer Library */}
              <div style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0", marginTop: "8px" }}>
                <Link
                  href="/customers"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "center",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  Manage profiles →
                </Link>
              </div>
            </div>
          </>
        ) : sidebarTab === "knowledge" ? (
          <>
            <div style={styles.sidebarHeader}>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                {totalKnowledgeSelected} items selected ({selectedCount} skills, {selectedDocCount} docs, {selectedUrlCount} URLs)
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={selectAllKnowledge}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={selectNoKnowledge}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select None
                </button>
              </div>
              {/* Category quick-add selector */}
              {knowledgeCategories.length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", gap: "4px", alignItems: "center" }}>
                  <select
                    value={selectedKnowledgeCategory}
                    onChange={e => setSelectedKnowledgeCategory(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "4px 6px",
                      fontSize: "11px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      backgroundColor: "#fff",
                    }}
                  >
                    <option value="all">Category...</option>
                    {knowledgeCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedKnowledgeCategory !== "all" && selectByCategory(selectedKnowledgeCategory)}
                    disabled={selectedKnowledgeCategory === "all"}
                    style={{
                      padding: "4px 8px",
                      fontSize: "10px",
                      backgroundColor: selectedKnowledgeCategory === "all" ? "#f1f5f9" : "#dbeafe",
                      color: selectedKnowledgeCategory === "all" ? "#94a3b8" : "#1d4ed8",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      cursor: selectedKnowledgeCategory === "all" ? "not-allowed" : "pointer",
                    }}
                  >
                    + Add
                  </button>
                  <button
                    onClick={() => selectedKnowledgeCategory !== "all" && deselectByCategory(selectedKnowledgeCategory)}
                    disabled={selectedKnowledgeCategory === "all"}
                    style={{
                      padding: "4px 8px",
                      fontSize: "10px",
                      backgroundColor: selectedKnowledgeCategory === "all" ? "#f1f5f9" : "#fee2e2",
                      color: selectedKnowledgeCategory === "all" ? "#94a3b8" : "#dc2626",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      cursor: selectedKnowledgeCategory === "all" ? "not-allowed" : "pointer",
                    }}
                  >
                    - Remove
                  </button>
                </div>
              )}
              {/* Context size indicator */}
              <div style={{
                marginTop: "8px",
                padding: "6px 8px",
                backgroundColor: contextSizeWarning ? "#fef2f2" : "#f8fafc",
                borderRadius: "4px",
                border: `1px solid ${contextSizeWarning ? "#fecaca" : "#e2e8f0"}`,
              }}>
                <div style={{
                  fontSize: "11px",
                  color: contextSizeWarning ? "#dc2626" : "#64748b",
                  display: "flex",
                  justifyContent: "space-between",
                }}>
                  <span>Context size:</span>
                  <span style={{ fontWeight: 500 }}>
                    {contextSize > 1000 ? `${Math.round(contextSize / 1000)}K` : contextSize} chars
                  </span>
                </div>
                {contextSizeWarning && (
                  <div style={{ fontSize: "10px", color: "#dc2626", marginTop: "4px" }}>
                    Large context may slow responses or hit limits
                  </div>
                )}
              </div>
            </div>
            <div style={styles.sidebarContent}>
              {/* Skills Section */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                  padding: "0 4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}>
                  <span>Skills ({selectedCount}/{skillSelections.length})</span>
                </div>
                {skillSelections.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", margin: "8px 0" }}>
                    No skills yet. <a href="/knowledge" style={{ color: "#3b82f6" }}>Add some</a>
                  </p>
                ) : (
                  skillSelections.map(skill => (
                    <div
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      style={{
                        ...styles.skillItem,
                        ...(skill.selected ? styles.skillItemSelected : {}),
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={skill.selected}
                        onChange={() => toggleSkill(skill.id)}
                        style={{ marginTop: "2px" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1e293b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {skill.title}
                        </div>
                        {skill.tags.length > 0 && (
                          <div style={{ marginTop: "4px" }}>
                            {skill.tags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} style={styles.tag}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Documents Section */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                  padding: "0 4px",
                }}>
                  Documents ({selectedDocCount}/{documentSelections.length})
                </div>
                {documentSelections.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", margin: "8px 0" }}>
                    No documents yet. <a href="/knowledge/import" style={{ color: "#3b82f6" }}>Upload some</a>
                  </p>
                ) : (
                  documentSelections.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => toggleDocument(doc.id)}
                      style={{
                        ...styles.skillItem,
                        ...(doc.selected ? styles.skillItemSelected : {}),
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={doc.selected}
                        onChange={() => toggleDocument(doc.id)}
                        style={{ marginTop: "2px" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1e293b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {doc.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          {doc.filename} • {Math.round(doc.fileSize / 1024)}KB
                        </div>
                        {doc.categories.length > 0 && (
                          <div style={{ marginTop: "4px" }}>
                            {doc.categories.slice(0, 2).map((cat, idx) => (
                              <span key={idx} style={{ ...styles.tag, backgroundColor: "#fef3c7", color: "#92400e" }}>{cat}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* URLs Section */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                  padding: "0 4px",
                }}>
                  Reference URLs ({selectedUrlCount}/{urlSelections.length})
                </div>
                {urlSelections.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", margin: "8px 0" }}>
                    No URLs yet. <a href="/knowledge" style={{ color: "#3b82f6" }}>Add some</a>
                  </p>
                ) : (
                  urlSelections.map(url => (
                    <div
                      key={url.id}
                      onClick={() => toggleUrl(url.id)}
                      style={{
                        ...styles.skillItem,
                        ...(url.selected ? styles.skillItemSelected : {}),
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={url.selected}
                        onChange={() => toggleUrl(url.id)}
                        style={{ marginTop: "2px" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1e293b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {url.title}
                        </div>
                        <div style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginTop: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {url.url}
                        </div>
                        {url.categories.length > 0 && (
                          <div style={{ marginTop: "4px" }}>
                            {url.categories.slice(0, 2).map((cat, idx) => (
                              <span key={idx} style={{ ...styles.tag, backgroundColor: "#e0f2fe", color: "#0369a1" }}>{cat}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Link to Library */}
              <div style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0" }}>
                <Link
                  href="/knowledge"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "center",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  Manage library →
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Instructions Tab */}
            <div style={styles.sidebarHeader}>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#64748b" }}>
                Select a preset or write custom instructions
              </p>
              {/* Preset Dropdown */}
              <select
                value={selectedPresetId || "custom"}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "custom") {
                    setSelectedPresetId(null);
                    const stored = localStorage.getItem(USER_INSTRUCTIONS_STORAGE_KEY);
                    setUserInstructions(stored || defaultUserInstructions);
                  } else {
                    const preset = instructionPresets.find(p => p.id === value);
                    if (preset) {
                      setSelectedPresetId(preset.id);
                      setUserInstructions(preset.content);
                    }
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "13px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  backgroundColor: "#fff",
                  marginBottom: "8px",
                }}
              >
                <option value="custom">Custom (local only)</option>
                {instructionPresets.filter(p => p.isShared).length > 0 && (
                  <optgroup label="Org Presets">
                    {instructionPresets.filter(p => p.isShared).map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} {preset.isDefault ? "(default)" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {instructionPresets.filter(p => !p.isShared).length > 0 && (
                  <optgroup label="My Presets">
                    {instructionPresets.filter(p => !p.isShared).map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {/* Selected preset info and status */}
              {selectedPresetId && (() => {
                const preset = instructionPresets.find(p => p.id === selectedPresetId);
                if (!preset) return null;
                return (
                  <div style={{ marginBottom: "8px" }}>
                    {preset.description && (
                      <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginBottom: "4px" }}>
                        {preset.description}
                      </div>
                    )}
                    {/* Status badge */}
                    {preset.shareStatus === "PENDING_APPROVAL" && (
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 500,
                      }}>
                        Pending approval
                      </div>
                    )}
                    {preset.shareStatus === "REJECTED" && (
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}>
                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 8px",
                          backgroundColor: "#fee2e2",
                          color: "#dc2626",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 500,
                          width: "fit-content",
                        }}>
                          Share request rejected
                        </div>
                        {preset.rejectionReason && (
                          <div style={{ fontSize: "11px", color: "#dc2626" }}>
                            Reason: {preset.rejectionReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ ...styles.sidebarContent, display: "flex", flexDirection: "column" }}>
              <textarea
                value={userInstructions}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setUserInstructions(newValue);
                  // Only save to localStorage if using custom
                  if (!selectedPresetId) {
                    localStorage.setItem(USER_INSTRUCTIONS_STORAGE_KEY, newValue);
                  }
                }}
                placeholder="Enter instructions for how the AI should behave..."
                style={{
                  flex: 1,
                  minHeight: "180px",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  resize: "none",
                  fontFamily: "inherit",
                  backgroundColor: "#fff",
                }}
              />
              <div style={{
                marginTop: "8px",
                fontSize: "11px",
                color: "#94a3b8",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <span>{userInstructions.length.toLocaleString()} characters</span>
                <span>{selectedPresetId ? "Using preset" : "Auto-saved locally"}</span>
              </div>

              {/* Save as Preset Button */}
              {!showSavePreset ? (
                <button
                  onClick={() => setShowSavePreset(true)}
                  disabled={!session?.user}
                  style={{
                    marginTop: "12px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    backgroundColor: session?.user ? "#f0fdf4" : "#f1f5f9",
                    color: session?.user ? "#166534" : "#94a3b8",
                    border: `1px solid ${session?.user ? "#86efac" : "#e2e8f0"}`,
                    borderRadius: "6px",
                    cursor: session?.user ? "pointer" : "not-allowed",
                    fontWeight: 500,
                  }}
                >
                  Save as Preset
                </button>
              ) : (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "8px",
                  border: "1px solid #86efac",
                }}>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset name..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "13px",
                      border: "1px solid #86efac",
                      borderRadius: "4px",
                      marginBottom: "8px",
                    }}
                  />
                  <input
                    type="text"
                    value={newPresetDescription}
                    onChange={(e) => setNewPresetDescription(e.target.value)}
                    placeholder="Description (optional)..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "13px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      marginBottom: "8px",
                    }}
                  />
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#64748b",
                    marginBottom: "8px",
                    cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={newPresetIsShared}
                      onChange={(e) => setNewPresetIsShared(e.target.checked)}
                    />
                    {session?.user?.role === "ADMIN"
                      ? "Share with organization"
                      : "Request to share with organization"}
                  </label>
                  {newPresetIsShared && session?.user?.role !== "ADMIN" && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", fontStyle: "italic" }}>
                      An admin will review your request before it becomes visible to others.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={async () => {
                        if (!newPresetName.trim()) return;
                        try {
                          const res = await fetch("/api/instruction-presets", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: newPresetName,
                              content: userInstructions,
                              description: newPresetDescription || null,
                              requestShare: newPresetIsShared,
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setInstructionPresets(prev => [...prev, data.preset]);
                            setSelectedPresetId(data.preset.id);
                            setShowSavePreset(false);
                            setNewPresetName("");
                            setNewPresetDescription("");
                            setNewPresetIsShared(false);
                          }
                        } catch (err) {
                          console.error("Failed to save preset:", err);
                        }
                      }}
                      disabled={!newPresetName.trim()}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "12px",
                        backgroundColor: newPresetName.trim() ? "#22c55e" : "#94a3b8",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: newPresetName.trim() ? "pointer" : "not-allowed",
                        fontWeight: 500,
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSavePreset(false);
                        setNewPresetName("");
                        setNewPresetDescription("");
                        setNewPresetIsShared(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        fontSize: "12px",
                        backgroundColor: "transparent",
                        border: "1px solid #e2e8f0",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preset actions (for owned presets) */}
              {selectedPresetId && (() => {
                const preset = instructionPresets.find(p => p.id === selectedPresetId);
                if (!preset) return null;
                const isOwner = preset.createdBy === session?.user?.id;
                const isAdmin = session?.user?.role === "ADMIN";
                const canDelete = isOwner || isAdmin;
                const canRequestShare = isOwner && preset.shareStatus === "PRIVATE";
                const canCancelRequest = isOwner && (preset.shareStatus === "PENDING_APPROVAL" || preset.shareStatus === "REJECTED");

                return (
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {/* Request to share button */}
                    {canRequestShare && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/instruction-presets/${selectedPresetId}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ requestShare: true }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setInstructionPresets(prev =>
                                prev.map(p => p.id === selectedPresetId ? data.preset : p)
                              );
                            }
                          } catch (err) {
                            console.error("Failed to request share:", err);
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          fontSize: "11px",
                          backgroundColor: "#f0fdf4",
                          color: "#166534",
                          border: "1px solid #86efac",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {isAdmin ? "Share with organization" : "Request to share with org"}
                      </button>
                    )}

                    {/* Cancel share request */}
                    {canCancelRequest && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/instruction-presets/${selectedPresetId}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ requestShare: false }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setInstructionPresets(prev =>
                                prev.map(p => p.id === selectedPresetId ? data.preset : p)
                              );
                            }
                          } catch (err) {
                            console.error("Failed to cancel request:", err);
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          fontSize: "11px",
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          border: "1px solid #e2e8f0",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {preset.shareStatus === "PENDING_APPROVAL" ? "Cancel share request" : "Keep private"}
                      </button>
                    )}

                    {/* Delete button */}
                    {canDelete && (
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this preset?")) return;
                          try {
                            const res = await fetch(`/api/instruction-presets/${selectedPresetId}`, {
                              method: "DELETE",
                            });
                            if (res.ok) {
                              setInstructionPresets(prev => prev.filter(p => p.id !== selectedPresetId));
                              setSelectedPresetId(null);
                              const stored = localStorage.getItem(USER_INSTRUCTIONS_STORAGE_KEY);
                              setUserInstructions(stored || defaultUserInstructions);
                            }
                          } catch (err) {
                            console.error("Failed to delete preset:", err);
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          fontSize: "11px",
                          backgroundColor: "transparent",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Delete this preset
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Tips section */}
              <div style={{
                marginTop: "16px",
                padding: "12px",
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
                  TIPS
                </div>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                  <li>Define your role or persona</li>
                  <li>Specify tone and style preferences</li>
                  <li>Add formatting rules</li>
                </ul>
              </div>

              {/* Link to Admin Prompts */}
              <div style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0", marginTop: "16px" }}>
                <Link
                  href="/admin/prompt-blocks"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "center",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  Manage system prompts →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        <div style={styles.chatHeader}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#1e293b" }}>
                {selectedProjectTemplate ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{selectedProjectTemplate.icon}</span>
                    {selectedProjectTemplate.name}
                  </span>
                ) : (
                  "Chat with Knowledge Base"
                )}
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                {selectedProjectTemplate
                  ? selectedProjectTemplate.description
                  : "Ask questions about your security documentation and policies"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {session?.user && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    backgroundColor: showHistory ? "#dbeafe" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  📜 History ({chatHistory.length})
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#166534",
                  }}
                >
                  + New Chat
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Chat History Panel */}
          {showHistory && session?.user && (
            <div
              style={{
                marginTop: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                backgroundColor: "#fff",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {loadingHistory ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                  Loading history...
                </div>
              ) : chatHistory.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                  No chat history yet. Start a conversation to save it!
                </div>
              ) : (
                chatHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "background-color 0.15s",
                      backgroundColor: currentSessionId === item.id ? "#eff6ff" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (currentSessionId !== item.id) {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentSessionId !== item.id) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div
                        style={{ flex: 1, cursor: "pointer" }}
                        onClick={() => loadSession(item)}
                      >
                        <div
                          style={{
                            fontWeight: 500,
                            color: "#1e293b",
                            marginBottom: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "calc(100% - 60px)",
                          }}
                        >
                          {item.title || "Untitled Chat"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          {formatSessionDate(item.updatedAt)}
                          {item.skillsUsed && item.skillsUsed.length > 0 && (
                            <span style={{ marginLeft: "8px" }}>
                              • {item.skillsUsed.length} skill{item.skillsUsed.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(item.id);
                        }}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          borderRadius: "4px",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        title="Delete chat"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div style={{ ...styles.emptyState, justifyContent: "flex-start", paddingTop: "24px" }}>
              {/* Project Template Selector */}
              <div style={{ width: "100%", maxWidth: "600px", marginBottom: "24px" }}>
                <ChatProjectSelector
                  onSelectTemplate={setSelectedProjectTemplate}
                  selectedTemplateId={selectedProjectTemplate?.id || null}
                />
              </div>

              {/* Suggested prompts when template is selected */}
              {selectedProjectTemplate && (
                <div style={{ width: "100%", maxWidth: "600px", marginBottom: "24px" }}>
                  <SuggestedPrompts
                    prompts={getAvailableSuggestedPrompts()}
                    onSelectPrompt={handleSuggestedPrompt}
                    disabled={isLoading || totalKnowledgeSelected === 0}
                    title={`Suggested questions for ${selectedProjectTemplate.name}`}
                  />
                </div>
              )}

              {/* Welcome message and quick prompts - always show */}
              <div style={{ textAlign: "center" }}>
                {!selectedProjectTemplate && (
                  <>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>💬</div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>Start a Conversation</h3>
                    <p style={{ maxWidth: "400px", lineHeight: 1.6, margin: "0 auto" }}>
                      Choose a project template above for guided workflows, or ask questions directly.
                    </p>
                  </>
                )}

                {/* Quick prompt buttons - always visible */}
                <div style={{ marginTop: "24px" }}>
                  <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px" }}>
                    {selectedProjectTemplate ? "Or try a quick prompt:" : "Quick prompts:"}
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                    {prompts.slice(0, 4).map(prompt => {
                      const promptCat = getCategoryConfig(prompt.category);
                      const promptColor = promptCat?.color || { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
                      return (
                      <button
                        key={prompt.id}
                        onClick={() => applyPrompt(prompt)}
                        style={{
                          padding: "8px 12px",
                          fontSize: "12px",
                          backgroundColor: promptColor.bg,
                          color: promptColor.text,
                          border: `1px solid ${promptColor.border}`,
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        {prompt.title}
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <div key={message.id} style={styles.messageWrapper}>
                  <div
                    style={
                      message.role === "user"
                        ? styles.userMessage
                        : styles.assistantMessage
                    }
                  >
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {message.content}
                    </div>
                    {message.role === "assistant" && (
                      <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                        {message.skillsUsed && message.skillsUsed.length > 0 && message.skillsUsed.map(skill => (
                          <span key={skill.id} style={styles.skillsUsedBadge}>
                            📚 {skill.title}
                          </span>
                        ))}
                        {message.documentsUsed && message.documentsUsed.length > 0 && message.documentsUsed.map(doc => (
                          <span key={doc.id} style={{
                            ...styles.skillsUsedBadge,
                            backgroundColor: "#fef3c7",
                            color: "#d97706",
                          }}>
                            📄 {doc.title}
                          </span>
                        ))}
                        {message.urlsUsed && message.urlsUsed.length > 0 && message.urlsUsed.map(url => (
                          <span key={url.id} style={{
                            ...styles.skillsUsedBadge,
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                          }}>
                            🔗 {url.title}
                          </span>
                        ))}
                        {message.customersUsed && message.customersUsed.length > 0 && message.customersUsed.map(customer => (
                          <span key={customer.id} style={{
                            ...styles.skillsUsedBadge,
                            backgroundColor: "#f0fdf4",
                            color: "#166534",
                          }}>
                            🏢 {customer.name}
                          </span>
                        ))}
                        {message.transparency && (
                          <button
                            onClick={() => {
                              setSelectedTransparency(message.transparency!);
                              setShowTransparency(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #86efac",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            🔍 View Prompt
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginTop: "4px",
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}

              {/* Suggested follow-up prompts after conversation */}
              {selectedProjectTemplate && !isLoading && messages.length > 0 && getAvailableSuggestedPrompts().length > 0 && (
                <div style={{ marginTop: "8px", marginBottom: "16px" }}>
                  <SuggestedPrompts
                    prompts={getAvailableSuggestedPrompts().slice(0, 3)}
                    onSelectPrompt={handleSuggestedPrompt}
                    disabled={isLoading}
                    compact
                  />
                </div>
              )}

              {isLoading && (
                <div style={styles.messageWrapper}>
                  <div style={styles.assistantMessage}>
                    <div style={{ display: "flex", gap: "4px", padding: "4px 0" }}>
                      <span style={{ animation: "pulse 1.5s infinite", opacity: 0.6 }}>●</span>
                      <span style={{ animation: "pulse 1.5s infinite 0.3s", opacity: 0.6 }}>●</span>
                      <span style={{ animation: "pulse 1.5s infinite 0.6s", opacity: 0.6 }}>●</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {error && (
          <div style={{
            padding: "12px 24px",
            backgroundColor: "#fef2f2",
            borderTop: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "13px",
          }}>
            {error}
          </div>
        )}

        {/* Save Prompt Modal */}
        {showSavePrompt && (
          <div style={{
            padding: "12px 24px",
            backgroundColor: "#f0fdf4",
            borderTop: "1px solid #86efac",
          }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                value={newPromptTitle}
                onChange={e => setNewPromptTitle(e.target.value.slice(0, 200))}
                placeholder="Enter a name for this prompt..."
                maxLength={200}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #86efac",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
            <button
              onClick={handleSavePrompt}
              disabled={!newPromptTitle.trim()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: newPromptTitle.trim() ? "pointer" : "not-allowed",
                opacity: newPromptTitle.trim() ? 1 : 0.5,
              }}
            >
              Save
            </button>
            <button
              onClick={() => { setShowSavePrompt(false); setNewPromptTitle(""); }}
              style={{
                padding: "8px 12px",
                backgroundColor: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            </div>
            <div style={{
              marginTop: "4px",
              fontSize: "11px",
              color: newPromptTitle.length > 180 ? "#dc2626" : "#94a3b8",
              textAlign: "right",
            }}>
              {newPromptTitle.length} / 200
            </div>
          </div>
        )}

        <div style={styles.inputArea}>
          {/* Transparency status bar */}
          {selectedTransparency && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                padding: "8px 12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #86efac",
              }}
            >
              <span style={{ fontSize: "12px", color: "#166534" }}>
                Last prompt used: {selectedTransparency.model} • {selectedTransparency.knowledgeContext.length.toLocaleString()} chars of context
              </span>
              <button
                onClick={() => setShowTransparency(true)}
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                View Full Prompt
              </button>
            </div>
          )}
          <div style={{ position: "relative" }}>
            <div style={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value.slice(0, 10000))}
                onKeyDown={handleKeyDown}
                placeholder={
                  totalKnowledgeSelected === 0
                    ? "Select at least one knowledge item to start chatting..."
                    : "Ask a question about your knowledge base..."
                }
                disabled={isLoading || totalKnowledgeSelected === 0}
                style={{
                  ...styles.textarea,
                  opacity: totalKnowledgeSelected === 0 ? 0.6 : 1,
                }}
                maxLength={10000}
              />
            {inputValue.trim() && !showSavePrompt && (
              <button
                onClick={() => setShowSavePrompt(true)}
                style={{
                  padding: "12px",
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
                title="Save as prompt"
              >
                💾
              </button>
            )}
            <button
              onClick={() => {
                setSelectedTransparency(getPreviewPrompt());
                setShowPreviewPrompt(true);
              }}
              disabled={totalKnowledgeSelected === 0}
              style={{
                padding: "12px 16px",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: "1px solid #86efac",
                borderRadius: "12px",
                fontWeight: 500,
                cursor: totalKnowledgeSelected === 0 ? "not-allowed" : "pointer",
                opacity: totalKnowledgeSelected === 0 ? 0.5 : 1,
                fontSize: "13px",
              }}
              title="Preview the system prompt that will be sent"
            >
              Preview Prompt
            </button>
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading || totalKnowledgeSelected === 0}
              style={{
                ...styles.sendButton,
                opacity: !inputValue.trim() || isLoading || totalKnowledgeSelected === 0 ? 0.5 : 1,
                cursor: !inputValue.trim() || isLoading || totalKnowledgeSelected === 0 ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "4px",
              fontSize: "11px",
              color: inputValue.length > 9000 ? "#dc2626" : "#94a3b8",
            }}>
              {inputValue.length.toLocaleString()} / 10,000
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Modal (for both preview and post-response) */}
      {(showTransparency || showPreviewPrompt) && selectedTransparency && (
        <TransparencyModal
          title={showPreviewPrompt ? "System Prompt Preview" : "Prompt Transparency"}
          subtitle={showPreviewPrompt
            ? "This is the system prompt that will be sent with your message"
            : "See exactly what was sent to the AI model"}
          onClose={() => { setShowTransparency(false); setShowPreviewPrompt(false); }}
          configs={[
            { label: "MODEL", value: selectedTransparency.model, color: "blue" },
            { label: "MAX TOKENS", value: selectedTransparency.maxTokens, color: "yellow" },
            { label: "TEMPERATURE", value: selectedTransparency.temperature, color: "green" },
          ]}
          systemPrompt={selectedTransparency.baseSystemPrompt || selectedTransparency.systemPrompt}
          userPrompt={selectedTransparency.knowledgeContext}
          userPromptLabel="Knowledge Context (appended to system prompt)"
          userPromptNote={`Total knowledge context: ${selectedTransparency.knowledgeContext.length.toLocaleString()} characters`}
        />
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#64748b",
      }}>
        Loading chat...
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
