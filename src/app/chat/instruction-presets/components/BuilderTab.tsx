"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Zap } from "lucide-react";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { ConversationalPanel, Message } from "@/components/ui/conversational-panel";
import { useApiMutation } from "@/hooks/use-api";
import BuilderPreviewPanel, { PresetDraft } from "./BuilderPreviewPanel";

// Resizable panel constraints
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 400;

const STARTER_TEMPLATES = [
  {
    id: "security",
    label: "Security & Compliance Expert",
    description: "For sales calls, security questionnaires",
    prompt: "I want to create a Security & Compliance Expert assistant that helps our sales team answer customer security questions during calls. It should know about our security posture, certifications, and compliance frameworks.",
  },
  {
    id: "sales",
    label: "Sales Support Assistant",
    description: "Product knowledge, objection handling",
    prompt: "I want to create a Sales Support Assistant that helps our team with product knowledge, feature explanations, and handling common objections during customer conversations.",
  },
  {
    id: "technical",
    label: "Technical Documentation Writer",
    description: "Clear explanations, documentation style",
    prompt: "I want to create a Technical Documentation Writer assistant that helps create clear, well-structured technical documentation and explanations for our products.",
  },
];

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: `Hi! I'm here to help you create a custom AI assistant persona.

What kind of assistant would you like to build? You can pick a template to get started, or describe your own:`,
};

type BuilderTabProps = {
  onPresetSaved: () => void;
};

type SavePresetInput = {
  name: string;
  description: string;
  content: string;
  requestShare: boolean;
};

