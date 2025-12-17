"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Eye, Zap } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import ReactMarkdown from "react-markdown";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import BuilderPreviewPanel, { PresetDraft } from "./BuilderPreviewPanel";

type Message = {
  role: "assistant" | "user";
  content: string;
};

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

export default function BuilderTab({ onPresetSaved }: BuilderTabProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState<PresetDraft>({ name: "", description: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>("");
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const [builderSystemPrompt, setBuilderSystemPrompt] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    // Remove the preset block from display, show a friendly message instead
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartOver = () => {
    setMessages([INITIAL_MESSAGE]);
    setDraft({ name: "", description: "", content: "" });
    setInput("");
    setError(null);
  };

  const handleSavePreset = async () => {
    if (!draft.name || !draft.content) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/instruction-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          content: draft.content,
          requestShare: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to save preset");
      }

      // Success - reset and notify
      setMessages([{
        role: "assistant",
        content: `Great! Your "${draft.name}" preset has been saved and submitted for approval. You can find it in the Presets tab.\n\nWould you like to create another assistant?`,
      }]);
      setDraft({ name: "", description: "", content: "" });
      onPresetSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preset");
    } finally {
      setSaving(false);
    }
  };

  // Check if we should show templates (only on initial message)
  const showTemplates = messages.length === 1 && messages[0] === INITIAL_MESSAGE;

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
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
      }}>
        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: "16px",
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                maxWidth: "85%",
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                backgroundColor: msg.role === "user" ? "#6366f1" : "#f1f5f9",
                color: msg.role === "user" ? "#fff" : "#334155",
                fontSize: "14px",
                lineHeight: "1.5",
              }}>
                {msg.role === "user" ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                      em: ({ children }) => <em>{children}</em>,
                      ul: ({ children }) => <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                      code: ({ children }) => (
                        <code style={{
                          backgroundColor: "#e2e8f0",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "13px",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {/* Starter Templates */}
          {showTemplates && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "8px",
              marginLeft: "8px",
            }}>
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
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              color: "#64748b",
              fontSize: "14px",
            }}>
              <InlineLoader size="sm" />
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ padding: "12px 24px" }}>
            <InlineError message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Input Area */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#fff",
        }}>
          {/* Controls Row */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}>
            <button
              onClick={() => setShowSystemPromptModal(true)}
              disabled={!builderSystemPrompt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "13px",
                color: builderSystemPrompt ? "#475569" : "#94a3b8",
                cursor: builderSystemPrompt ? "pointer" : "not-allowed",
              }}
            >
              <Eye size={14} />
              Preview System Prompt
            </button>
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
          </div>
          <div style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-end",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the assistant you want to create..."
              rows={2}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "14px",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              style={{
                padding: "12px",
                backgroundColor: input.trim() && !isLoading ? "#6366f1" : "#e2e8f0",
                color: input.trim() && !isLoading ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: "12px",
                cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isLoading ? <InlineLoader size="md" /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>

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

      {/* System Prompt Modal */}
      {showSystemPromptModal && builderSystemPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowSystemPromptModal(false)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "700px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#334155" }}>
                Builder System Prompt
              </h3>
              <button
                onClick={() => setShowSystemPromptModal(false)}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "20px",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              padding: "20px",
              overflowY: "auto",
              flex: 1,
            }}>
              <p style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                color: "#64748b",
              }}>
                This is the system prompt guiding the AI as it helps you build instruction presets.
                You can edit this prompt in Admin → Settings → Prompts.
              </p>
              <pre style={{
                margin: 0,
                padding: "16px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "12px",
                lineHeight: "1.6",
                color: "#334155",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}>
                {builderSystemPrompt}
              </pre>
            </div>
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setShowSystemPromptModal(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#6366f1",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
