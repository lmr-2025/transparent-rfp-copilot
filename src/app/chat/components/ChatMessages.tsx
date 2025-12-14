"use client";

import { RefObject } from "react";
import { ChatMessage, TransparencyData } from "./types";
import { chatStyles as styles } from "./styles";
import { ChatPrompt, CategoryConfig } from "@/lib/chatPromptLibrary";
import { ChatProjectTemplate } from "@/lib/chatProjectTemplates";
import ChatProjectSelector from "@/components/ChatProjectSelector";
import SuggestedPrompts from "@/components/SuggestedPrompts";

type Props = {
  messages: ChatMessage[];
  isLoading: boolean;
  prompts: ChatPrompt[];
  categories: CategoryConfig[];
  selectedProjectTemplate: ChatProjectTemplate | null;
  totalKnowledgeSelected: number;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSelectTemplate: (template: ChatProjectTemplate | null) => void;
  onSuggestedPrompt: (prompt: string) => void;
  onApplyPrompt: (prompt: ChatPrompt) => void;
  onViewTransparency: (data: TransparencyData) => void;
  getAvailableSuggestedPrompts: () => string[];
};

export function ChatMessages({
  messages,
  isLoading,
  prompts,
  categories,
  selectedProjectTemplate,
  totalKnowledgeSelected,
  messagesEndRef,
  onSelectTemplate,
  onSuggestedPrompt,
  onApplyPrompt,
  onViewTransparency,
  getAvailableSuggestedPrompts,
}: Props) {
  const getCategoryConfig = (id: string): CategoryConfig | undefined => {
    return categories.find(c => c.id === id);
  };

  if (messages.length === 0) {
    return (
      <div style={{ ...styles.emptyState, justifyContent: "flex-start", paddingTop: "24px" }}>
        {/* Project Template Selector */}
        <div style={{ width: "100%", maxWidth: "600px", marginBottom: "24px" }}>
          <ChatProjectSelector
            onSelectTemplate={onSelectTemplate}
            selectedTemplateId={selectedProjectTemplate?.id || null}
          />
        </div>

        {/* Suggested prompts when template is selected */}
        {selectedProjectTemplate && (
          <div style={{ width: "100%", maxWidth: "600px", marginBottom: "24px" }}>
            <SuggestedPrompts
              prompts={getAvailableSuggestedPrompts()}
              onSelectPrompt={onSuggestedPrompt}
              disabled={isLoading || totalKnowledgeSelected === 0}
              title={`Suggested questions for ${selectedProjectTemplate.name}`}
            />
          </div>
        )}

        {/* Welcome message and quick prompts */}
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

          {/* Quick prompt buttons */}
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
                    onClick={() => onApplyPrompt(prompt)}
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
    );
  }

  return (
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
                    onClick={() => onViewTransparency(message.transparency!)}
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

      {/* Suggested follow-up prompts */}
      {selectedProjectTemplate && !isLoading && messages.length > 0 && getAvailableSuggestedPrompts().length > 0 && (
        <div style={{ marginTop: "8px", marginBottom: "16px" }}>
          <SuggestedPrompts
            prompts={getAvailableSuggestedPrompts().slice(0, 3)}
            onSelectPrompt={onSuggestedPrompt}
            disabled={isLoading}
            compact
          />
        </div>
      )}

      {/* Loading indicator */}
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
  );
}
