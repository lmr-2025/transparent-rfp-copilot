"use client";

import { useEffect, useCallback, useState, useRef, useMemo, lazy, Suspense } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { History, Plus, MessageSquareOff, Eye, Scissors, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { useChatStore, ChatMessage } from "@/stores/chat-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useSkills, useDocuments, useReferenceUrls, useCustomerProfiles } from "@/hooks/use-knowledge";
import {
  useChatSessions,
  useSendMessage,
  useSaveSession,
  ChatSessionItem,
} from "@/hooks/use-chat";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { ChatHistoryPanel } from "@/components/chat/chat-history-panel";
import { TransparencyData } from "@/components/chat/transparency-modal";
import { ChatFeedbackModal } from "@/components/chat/chat-feedback-modal";
import { ContextControlsBar, InstructionPreset } from "./components/context-controls-bar";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";

// Lazy load heavy components to reduce initial bundle size
const TransparencyModal = lazy(() => import("@/components/chat/transparency-modal").then(m => ({ default: m.TransparencyModal })));
const CollapsibleKnowledgeSidebar = lazy(() => import("./components/collapsible-knowledge-sidebar").then(m => ({ default: m.CollapsibleKnowledgeSidebar })));
const DetectedUrlsPanel = lazy(() => import("@/components/chat/detected-urls-panel").then(m => ({ default: m.DetectedUrlsPanel })));
import { CLAUDE_MODEL } from "@/lib/config";
import { getDefaultPrompt } from "@/lib/promptBlocks";
import { parseAnswerSections } from "@/lib/questionHelpers";
import { estimateTokens, formatTokenCount, TOKEN_LIMITS } from "@/lib/tokenUtils";

// Sidebar resize constants
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 340;

export default function ChatV2Page() {
  const { data: session } = useSession();

  // Local state for modals
  const [showHistory, setShowHistory] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [transparencyData, setTransparencyData] = useState<TransparencyData | null>(null);
  const [lastTransparency, setLastTransparency] = useState<TransparencyData | null>(null);
  // Quick mode for faster LLM responses (Haiku vs Sonnet)
  const [quickMode, setQuickMode] = useState(false);
  // Call mode for concise, rapid-fire responses during live calls
  const [callMode, setCallMode] = useState(false);

  // V2 specific state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);
  const [focusedCustomerId, setFocusedCustomerId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Detected URLs staging area
  type DetectedUrl = { url: string; title: string; detectedInMessageId: string; timestamp: Date };
  const [detectedUrls, setDetectedUrls] = useState<DetectedUrl[]>([]);

  // Zustand stores
  const {
    messages,
    isLoading,
    inputValue,
    currentSessionId,
    userInstructions,
    setMessages,
    addMessage,
    setIsLoading,
    setInputValue,
    setCurrentSessionId,
    setUserInstructions,
    clearChat,
    trimMessages,
  } = useChatStore();

  const {
    initializeSelections,
    getSelectedSkillIds,
    getSelectedDocumentIds,
    getSelectedUrlIds,
    getSelectedCustomerIds,
    setCustomerSelected,
  } = useSelectionStore();

  // React Query data fetching - only show active skills in chat
  const { data: skillsData, isLoading: skillsLoading } = useSkills({ activeOnly: true });
  const skills = skillsData?.skills || [];
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();
  const { data: urls = [], isLoading: urlsLoading } = useReferenceUrls();
  const { data: customers = [], isLoading: customersLoading } = useCustomerProfiles();
  const { data: chatSessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useChatSessions();

  // Mutations
  const sendMessageMutation = useSendMessage();
  const saveSessionMutation = useSaveSession();

  // Track if selections have been initialized to prevent infinite loops
  const selectionsInitialized = useRef(false);

  // Resizable sidebar
  const {
    panelWidth: sidebarWidth,
    isDragging,
    containerRef,
    handleMouseDown,
    minWidth: sidebarMinWidth,
    maxWidth: sidebarMaxWidth,
  } = useResizablePanel({
    storageKey: "chat-v2-sidebar-width",
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
  });

  // Initialize selections when data loads (only once)
  useEffect(() => {
    if (selectionsInitialized.current) return;
    if (skills.length || documents.length || urls.length || customers.length) {
      selectionsInitialized.current = true;
      initializeSelections(
        skills.map((s) => s.id),
        documents.map((d) => d.id),
        urls.map((u) => u.id),
        customers.map((c) => c.id)
      );
    }
  }, [skills, documents, urls, customers, initializeSelections]);

  // Load user instructions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_INSTRUCTIONS);
    setUserInstructions(stored || DEFAULTS.USER_INSTRUCTIONS);
  }, [setUserInstructions]);

  // Load session from query parameter if provided (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return; // Skip during SSR

    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get("session");
    if (sessionIdParam && chatSessions.length > 0) {
      const sessionToLoad = chatSessions.find(s => s.id === sessionIdParam);
      if (sessionToLoad) {
        handleLoadSession(sessionToLoad);
        // Clean up URL after loading
        window.history.replaceState({}, "", "/chat-v2");
      }
    }
  }, [chatSessions]); // Only run when sessions change

  // Handle customer focus change - auto-select/deselect in knowledge context
  const handleCustomerFocusChange = useCallback((customerId: string | null) => {
    // Deselect previous focused customer
    if (focusedCustomerId) {
      setCustomerSelected(focusedCustomerId, false);
    }
    // Select new focused customer
    if (customerId) {
      setCustomerSelected(customerId, true);
    }
    setFocusedCustomerId(customerId);
  }, [focusedCustomerId, setCustomerSelected]);

  // Handle persona change
  const handlePresetChange = useCallback((preset: InstructionPreset | null) => {
    setSelectedPresetId(preset?.id || null);
    setSelectedPresetName(preset?.name || null);
  }, []);

  // Build transparency data for preview or post-response
  const buildTransparencyData = useCallback((): TransparencyData => {
    const selectedSkillIds = getSelectedSkillIds();
    const selectedDocIds = getSelectedDocumentIds();
    const selectedUrlIds = getSelectedUrlIds();
    const selectedCustomerIds = getSelectedCustomerIds();

    // Build skill context
    const selectedSkills = skills.filter((s) => selectedSkillIds.includes(s.id));
    const knowledgeContext = selectedSkills.length > 0
      ? selectedSkills.map((skill, idx) =>
          `=== SKILL ${idx + 1}: ${skill.title} ===\n\n${skill.content}`
        ).join("\n\n---\n\n")
      : "";

    // Build document context
    const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));
    const documentContext = selectedDocs.length > 0
      ? selectedDocs.map((doc, idx) =>
          `=== DOCUMENT ${idx + 1}: ${doc.title} ===\nFilename: ${doc.filename}\n\n[Content loaded from database]`
        ).join("\n\n---\n\n")
      : "";

    // Build URL context
    const selectedUrls = urls.filter((u) => selectedUrlIds.includes(u.id));
    const urlContext = selectedUrls.length > 0
      ? selectedUrls.map((url, idx) =>
          `=== REFERENCE URL ${idx + 1}: ${url.title} ===\nURL: ${url.url}`
        ).join("\n\n---\n\n")
      : "";

    // Build customer context
    const selectedCustomers = customers.filter((c) => selectedCustomerIds.includes(c.id));
    const customerContext = selectedCustomers.length > 0
      ? selectedCustomers.map((profile) => {
          const keyFactsText = profile.keyFacts && profile.keyFacts.length > 0
            ? `Key Facts:\n${profile.keyFacts.map((f: { label: string; value: string }) => `  - ${f.label}: ${f.value}`).join("\n")}`
            : "";
          return `=== CUSTOMER PROFILE: ${profile.name} ===
Industry: ${profile.industry || "Not specified"}
Region: ${profile.region || "Not specified"}
Tier: ${profile.tier || "Not specified"}

Overview:
${profile.overview || "Not provided"}
${profile.products ? `\nProducts & Services:\n${profile.products}` : ""}
${profile.challenges ? `\nChallenges & Needs:\n${profile.challenges}` : ""}
${keyFactsText}`;
        }).join("\n\n---\n\n")
      : "";

    // Build system prompt preview - mirrors API structure
    const blockSystemPrompt = getDefaultPrompt("chat");
    let baseSystemPrompt = userInstructions
      ? `${blockSystemPrompt}\n\n## User Instructions\n${userInstructions}`
      : blockSystemPrompt;

    // Call mode appears at the very end (after knowledge context in full prompt)
    // For preview, we append it to show it will be included
    if (callMode) {
      baseSystemPrompt += `\n\n## CRITICAL: LIVE CALL MODE ACTIVE\n[Call mode instructions will appear here, after all knowledge context]`;
    }

    return {
      systemPrompt: baseSystemPrompt,
      baseSystemPrompt,
      knowledgeContext,
      customerContext: customerContext || undefined,
      documentContext: documentContext || undefined,
      urlContext: urlContext || undefined,
      model: CLAUDE_MODEL,
      maxTokens: 4000,
      temperature: 0.3,
    };
  }, [skills, documents, urls, customers, userInstructions, callMode, getSelectedSkillIds, getSelectedDocumentIds, getSelectedUrlIds, getSelectedCustomerIds]);

  // Detect URLs in a message
  const detectUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches || [];
  };

  // Handle sending a message
  const handleSend = useCallback(async () => {
    const messageContent = inputValue.trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInputValue("");
    setIsLoading(true);

    try {
      // Detect URLs in the message for ephemeral fetching
      const detectedUrlStrings = detectUrls(messageContent);
      let ephemeralUrls: { url: string; title: string; content: string }[] = [];

      // Fetch content from detected URLs
      if (detectedUrlStrings.length > 0) {
        const fetchPromises = detectedUrlStrings.map(async (url) => {
          try {
            const res = await fetch("/api/fetch-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            });
            if (res.ok) {
              const data = await res.json();
              return {
                url,
                title: data.data?.title || url,
                content: data.data?.content || "",
              };
            }
          } catch (err) {
            console.warn(`Failed to fetch URL ${url}:`, err);
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        ephemeralUrls = results.filter((r) => r !== null) as { url: string; title: string; content: string }[];

        // Add successfully fetched URLs to the staging area (if not already there)
        const newDetectedUrls = ephemeralUrls
          .filter(eu => !detectedUrls.some(du => du.url === eu.url))
          .map(eu => ({
            url: eu.url,
            title: eu.title,
            detectedInMessageId: userMessage.id,
            timestamp: new Date(),
          }));
        if (newDetectedUrls.length > 0) {
          setDetectedUrls(prev => [...prev, ...newDetectedUrls]);
        }
      }

      // Get selected items
      const selectedSkillIds = getSelectedSkillIds();
      const selectedDocIds = getSelectedDocumentIds();
      const selectedUrlIds = getSelectedUrlIds();
      const selectedCustomerIds = getSelectedCustomerIds();

      // Build request payload
      const selectedSkills = skills
        .filter((s) => selectedSkillIds.includes(s.id))
        .map((s) => ({
          id: s.id,
          title: s.title,
          content: s.content,
          sourceUrls: s.sourceUrls || [],
        }));

      const selectedCustomers = customers
        .filter((c) => selectedCustomerIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          industry: c.industry || undefined,
          overview: c.overview,
          products: c.products || undefined,
          challenges: c.challenges || undefined,
          keyFacts: c.keyFacts,
        }));

      const selectedUrls = urls
        .filter((u) => selectedUrlIds.includes(u.id))
        .map((u) => ({
          id: u.id,
          url: u.url,
          title: u.title,
        }));

      // Combine selected URLs with ephemeral URLs (include content for ephemeral ones)
      const allUrls = [
        ...selectedUrls,
        ...ephemeralUrls.map((eu) => ({
          id: `ephemeral-${crypto.randomUUID()}`,
          url: eu.url,
          title: eu.title,
          content: eu.content, // Include fetched content for ephemeral URLs
        })),
      ];

      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendMessageMutation.mutateAsync({
        message: messageContent,
        skills: selectedSkills,
        customerProfiles: selectedCustomers,
        documentIds: selectedDocIds,
        referenceUrls: allUrls,
        conversationHistory,
        userInstructions,
        quickMode,
        callMode, // Send as separate flag - API handles positioning at end of prompt
      });

      // Parse the response to extract transparency metadata
      const parsed = parseAnswerSections(response.response);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: parsed.response || response.response,
        timestamp: new Date(),
        skillsUsed: response.skillsUsed,
        customersUsed: response.customersUsed,
        documentsUsed: response.documentsUsed,
        urlsUsed: response.urlsUsed,
        ...(parsed.confidence && { confidence: parsed.confidence }),
        ...(parsed.sources && { sources: parsed.sources }),
        ...(parsed.reasoning && { reasoning: parsed.reasoning }),
        ...(parsed.inference && { inference: parsed.inference }),
        ...(parsed.remarks && { remarks: parsed.remarks }),
        ...(parsed.notes && { notes: parsed.notes }),
      };

      addMessage(assistantMessage);

      // Store transparency data for this response
      if (response.transparency) {
        setLastTransparency(response.transparency);
      } else {
        setLastTransparency(buildTransparencyData());
      }

      // Save session in background
      const allMessages = [...messages, userMessage, assistantMessage];
      const result = await saveSessionMutation.mutateAsync({
        sessionId: currentSessionId,
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          confidence: m.confidence,
          notes: m.notes,
        })),
        skillsUsed: response.skillsUsed || [],
        documentsUsed: response.documentsUsed || [],
        customersUsed: response.customersUsed || [],
        urlsUsed: response.urlsUsed || [],
      });

      // Update session ID if this was a new session
      if (!currentSessionId && result.id) {
        setCurrentSessionId(result.id);
      }

      // Refetch sessions to update the list
      refetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [
    inputValue,
    isLoading,
    messages,
    skills,
    customers,
    urls,
    userInstructions,
    currentSessionId,
    quickMode,
    callMode,
    addMessage,
    setInputValue,
    setIsLoading,
    setCurrentSessionId,
    getSelectedSkillIds,
    getSelectedDocumentIds,
    getSelectedUrlIds,
    getSelectedCustomerIds,
    sendMessageMutation,
    saveSessionMutation,
    buildTransparencyData,
    refetchSessions,
  ]);

  const handleNewChat = () => {
    clearChat();
    setCurrentSessionId(null);
    setShowHistory(false);
    setLastTransparency(null);
    setFeedbackSubmitted(false);
    // Optionally clear detected URLs when starting new chat
    // setDetectedUrls([]);
  };

  // Handle adding detected URLs to knowledge base
  const handleAddUrlsToKnowledge = useCallback(async (urlsToAdd: string[]) => {
    try {
      // Call API to add URLs as reference URLs in knowledge base
      const promises = urlsToAdd.map(async (url) => {
        const res = await fetch("/api/reference-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error(`Failed to add ${url}`);
      });
      await Promise.all(promises);
      toast.success(`Added ${urlsToAdd.length} URL(s) to knowledge base`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add URLs");
      throw err;
    }
  }, []);

  // Handle adding detected URLs to customer profile
  const handleAddUrlsToCustomer = useCallback(async (urlsToAdd: string[], customerId: string) => {
    try {
      // Call API to add URLs as documents to customer profile
      const promises = urlsToAdd.map(async (url) => {
        // First fetch the URL content
        const fetchRes = await fetch("/api/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!fetchRes.ok) throw new Error(`Failed to fetch ${url}`);
        const fetchData = await fetchRes.json();

        // Then create a customer document
        const docRes = await fetch(`/api/customers/${customerId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: fetchData.data?.title || url,
            content: fetchData.data?.content || "",
            docType: "url",
            url,
          }),
        });
        if (!docRes.ok) throw new Error(`Failed to add ${url} to customer`);
      });
      await Promise.all(promises);
      toast.success(`Added ${urlsToAdd.length} URL(s) to customer profile`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add URLs to customer");
      throw err;
    }
  }, []);

  const handleLoadSession = async (sessionItem: ChatSessionItem) => {
    const loadedMessages: ChatMessage[] = (sessionItem.messages || []).map((m, idx) => ({
      id: `loaded-${idx}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      confidence: m.confidence,
      notes: m.notes,
    }));
    setMessages(loadedMessages);
    setCurrentSessionId(sessionItem.id);
    setShowHistory(false);

    // Check if feedback already exists for this session
    try {
      const res = await fetch(`/api/chat/feedback?sessionId=${sessionItem.id}`);
      if (res.ok) {
        const data = await res.json();
        const hasFeedback = data.data?.feedbacks?.length > 0;
        setFeedbackSubmitted(hasFeedback);
      }
    } catch (err) {
      console.warn("Failed to check feedback status:", err);
      setFeedbackSubmitted(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      const response = await fetch(`/api/chat-sessions/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        refetchSessions();
        if (currentSessionId === id) {
          handleNewChat();
        }
      }
    } catch {
      toast.error("Failed to delete session");
    }
  };

  const handleViewTransparency = () => {
    const data = lastTransparency || buildTransparencyData();
    setTransparencyData(data);
    setShowTransparency(true);
  };

  // Compact history - keep last 10 messages
  const handleCompactHistory = useCallback(() => {
    const keepCount = 10;
    const removed = trimMessages(keepCount);
    if (removed > 0) {
      toast.success(`Removed ${removed} older messages to free up context`);
    }
  }, [trimMessages]);

  const handlePreviewPrompt = () => {
    setTransparencyData(buildTransparencyData());
    setShowTransparency(true);
  };

  // Handle customize knowledge click - expand sidebar if collapsed
  const handleCustomizeKnowledge = useCallback(() => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
  }, [sidebarCollapsed]);

  const isDataLoading = skillsLoading || documentsLoading || urlsLoading || customersLoading;
  const totalSelected = getSelectedSkillIds().length + getSelectedDocumentIds().length +
                        getSelectedUrlIds().length + getSelectedCustomerIds().length;

  const focusedCustomer = customers.find((c) => c.id === focusedCustomerId) || null;

  // Estimate token usage for current conversation
  const tokenEstimate = useMemo(() => {
    // Conversation history tokens
    const historyText = messages.map(m => m.content).join(" ");
    const historyTokens = estimateTokens(historyText);

    // Selected knowledge context tokens (rough estimate based on content length)
    const selectedSkillIds = getSelectedSkillIds();
    const selectedDocIds = getSelectedDocumentIds();
    const selectedCustomerIds = getSelectedCustomerIds();

    const skillsText = skills
      .filter(s => selectedSkillIds.includes(s.id))
      .map(s => s.content)
      .join(" ");
    const skillTokens = estimateTokens(skillsText);

    // Documents - we don't have content loaded, estimate per doc
    const docTokens = selectedDocIds.length * TOKEN_LIMITS.DOC_ESTIMATE;

    // Customers - estimate per profile
    const customerTokens = selectedCustomerIds.length * TOKEN_LIMITS.CUSTOMER_ESTIMATE;

    // System prompt base + user instructions
    const systemTokens = TOKEN_LIMITS.SYSTEM_PROMPT_BASE + estimateTokens(userInstructions);

    const totalTokens = historyTokens + skillTokens + docTokens + customerTokens + systemTokens;

    // Claude's context window is ~200k tokens, but we use a practical limit
    const maxTokens = TOKEN_LIMITS.CHAT_MAX;
    const usagePercent = Math.min(100, Math.round((totalTokens / maxTokens) * 100));

    return {
      total: totalTokens,
      history: historyTokens,
      context: skillTokens + docTokens + customerTokens,
      maxTokens,
      usagePercent,
      isHigh: usagePercent > 70,
      isCritical: usagePercent > 90,
    };
  }, [messages, skills, userInstructions, getSelectedSkillIds, getSelectedDocumentIds, getSelectedCustomerIds]);

  return (
    <div ref={containerRef} className="flex overflow-hidden bg-background" style={{ height: "100dvh", minHeight: "100vh" }}>
      {/* Left - Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <h1 className="text-lg font-semibold">Knowledge Chat</h1>
          <div className="flex items-center gap-2">
            {session?.user && (
              <Button
                variant={showHistory ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                History ({chatSessions.length})
              </Button>
            )}
            {messages.length > 0 && !feedbackSubmitted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeedback(true)}
                className="gap-2"
              >
                <MessageSquareOff className="h-4 w-4" />
                End Chat
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleNewChat} className="gap-2">
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Controls Bar */}
        <ContextControlsBar
          selectedPresetId={selectedPresetId}
          onPresetChange={handlePresetChange}
          userInstructions={userInstructions}
          onUserInstructionsChange={setUserInstructions}
          callMode={callMode}
          onCallModeChange={setCallMode}
          customers={customers}
          selectedCustomerId={focusedCustomerId}
          onCustomerSelect={handleCustomerFocusChange}
          customersLoading={customersLoading}
          skills={skills.map(s => ({ id: s.id, categories: s.categories || [] }))}
          onSkillsAutoSelected={(count, categories) => {
            if (count > 0) {
              toast.success(`Auto-selected ${count} skills from categories: ${categories.join(", ")}`);
            }
          }}
        />

        {/* Messages */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <MessageList
            messages={messages}
            onViewTransparency={handleViewTransparency}
          />

          {/* Chat History Panel - positioned inside relative container */}
          {showHistory && session?.user && (
            <div className="absolute top-2 right-2 z-50 w-96">
              <ChatHistoryPanel
                sessions={chatSessions}
                currentSessionId={currentSessionId}
                isLoading={sessionsLoading}
                onLoadSession={handleLoadSession}
                onDeleteSession={handleDeleteSession}
                onClose={() => setShowHistory(false)}
              />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          isLoading={isLoading}
          placeholder={
            totalSelected === 0
              ? "Select at least one knowledge item to start chatting..."
              : "Type your message..."
          }
          quickMode={quickMode}
          onQuickModeChange={setQuickMode}
          leftContent={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Context: {getSelectedSkillIds().length} skills, {getSelectedDocumentIds().length} docs, {(() => {
                  const refUrlCount = getSelectedUrlIds().length;
                  const selectedSkills = skills.filter((s) => getSelectedSkillIds().includes(s.id));
                  const skillSourceUrlCount = selectedSkills.reduce((count, skill) => count + (skill.sourceUrls?.length || 0), 0);
                  const totalUrls = refUrlCount + skillSourceUrlCount;
                  return `${totalUrls} URL${totalUrls !== 1 ? 's' : ''}`;
                })()} {(() => {
                  const refUrlCount = getSelectedUrlIds().length;
                  const selectedSkills = skills.filter((s) => getSelectedSkillIds().includes(s.id));
                  const skillSourceUrlCount = selectedSkills.reduce((count, skill) => count + (skill.sourceUrls?.length || 0), 0);
                  if (refUrlCount > 0 && skillSourceUrlCount > 0) return `(${refUrlCount} ref + ${skillSourceUrlCount} skill)`;
                  if (skillSourceUrlCount > 0) return `(${skillSourceUrlCount} from skills)`;
                  return '';
                })()}
              </span>
              <button
                onClick={handleCustomizeKnowledge}
                className="text-primary hover:underline flex items-center gap-1"
              >
                <Settings2 className="h-3 w-3" />
                Customize
              </button>
              {focusedCustomer && (
                <span className="text-primary">
                  Customer: {focusedCustomer.name}
                </span>
              )}
              <span className={tokenEstimate.isCritical ? "text-red-500 font-medium" : tokenEstimate.isHigh ? "text-amber-500" : ""}>
                Tokens: ~{formatTokenCount(tokenEstimate.total)} / {formatTokenCount(tokenEstimate.maxTokens)} ({tokenEstimate.usagePercent}%)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCompactHistory}
                disabled={tokenEstimate.history <= TOKEN_LIMITS.COMPACT_THRESHOLD || messages.length <= 10}
                className="gap-1 h-6 px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Scissors className="h-3 w-3" />
                Compact
              </Button>
            </div>
          }
          rightContent={
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviewPrompt}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview prompt
            </Button>
          }
        />
      </div>

      {/* Resizable Divider - hidden when collapsed */}
      {!sidebarCollapsed && (
        <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />
      )}

      {/* Right - Context Sidebar (full height) */}
      <div
        style={{
          width: sidebarCollapsed ? '48px' : `${sidebarWidth}px`,
          minWidth: sidebarCollapsed ? '48px' : `${sidebarMinWidth}px`,
          maxWidth: sidebarCollapsed ? '48px' : `${sidebarMaxWidth}px`,
        }}
        className="flex-shrink-0 flex flex-col h-full transition-all duration-200 overflow-y-auto"
      >
        {/* Detected URLs Staging Area */}
        {!sidebarCollapsed && detectedUrls.length > 0 && (
          <div className="p-4 border-b">
            <Suspense fallback={null}>
              <DetectedUrlsPanel
                urls={detectedUrls}
                focusedCustomerId={focusedCustomerId}
                focusedCustomerName={focusedCustomer?.name || null}
                onAddToKnowledge={handleAddUrlsToKnowledge}
                onAddToCustomer={handleAddUrlsToCustomer}
                onRemove={(url) => setDetectedUrls(prev => prev.filter(u => u.url !== url))}
                onClear={() => setDetectedUrls([])}
              />
            </Suspense>
          </div>
        )}

        <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400">Loading...</div>}>
          <CollapsibleKnowledgeSidebar
            skills={skills}
            documents={documents}
            urls={urls}
            selectedCustomer={focusedCustomer}
            selectedPersonaName={selectedPresetName}
            isLoading={isDataLoading}
            isCollapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            onCustomizeKnowledge={handleCustomizeKnowledge}
          />
        </Suspense>
      </div>

      {/* Transparency Modal */}
      {transparencyData && (
        <Suspense fallback={null}>
          <TransparencyModal
            open={showTransparency}
            onClose={() => setShowTransparency(false)}
            data={transparencyData}
            isPreview={!lastTransparency}
          />
        </Suspense>
      )}

      {/* Chat Feedback Modal */}
      <ChatFeedbackModal
        isOpen={showFeedback}
        sessionId={currentSessionId}
        messageCount={messages.length}
        onClose={() => setShowFeedback(false)}
        onSubmitAndNewChat={() => {
          setShowFeedback(false);
          setFeedbackSubmitted(true);
          handleNewChat();
        }}
      />
    </div>
  );
}
