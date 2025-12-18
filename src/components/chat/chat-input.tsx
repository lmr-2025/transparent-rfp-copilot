"use client";

import { useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SpeedToggle } from "@/components/speed-toggle";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder?: string;
  quickMode?: boolean;
  onQuickModeChange?: (quickMode: boolean) => void;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  placeholder = "Type your message...",
  quickMode,
  onQuickModeChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-border bg-background">
      {/* Speed toggle row */}
      {onQuickModeChange && quickMode !== undefined && (
        <div className="flex justify-end">
          <SpeedToggle
            quickMode={quickMode}
            onChange={onQuickModeChange}
            disabled={isLoading}
          />
        </div>
      )}
      {/* Input row */}
      <div className="flex gap-3 items-end">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className={cn(
            "flex-1 min-h-[48px] max-h-[150px] resize-none",
            "text-base leading-relaxed"
          )}
        />
        <Button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label={isLoading ? "Sending message" : "Send message"}
        >
          {isLoading ? (
            <InlineLoader size="md" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
