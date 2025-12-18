"use client";

import { useRef, useEffect } from "react";
import { User, Bot, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/stores/chat-store";
import TransparencyDetails from "@/components/TransparencyDetails";
import { MessageFeedback } from "./message-feedback";

interface MessageListProps {
  messages: ChatMessage[];
  sessionId?: string | null;
  onViewTransparency?: (message: ChatMessage) => void;
  onFeedbackChange?: (messageId: string, feedback: ChatMessage["feedback"]) => void;
}

export function MessageList({ messages, sessionId, onViewTransparency, onFeedbackChange }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Bot className="h-12 w-12 mx-auto opacity-50" />
          <p>Start a conversation</p>
          <p className="text-sm">
            Select knowledge sources from the sidebar, then ask a question
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          sessionId={sessionId}
          onViewTransparency={onViewTransparency}
          onFeedbackChange={onFeedbackChange}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  sessionId?: string | null;
  onViewTransparency?: (message: ChatMessage) => void;
  onFeedbackChange?: (messageId: string, feedback: ChatMessage["feedback"]) => void;
}

function MessageBubble({ message, sessionId, onViewTransparency, onFeedbackChange }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className={cn(
          "text-sm leading-relaxed",
          !isUser && "[&>p]:my-3 [&>ul]:my-3 [&>ol]:my-3 [&_li]:my-1 [&>h1]:mt-5 [&>h1]:mb-2 [&>h1]:text-base [&>h1]:font-semibold [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h3]:mt-4 [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-medium [&_strong]:font-semibold [&>p:has(strong:first-child)]:mt-4"
        )}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Transparency details for assistant messages */}
        {!isUser && (message.confidence || message.sources || message.reasoning || message.inference || message.remarks) && (
          <TransparencyDetails
            data={{
              confidence: message.confidence,
              sources: message.sources,
              reasoning: message.reasoning,
              inference: message.inference,
              remarks: message.remarks,
            }}
            knowledgeReferences={[
              ...(message.skillsUsed || []).map((s) => ({ id: s.id, title: s.title, type: "skill" as const })),
              ...(message.documentsUsed || []).map((d) => ({ id: d.id, title: d.title, type: "document" as const })),
            ]}
          />
        )}

        {/* View full prompt transparency button */}
        {!isUser && message.skillsUsed && onViewTransparency && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewTransparency(message)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-3 w-3" />
              View full prompt
            </Button>
          </div>
        )}

        {/* Knowledge sources used (shown even without transparency metadata) */}
        {!isUser && !message.confidence && (message.skillsUsed?.length || message.documentsUsed?.length || message.urlsUsed?.length) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.skillsUsed?.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {skill.title}
              </span>
            ))}
            {message.documentsUsed?.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                {doc.title}
              </span>
            ))}
            {message.urlsUsed?.map((url) => (
              <span
                key={url.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
              >
                {url.title}
              </span>
            ))}
          </div>
        )}

        {/* Feedback for assistant messages */}
        {!isUser && onFeedbackChange && (
          <MessageFeedback
            messageId={message.id}
            sessionId={sessionId || null}
            feedback={message.feedback}
            onFeedbackChange={(feedback) => onFeedbackChange(message.id, feedback)}
          />
        )}
      </div>
    </div>
  );
}
