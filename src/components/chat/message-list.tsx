"use client";

import { useRef, useEffect } from "react";
import { User, Bot, Eye, ChevronDown, CheckCircle2, AlertCircle, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/stores/chat-store";
import { MessageFeedback } from "./message-feedback";

// Confidence badge styling helper
function getConfidenceBadge(confidence: string | undefined) {
  if (!confidence) return null;
  const conf = confidence.toLowerCase();
  if (conf.includes("high")) {
    return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "High" };
  } else if (conf.includes("medium")) {
    return { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Medium" };
  } else if (conf.includes("low")) {
    return { icon: HelpCircle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", label: "Low" };
  } else if (conf.includes("unable")) {
    return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Unable" };
  }
  return { icon: HelpCircle, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: confidence };
}

// Transparency dropdown component for message footer
function MessageTransparencyDropdown({
  message,
  onViewFullPrompt,
}: {
  message: ChatMessage;
  onViewFullPrompt: () => void;
}) {
  const confidenceBadge = getConfidenceBadge(message.confidence);
  // Use notes (new format) or fall back to reasoning (old format)
  const notesText = message.notes || message.reasoning || null;

  return (
    <div className="mt-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {confidenceBadge ? (
              <>
                <confidenceBadge.icon className={`h-3.5 w-3.5 ${confidenceBadge.color}`} />
                <span className="font-medium">Confidence:</span>
                <span className={`font-medium ${confidenceBadge.color}`}>
                  {confidenceBadge.label}
                </span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>Transparency</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96 max-w-[calc(100vw-2rem)]">
          {/* Confidence header section */}
          {confidenceBadge && (
            <>
              <div className={`px-3 py-2.5 ${confidenceBadge.bg} border-b ${confidenceBadge.border}`}>
                <div className="flex items-center gap-2">
                  <confidenceBadge.icon className={`h-5 w-5 ${confidenceBadge.color}`} />
                  <span className={`text-sm font-semibold ${confidenceBadge.color}`}>
                    {confidenceBadge.label} Confidence
                  </span>
                </div>
              </div>
            </>
          )}
          {/* Notes section */}
          {notesText && (
            <>
              <div className="px-3 py-2 max-h-80 overflow-y-auto">
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {notesText}
                </p>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {/* View full prompt action */}
          <DropdownMenuItem onClick={onViewFullPrompt}>
            <Eye className="h-4 w-4 mr-2" />
            View full prompt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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
      <div className="h-full flex items-center justify-center text-muted-foreground">
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
    <div className="h-full overflow-y-auto p-4 space-y-4">
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

        {/* Transparency dropdown for assistant messages */}
        {!isUser && onViewTransparency && (
          <MessageTransparencyDropdown
            message={message}
            onViewFullPrompt={() => onViewTransparency(message)}
          />
        )}

        {/* Knowledge sources used (shown even without transparency metadata) */}
        {!isUser && !message.confidence && ((message.skillsUsed?.length ?? 0) > 0 || (message.documentsUsed?.length ?? 0) > 0 || (message.urlsUsed?.length ?? 0) > 0) && (
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
