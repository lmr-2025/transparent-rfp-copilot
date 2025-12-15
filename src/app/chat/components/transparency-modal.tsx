"use client";

import { useState } from "react";
import { X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface TransparencyData {
  systemPrompt: string;
  baseSystemPrompt?: string;
  knowledgeContext: string;
  customerContext?: string;
  documentContext?: string;
  urlContext?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface TransparencyModalProps {
  open: boolean;
  onClose: () => void;
  data: TransparencyData;
  isPreview?: boolean;
}

export function TransparencyModal({
  open,
  onClose,
  data,
  isPreview = false,
}: TransparencyModalProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["system", "knowledge"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatCharCount = (text: string) => {
    return text.length.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isPreview ? "System Prompt Preview" : "Prompt Transparency"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isPreview
              ? "This is the system prompt that will be sent with your message"
              : "See exactly what was sent to the AI model"}
          </p>
        </DialogHeader>

        {/* Model Configuration */}
        <div className="flex gap-2 flex-wrap">
          <ConfigBadge label="Model" value={data.model} color="blue" />
          <ConfigBadge
            label="Max Tokens"
            value={data.maxTokens.toString()}
            color="yellow"
          />
          <ConfigBadge
            label="Temperature"
            value={data.temperature.toString()}
            color="green"
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* System Prompt Section */}
          <CollapsibleSection
            title="System Prompt"
            charCount={formatCharCount(
              data.baseSystemPrompt || data.systemPrompt
            )}
            isExpanded={expandedSections.has("system")}
            onToggle={() => toggleSection("system")}
            onCopy={() =>
              handleCopy(
                data.baseSystemPrompt || data.systemPrompt,
                "system"
              )
            }
            copied={copied === "system"}
          >
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-md overflow-x-auto">
              {data.baseSystemPrompt || data.systemPrompt}
            </pre>
          </CollapsibleSection>

          {/* Knowledge Context Section */}
          {data.knowledgeContext && (
            <CollapsibleSection
              title="Knowledge Context"
              charCount={formatCharCount(data.knowledgeContext)}
              isExpanded={expandedSections.has("knowledge")}
              onToggle={() => toggleSection("knowledge")}
              onCopy={() => handleCopy(data.knowledgeContext, "knowledge")}
              copied={copied === "knowledge"}
            >
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                {data.knowledgeContext}
              </pre>
            </CollapsibleSection>
          )}

          {/* Customer Context Section */}
          {data.customerContext && (
            <CollapsibleSection
              title="Customer Context"
              charCount={formatCharCount(data.customerContext)}
              isExpanded={expandedSections.has("customer")}
              onToggle={() => toggleSection("customer")}
              onCopy={() => handleCopy(data.customerContext!, "customer")}
              copied={copied === "customer"}
            >
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                {data.customerContext}
              </pre>
            </CollapsibleSection>
          )}

          {/* Document Context Section */}
          {data.documentContext && (
            <CollapsibleSection
              title="Document Context"
              charCount={formatCharCount(data.documentContext)}
              isExpanded={expandedSections.has("document")}
              onToggle={() => toggleSection("document")}
              onCopy={() => handleCopy(data.documentContext!, "document")}
              copied={copied === "document"}
            >
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                {data.documentContext}
              </pre>
            </CollapsibleSection>
          )}

          {/* URL Context Section */}
          {data.urlContext && (
            <CollapsibleSection
              title="URL Context"
              charCount={formatCharCount(data.urlContext)}
              isExpanded={expandedSections.has("url")}
              onToggle={() => toggleSection("url")}
              onCopy={() => handleCopy(data.urlContext!, "url")}
              copied={copied === "url"}
            >
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                {data.urlContext}
              </pre>
            </CollapsibleSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper components
interface ConfigBadgeProps {
  label: string;
  value: string;
  color: "blue" | "yellow" | "green";
}

function ConfigBadge({ label, value, color }: ConfigBadgeProps) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    yellow:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    green:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        colorClasses[color]
      )}
    >
      <span className="uppercase text-[10px] opacity-70">{label}:</span>
      {value}
    </span>
  );
}

interface CollapsibleSectionProps {
  title: string;
  charCount: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  charCount,
  isExpanded,
  onToggle,
  onCopy,
  copied,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-muted-foreground">
            ({charCount} chars)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="h-7 px-2"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </button>
      {isExpanded && <div className="p-4 pt-2">{children}</div>}
    </div>
  );
}
