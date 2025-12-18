"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { History, Plus, Eye, MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { useChatStore, ChatMessage } from "@/stores/chat-store";
import { useSelectionStore } from "@/stores/selection-store";
import {
  useSkills,
  useDocuments,
  useReferenceUrls,
  useCustomerProfiles,
  useChatSessions,
  useSendMessage,
  useSaveSession,
  ChatSessionItem,
} from "@/hooks/use-chat-data";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { ChatHistoryPanel } from "@/components/chat/chat-history-panel";
import { TransparencyModal, TransparencyData } from "@/components/chat/transparency-modal";
import { ChatFeedbackModal } from "@/components/chat/chat-feedback-modal";
import { ContextControlsBar, InstructionPreset } from "./components/context-controls-bar";
import { CollapsibleKnowledgeSidebar } from "./components/collapsible-knowledge-sidebar";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";
import { CLAUDE_MODEL } from "@/lib/config";
import { getDefaultPrompt } from "@/lib/promptBlocks";
import { parseAnswerSections } from "@/lib/questionHelpers";

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

  // V2 specific state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [focusedCustomerId, setFocusedCustomerId] = useState<string | null>(null);

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
  } = useChatStore();

  const {
    initializeSelections,
    getSelectedSkillIds,
    getSelectedDocumentIds,
    getSelectedUrlIds,
    getSelectedCustomerIds,
    setCustomerSelected,
  } = useSelectionStore();

  // React Query data fetching
  const { data: skills = [], isLoading: skillsLoading } = useSkills();
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

    // Build system prompt
    const blockSystemPrompt = getDefaultPrompt("chat");
    const baseSystemPrompt = userInstructions
      ? `${blockSystemPrompt}\n\n## User Instructions\n${userInstructions}`
      : blockSystemPrompt;

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
  }, [skills, documents, urls, customers, userInstructions, getSelectedSkillIds, getSelectedDocumentIds, getSelectedUrlIds, getSelectedCustomerIds]);

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

      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendMessageMutation.mutateAsync({
        message: messageContent,
        skills: selectedSkills,
        customerProfiles: selectedCustomers,
        documentIds: selectedDocIds,
        referenceUrls: selectedUrls,
        conversationHistory,
        userInstructions,
        quickMode,
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
  };

  const handleLoadSession = (sessionItem: ChatSessionItem) => {
    const loadedMessages: ChatMessage[] = (sessionItem.messages || []).map((m, idx) => ({
      id: `loaded-${idx}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
    setMessages(loadedMessages);
    setCurrentSessionId(sessionItem.id);
    setShowHistory(false);
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

  const handleViewTransparency = (_message: ChatMessage) => {
    const data = lastTransparency || buildTransparencyData();
    setTransparencyData(data);
    setShowTransparency(true);
  };

  const handlePreviewPrompt = () => {
    setTransparencyData(buildTransparencyData());
    setShowTransparency(true);
  };

  const isDataLoading = skillsLoading || documentsLoading || urlsLoading || customersLoading;
  const totalSelected = getSelectedSkillIds().length + getSelectedDocumentIds().length +
                        getSelectedUrlIds().length + getSelectedCustomerIds().length;

  const focusedCustomer = customers.find((c) => c.id === focusedCustomerId) || null;

  return (
    <div ref={containerRef} className="flex h-screen overflow-hidden bg-background">
      {/* Left - Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Page Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Knowledge Chat</h1>
          </div>
          <a
            href="/collateral"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Need to build slides or collateral? →
          </a>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviewPrompt}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              System Prompt
            </Button>
            {lastTransparency && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTransparencyData(lastTransparency);
                  setShowTransparency(true);
                }}
                className="gap-2 text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
              >
                <Eye className="h-4 w-4" />
                View Last Prompt
              </Button>
            )}
          </div>
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
            {messages.length > 0 && (
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

        {/* Combined Persona + Customer Controls */}
        <ContextControlsBar
          selectedPresetId={selectedPresetId}
          onPresetChange={handlePresetChange}
          userInstructions={userInstructions}
          onUserInstructionsChange={setUserInstructions}
          customers={customers}
          selectedCustomerId={focusedCustomerId}
          onCustomerSelect={handleCustomerFocusChange}
          customersLoading={customersLoading}
        />

        {/* Messages */}
        <div className="relative flex-1 min-h-0">
          <MessageList
            messages={messages}
            onViewTransparency={handleViewTransparency}
          />

          {/* Chat History Panel */}
          {showHistory && session?.user && (
            <ChatHistoryPanel
              sessions={chatSessions}
              currentSessionId={currentSessionId}
              isLoading={sessionsLoading}
              onLoadSession={handleLoadSession}
              onDeleteSession={handleDeleteSession}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border">
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
          />
        </div>
      </div>

      {/* Resizable Divider */}
      <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

      {/* Right - Context Sidebar (full height) */}
      <div
        style={{
          width: `${sidebarWidth}px`,
          minWidth: `${sidebarMinWidth}px`,
          maxWidth: `${sidebarMaxWidth}px`,
        }}
        className="flex-shrink-0 flex flex-col h-full"
      >
        <CollapsibleKnowledgeSidebar
          skills={skills}
          documents={documents}
          urls={urls}
          customers={customers}
          selectedCustomer={focusedCustomer}
          isLoading={isDataLoading}
        />
      </div>

      {/* Transparency Modal */}
      {transparencyData && (
        <TransparencyModal
          open={showTransparency}
          onClose={() => setShowTransparency(false)}
          data={transparencyData}
          isPreview={!lastTransparency}
        />
      )}

      {/* Chat Feedback Modal */}
      <ChatFeedbackModal
        isOpen={showFeedback}
        sessionId={currentSessionId}
        messageCount={messages.length}
        onClose={() => setShowFeedback(false)}
        onSubmitAndNewChat={() => {
          setShowFeedback(false);
          handleNewChat();
        }}
      />
    </div>
  );
}