export default function BuilderTab({ onPresetSaved }: BuilderTabProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState<PresetDraft>({ name: "", description: "", content: "" });
  const [error, setError] = useState<string | null>(null);
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>("");
  const [builderSystemPrompt, setBuilderSystemPrompt] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Resizable panel
  const {
    panelWidth,
    isDragging,
    containerRef,
    handleMouseDown,
    minWidth: panelMinWidth,
    maxWidth: panelMaxWidth,
  } = useResizablePanel({
    storageKey: "instruction-builder-panel-width",
    defaultWidth: DEFAULT_PANEL_WIDTH,
    minWidth: MIN_PANEL_WIDTH,
    maxWidth: MAX_PANEL_WIDTH,
  });

  // Fetch system prompts on mount for transparency
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const res = await fetch("/api/instruction-presets/build");
        if (res.ok) {
          const data = await res.json();
          const builderPrompt = data.data?.builderSystemPrompt || data.builderSystemPrompt;
          const chatPrompt = data.data?.chatSystemPrompt || data.chatSystemPrompt;
          if (builderPrompt) setBuilderSystemPrompt(builderPrompt);
          if (chatPrompt) setChatSystemPrompt(chatPrompt);
        }
      } catch {
        // Silently fail - prompts will be fetched on first message if this fails
      }
    };
    fetchPrompts();
  }, []);

  // Save preset mutation
  const savePresetMutation = useApiMutation<void, SavePresetInput>({
    url: "/api/instruction-presets",
    method: "POST",
    invalidateKeys: [["instruction-presets"]],
    onSuccess: () => {
      // Success - reset and notify
      setMessages([{
        role: "assistant",
        content: `Great! Your "${draft.name}" preset has been saved and submitted for approval. You can find it in the Presets tab.\n\nWould you like to create another assistant?`,
      }]);
      setDraft({ name: "", description: "", content: "" });
      onPresetSaved();
    },
    onError: (err) => {
      setError(err.message || "Failed to save preset");
    },
  });

  const saving = savePresetMutation.isPending;

  const handleTemplateClick = (template: typeof STARTER_TEMPLATES[0]) => {
    setInput(template.prompt);
    inputRef.current?.focus();
  };

  const parsePresetFromResponse = (response: string): PresetDraft | null => {
    const presetMatch = response.match(/---PRESET_READY---\s*\n?([\s\S]*?)---END_PRESET---/);
    if (!presetMatch) return null;

    const presetContent = presetMatch[1];
    const nameMatch = presetContent.match(/Name:\s*(.+)/);
    const descMatch = presetContent.match(/Description:\s*(.+)/);
    const contentMatch = presetContent.match(/Content:\s*\n?([\s\S]*)/);

    if (nameMatch && contentMatch) {
      return {
        name: nameMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : "",
        content: contentMatch[1].trim(),
      };
    }
    return null;
  };

  const cleanResponseForDisplay = (response: string): string => {
    const cleaned = response.replace(/---PRESET_READY---[\s\S]*?---END_PRESET---/, "").trim();
    if (cleaned !== response) {
      return cleaned + "\n\nI've generated your instruction preset! You can see it in the preview panel on the right. Feel free to edit it there, then click \"Save as Preset\" when you're ready.";
    }
    return response;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/instruction-presets/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to get response");
      }

      const data = await res.json();
      const response = data.data?.response || data.response || "";

      // Capture prompts if provided (for transparency display)
      const chatPrompt = data.data?.chatSystemPrompt || data.chatSystemPrompt;
      if (chatPrompt && !chatSystemPrompt) {
        setChatSystemPrompt(chatPrompt);
      }
      const builderPrompt = data.data?.builderSystemPrompt || data.builderSystemPrompt;
      if (builderPrompt && !builderSystemPrompt) {
        setBuilderSystemPrompt(builderPrompt);
      }

      // Check if response contains a preset
      const extractedPreset = parsePresetFromResponse(response);
      if (extractedPreset) {
        setDraft(extractedPreset);
      }

      // Clean response for display
      const displayResponse = cleanResponseForDisplay(response);

      const assistantMessage: Message = { role: "assistant", content: displayResponse };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setMessages([INITIAL_MESSAGE]);
    setDraft({ name: "", description: "", content: "" });
    setInput("");
    setError(null);
  };

  const handleSavePreset = () => {
    if (!draft.name || !draft.content) return;
    setError(null);

    savePresetMutation.mutate({
      name: draft.name,
      description: draft.description,
      content: draft.content,
      requestShare: true,
    });
  };

  // Starter template buttons
  const templateButtons = (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {STARTER_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => handleTemplateClick(template)}
          style={{
            padding: "12px 16px",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            textAlign: "left",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#6366f1";
            e.currentTarget.style.backgroundColor = "#f8fafc";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.backgroundColor = "#fff";
          }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}>
            <Sparkles size={14} style={{ color: "#6366f1" }} />
            <span style={{ fontWeight: 500, fontSize: "14px", color: "#334155" }}>
              {template.label}
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {template.description}
          </span>
        </button>
      ))}
      <button
        onClick={() => inputRef.current?.focus()}
        style={{
          padding: "12px 16px",
          backgroundColor: "#fff",
          border: "1px dashed #cbd5e1",
          borderRadius: "12px",
          textAlign: "left",
          cursor: "pointer",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        Or describe your own...
      </button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* Left Column - Chat */}
      <ConversationalPanel
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        loadingText="Thinking..."
        placeholder="Describe the assistant you want to create..."
        error={error}
        onErrorDismiss={() => setError(null)}
        postInitialContent={templateButtons}
        showPostInitialOnFirstOnly={true}
        systemPrompt={builderSystemPrompt}
        systemPromptTitle="Builder System Prompt"
        inputBackgroundColor="#fff"
        textareaSize="lg"
        inputControlsRight={
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#64748b",
          }}>
            <Zap size={14} style={{ color: "#8b5cf6" }} />
            Quality
          </div>
        }
      />

      {/* Resizable Divider */}
      <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

      {/* Right Column - Preview */}
      <div style={{
        width: `${panelWidth}px`,
        minWidth: `${panelMinWidth}px`,
        maxWidth: `${panelMaxWidth}px`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        <BuilderPreviewPanel
          draft={draft}
          onDraftChange={setDraft}
          onStartOver={handleStartOver}
          onSave={handleSavePreset}
          saving={saving}
          hasContent={Boolean(draft.content)}
          chatSystemPrompt={chatSystemPrompt}
        />
      </div>
    </div>
  );
}
