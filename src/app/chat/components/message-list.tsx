"use client";

import { useRef, useEffect } from "react";
import { User, Bot, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/stores/chat-store";

interface MessageListProps {
  messages: ChatMessage[];
  onViewTransparency?: (message: ChatMessage) => void;
}

export function MessageList({ messages, onViewTransparency }: MessageListProps) {
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
          onViewTransparency={onViewTransparency}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onViewTransparency?: (message: ChatMessage) => void;
}

function MessageBubble({ message, onViewTransparency }: MessageBubbleProps) {
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
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>

        {/* Transparency button for assistant messages */}
        {!isUser && message.skillsUsed && onViewTransparency && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewTransparency(message)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-3 w-3" />
              View transparency
            </Button>
          </div>
        )}

        {/* Sources used */}
        {!isUser && (message.skillsUsed?.length || message.documentsUsed?.length || message.urlsUsed?.length) && (
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
      </div>
    </div>
  );
}
