"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Lock,
  AlertTriangle,
  Pencil,
  Plus,
  Trash2,
  Copy,
  X,
  Save,
  RotateCcw,
  Filter,
  Sparkles,
  Send,
  ChevronRight,
  Loader2,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  defaultBlocks as sourceBlocks,
  defaultCompositions,
  type PromptBlock as SourceBlock,
  type PromptComposition,
  type PromptContext,
  type PromptTier,
} from "@/lib/promptBlocks";
import {
  type Block,
  type BlockVariant,
  type Prompt,
  type ApiBlock,
  contextNames,
  contextDescriptions,
  contextColors,
  promptCategories,
  runtimePrompts,
  promptColors,
} from "./types";

// ============================================
// CONFIG
// ============================================

const tierConfig: Record<PromptTier, { label: string; color: string; bgColor: string; borderColor: string; lightBg: string; icon: typeof Lock }> = {
  1: { label: "Locked", color: "text-red-700", bgColor: "bg-red-100", borderColor: "border-red-300", lightBg: "bg-red-50/60", icon: Lock },
  2: { label: "Caution", color: "text-amber-700", bgColor: "bg-amber-100", borderColor: "border-amber-300", lightBg: "bg-amber-50/60", icon: AlertTriangle },
  3: { label: "Open", color: "text-green-700", bgColor: "bg-green-100", borderColor: "border-green-300", lightBg: "bg-green-50/60", icon: Pencil },
};

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

function transformBlocks(sourceBlocks: SourceBlock[]): Block[] {
  return sourceBlocks.map((block) => {
    const contextKeys = Object.keys(block.variants).filter(k => k !== "default") as PromptContext[];
    const variants: BlockVariant[] = contextKeys.map((context) => ({
      id: `${block.id}_${context}`,
      name: contextNames[context] || context,
      content: block.variants[context],
      usedInPrompts: [context],
    }));

    return {
      id: block.id,
      name: block.name,
      description: block.description,
      tier: block.tier,
      defaultContent: block.variants.default,
      variants,
    };
  });
}

function transformCompositions(compositions: PromptComposition[], blocks: Block[]): Prompt[] {
  return compositions.map((comp) => {
    const promptBlocks = comp.blockIds.map((blockId) => {
      const block = blocks.find(b => b.id === blockId);
      const variant = block?.variants.find(v => v.usedInPrompts.includes(comp.context));
      return {
        blockId,
        variantId: variant?.id || null,
      };
    });

    return {
      id: comp.context,
      name: contextNames[comp.context],
      blocks: promptBlocks,
      color: contextColors[comp.context],
    };
  });
}

function transformApiBlocks(apiBlocks: ApiBlock[]): Block[] {
  return apiBlocks.map((block) => {
    const contextKeys = Object.keys(block.variants).filter(k => k !== "default") as PromptContext[];
    const variants: BlockVariant[] = contextKeys.map((context) => ({
      id: `${block.id}_${context}`,
      name: contextNames[context] || context,
      content: block.variants[context],
      usedInPrompts: [context],
    }));

    return {
      id: block.id,
      name: block.name,
      description: block.description,
      tier: block.tier,
      defaultContent: block.variants.default || "",
      variants,
    };
  });
}

function transformBlocksToApi(blocks: Block[]): ApiBlock[] {
  return blocks.map((block) => {
    const variants: Record<string, string> = {
      default: block.defaultContent,
    };
    block.variants.forEach((v) => {
      const context = v.id.replace(`${block.id}_`, "");
      variants[context] = v.content;
    });
    return {
      id: block.id,
      name: block.name,
      description: block.description,
      tier: block.tier,
      variants,
    };
  });
}

// Fallback initialization
const fallbackBlocks: Block[] = transformBlocks(sourceBlocks);
const fallbackPrompts: Prompt[] = transformCompositions(defaultCompositions, fallbackBlocks);

// ============================================
// SUB-COMPONENTS
// ============================================

function TierBadge({ tier }: { tier: PromptTier }) {
  const config = tierConfig[tier];
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", config.bgColor, config.color)}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

function BlockTypeSelector({
  blocks,
  selectedId,
  onSelect,
  onAddBlock,
  usedInPreview,
  showOnlyInPrompt,
  onToggleFilter,
}: {
  blocks: Block[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddBlock: () => void;
  usedInPreview: Set<string>;
  showOnlyInPrompt: boolean;
  onToggleFilter: () => void;
}) {
  const displayBlocks = showOnlyInPrompt
    ? blocks.filter(b => usedInPreview.has(b.id))
    : blocks;

  return (
    <div className="space-y-2">
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-all",
          showOnlyInPrompt
            ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
        )}
        onClick={onToggleFilter}
      >
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3" />
          <span>{showOnlyInPrompt ? "In prompt only" : "All blocks"}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {displayBlocks.length}/{blocks.length}
        </span>
      </button>

      <div className="space-y-1">
        {displayBlocks.map(block => {
          const config = tierConfig[block.tier];
          const isSelected = selectedId === block.id;
          const isInPreview = usedInPreview.has(block.id);
          const variantCount = block.variants.length;
          return (
            <button
              key={block.id}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all group",
                isSelected
                  ? cn(config.bgColor, config.color)
                  : isInPreview
                    ? "bg-blue-50/60 hover:bg-blue-100/60 text-slate-700 ring-1 ring-blue-200"
                    : "hover:bg-slate-100 text-slate-700"
              )}
              onClick={() => onSelect(block.id)}
            >
              <div className="flex items-center gap-2">
                <config.icon className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-sm">{block.name}</span>
                {isInPreview && (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isSelected ? "bg-blue-600" : "bg-blue-400"
                  )} />
                )}
              </div>
              {variantCount > 0 && (
                <Badge variant="secondary" className="text-[9px] h-5">
                  {variantCount} variant{variantCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </button>
          );
        })}
        {!showOnlyInPrompt && (
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-slate-100 text-slate-500 border-2 border-dashed border-slate-200"
            onClick={onAddBlock}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Block Type</span>
          </button>
        )}
      </div>
    </div>
  );
}

function VariantCard({
  variant,
  isDefault,
  isSelected,
  isEditing,
  isEditLocked,
  prompts,
  onSelect,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  editContent,
  setEditContent,
  editName,
  setEditName,
}: {
  variant: { id: string; name: string; content: string; usedInPrompts?: string[] } | null;
  isDefault: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isEditLocked?: boolean;
  prompts: Prompt[];
  onSelect: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDuplicate: () => void;
  editContent: string;
  setEditContent: (s: string) => void;
  editName: string;
  setEditName: (s: string) => void;
}) {
  const usedIn = variant?.usedInPrompts || [];
  const content = variant?.content || "";
  const name = variant?.name || "Default";

  if (isEditing) {
    return (
      <div className="rounded-lg border-2 border-blue-400 bg-blue-50/30 overflow-hidden">
        <div className="px-3 py-2 border-b border-blue-200 bg-blue-100/50">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="font-medium text-sm h-8"
            placeholder="Variant name..."
          />
        </div>
        <div className="p-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-48 p-3 rounded border font-mono text-sm resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            placeholder="Enter content..."
          />
          <div className="flex justify-between mt-3">
            <div>
              {onDelete && !isDefault && (
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={onSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 transition-all group relative",
        isSelected
          ? "border-blue-400 ring-2 ring-blue-200"
          : "border-slate-200 hover:border-slate-300 cursor-pointer"
      )}
      onClick={onSelect}
    >
      <div className={cn(
        "px-3 py-2 border-b flex items-center justify-between",
        isSelected ? "bg-blue-50" : "bg-slate-50"
      )}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>
          {isDefault && (
            <Badge variant="outline" className="text-[9px]">Default</Badge>
          )}
        </div>
        {!isEditLocked && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      <div className="p-3">
        <pre className="text-xs font-mono whitespace-pre-wrap text-slate-600 line-clamp-4">
          {content}
        </pre>
      </div>
      {usedIn.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {usedIn.map(promptId => {
            const prompt = prompts.find(p => p.id === promptId);
            if (!prompt) return null;
            const colors = promptColors[prompt.color];
            return (
              <span key={promptId} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", colors.light, colors.text)}>
                {prompt.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptPreview({
  prompt,
  blocks,
  selectedBlockId,
  isLocked,
  onSelectBlock,
}: {
  prompt: Prompt;
  blocks: Block[];
  selectedBlockId: string | null;
  isLocked?: boolean;
  onSelectBlock: (id: string) => void;
}) {
  return (
    <div className="space-y-0">
      {prompt.blocks.map((pb, index) => {
        const block = blocks.find(b => b.id === pb.blockId);
        if (!block) return null;

        const config = tierConfig[block.tier];
        const variant = pb.variantId ? block.variants.find(v => v.id === pb.variantId) : null;
        const content = variant?.content || block.defaultContent;
        const isSelected = selectedBlockId === block.id;

        return (
          <div
            key={`${pb.blockId}-${index}`}
            className={cn(
              "relative transition-all",
              !isLocked && "cursor-pointer",
              isSelected && !isLocked && "ring-2 ring-blue-400 ring-inset rounded-sm"
            )}
            onClick={() => onSelectBlock(block.id)}
          >
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", config.bgColor)} />
            <div className="absolute -left-1 top-2 transform -translate-x-full pr-3 flex items-center gap-1">
              <span className={cn("text-[10px] font-medium whitespace-nowrap", config.color)}>
                {block.name}
              </span>
              {variant && (
                <span className="text-[8px] text-slate-400">({variant.name})</span>
              )}
            </div>
            <div className={cn("pl-4 py-4 pr-4", config.lightBg)}>
              <pre className="text-sm font-mono whitespace-pre-wrap text-slate-700 leading-relaxed">
                {content}
              </pre>
            </div>
            {index < prompt.blocks.length - 1 && (
              <div className="h-px bg-slate-200/80 mx-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// AI ASSISTANT PANEL
// ============================================

type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_TEMPLATES = [
  {
    label: "Improve clarity",
    prompt: "Review this prompt for clarity. Are there any ambiguous instructions or terms that could be misunderstood?",
  },
  {
    label: "Add edge cases",
    prompt: "What edge cases or scenarios might this prompt not handle well? Suggest additions to cover them.",
  },
  {
    label: "Simplify",
    prompt: "Can this prompt be simplified while maintaining its effectiveness? Remove any redundant or overly verbose sections.",
  },
  {
    label: "Rewrite",
    prompt: "Rewrite this prompt to be more effective while keeping the same intent.",
  },
];

function AIAssistantPanel({
  isOpen,
  onToggle,
  currentPrompt,
  promptName,
  blockCount,
}: {
  isOpen: boolean;
  onToggle: () => void;
  currentPrompt: string;
  promptName: string;
  blockCount: number;
}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: AIMessage = { role: "user", content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/prompts/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          currentPrompt,
          context: promptName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantContent = data.data?.response || "Sorry, I couldn't generate a response.";

      setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleStarterClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    const feedbackPrompt = `I observed the following behavior from the AI in our app that I want to fix:

--- OBSERVED BEHAVIOR ---
${feedbackText}
--- END BEHAVIOR ---

Given this "${promptName}" prompt is being used, analyze:
1. Why might the AI have produced this output?
2. What's missing or unclear in the current prompt that allowed this?
3. Suggest specific changes to prevent this behavior in the future.`;

    setShowFeedbackInput(false);
    setFeedbackText("");
    sendMessage(feedbackPrompt);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-l-lg shadow-lg transition-colors"
        title="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="w-80 flex-shrink-0 border-l bg-white flex flex-col">
      <div className="h-12 border-b flex items-center justify-between px-3 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-sm">AI Assistant</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          title="Close panel"
        >
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      <div className="px-3 py-2 border-b bg-slate-50 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          <span className="font-medium">{promptName}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">{blockCount} blocks</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 ? (
          showFeedbackInput ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Describe the issue</span>
                <button
                  onClick={() => setShowFeedbackInput(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Paste the AI's response or describe what it did wrong..."
                className="w-full h-32 p-2 text-xs border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                autoFocus
              />
              <Button
                size="sm"
                className="w-full"
                onClick={handleFeedbackSubmit}
                disabled={!feedbackText.trim()}
              >
                <Sparkles className="h-3 w-3 mr-1.5" />
                Analyze & suggest fixes
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center">
                Ask AI to help analyze and improve this prompt
              </p>
              <button
                onClick={() => setShowFeedbackInput(true)}
                className="w-full text-left px-3 py-2.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 hover:border-purple-300 transition-colors font-medium"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Report behavior from app
                </div>
                <p className="text-[10px] text-purple-500 mt-1 font-normal">
                  Paste AI output that was wrong to get prompt fixes
                </p>
              </button>
              <div className="space-y-2">
                {STARTER_TEMPLATES.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleStarterClick(template.prompt)}
                    className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-purple-50 hover:text-purple-700 rounded-lg border border-slate-200 hover:border-purple-200 transition-colors"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "text-sm rounded-lg p-2.5",
                msg.role === "user"
                  ? "bg-blue-50 text-blue-900 ml-4"
                  : "bg-slate-50 text-slate-700 mr-4"
              )}
            >
              <div className="whitespace-pre-wrap text-xs leading-relaxed">
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this prompt..."
            className="flex-1 text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            disabled={isLoading}
          />
          <Button type="submit" size="sm" disabled={!input.trim() || isLoading} className="h-8">
            <Send className="h-3 w-3" />
          </Button>
        </form>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-[10px] text-slate-400 hover:text-slate-600 mt-2"
          >
            Clear chat
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN BUILDER TAB COMPONENT
// ============================================

export function BuilderTab() {
  // State
  const [blocks, setBlocks] = useState<Block[]>(fallbackBlocks);
  const [prompts, setPrompts] = useState<Prompt[]>(fallbackPrompts);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string>("role_mission");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [previewPromptId, setPreviewPromptId] = useState<string>("questions");
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [canEditPrompt, setCanEditPrompt] = useState(false);
  const [canEditVariants, setCanEditVariants] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);
  const [showOnlyInPrompt, setShowOnlyInPrompt] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const [promptSearch, setPromptSearch] = useState("");
  const isDragging = useRef(false);

  // Load blocks from API on mount
  useEffect(() => {
    async function loadBlocks() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const res = await fetch("/api/prompt-blocks");
        if (!res.ok) throw new Error("Failed to load prompt blocks");
        const data = await res.json();

        if (data.data?.blocks) {
          const apiBlocks = transformApiBlocks(data.data.blocks);
          setBlocks(apiBlocks);
          const newPrompts = transformCompositions(defaultCompositions, apiBlocks);
          setPrompts(newPrompts);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    }
    loadBlocks();
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(Math.max(280, e.clientX), 600);
    setLeftPanelWidth(newWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId)!;
  const previewPrompt = prompts.find(p => p.id === previewPromptId)!;

  // Handlers
  const handleAddBlock = () => {
    const newBlock: Block = {
      id: `block_${Date.now()}`,
      name: "New Block",
      description: "Description...",
      tier: 3,
      defaultContent: "Enter content here...",
      variants: [],
    };
    setBlocks([...blocks, newBlock]);
    setPrompts(prompts.map(p =>
      p.id === previewPromptId
        ? { ...p, blocks: [...p.blocks, { blockId: newBlock.id, variantId: null }] }
        : p
    ));
    setSelectedBlockId(newBlock.id);
    setSelectedVariantId(null);
    setHasChanges(true);
  };

  const handleAddVariant = () => {
    const newVariant: BlockVariant = {
      id: `variant_${Date.now()}`,
      name: "New Variant",
      content: selectedBlock.defaultContent,
      usedInPrompts: [],
    };
    setBlocks(blocks.map(b =>
      b.id === selectedBlockId
        ? { ...b, variants: [...b.variants, newVariant] }
        : b
    ));
    setEditingVariantId(newVariant.id);
    setEditContent(newVariant.content);
    setEditName(newVariant.name);
    setHasChanges(true);
  };

  const handleEditVariant = (variantId: string | null) => {
    setEditingVariantId(variantId);
    if (variantId === "default") {
      setEditContent(selectedBlock.defaultContent);
      setEditName("Default");
    } else if (variantId) {
      const variant = selectedBlock.variants.find(v => v.id === variantId);
      if (variant) {
        setEditContent(variant.content);
        setEditName(variant.name);
      }
    }
  };

  const handleSaveVariant = () => {
    if (editingVariantId === "default") {
      setBlocks(blocks.map(b =>
        b.id === selectedBlockId
          ? { ...b, defaultContent: editContent }
          : b
      ));
    } else if (editingVariantId) {
      setBlocks(blocks.map(b =>
        b.id === selectedBlockId
          ? {
              ...b,
              variants: b.variants.map(v =>
                v.id === editingVariantId
                  ? { ...v, content: editContent, name: editName }
                  : v
              ),
            }
          : b
      ));
    }
    setEditingVariantId(null);
    setHasChanges(true);
  };

  const handleDeleteVariant = (variantId: string) => {
    setBlocks(blocks.map(b =>
      b.id === selectedBlockId
        ? { ...b, variants: b.variants.filter(v => v.id !== variantId) }
        : b
    ));
    setEditingVariantId(null);
    setHasChanges(true);
  };

  const handleDuplicateVariant = (variantId: string | null) => {
    const source = variantId
      ? selectedBlock.variants.find(v => v.id === variantId)
      : { name: "Default", content: selectedBlock.defaultContent };

    if (source) {
      const newVariant: BlockVariant = {
        id: `variant_${Date.now()}`,
        name: `${source.name} (copy)`,
        content: source.content,
        usedInPrompts: [],
      };
      setBlocks(blocks.map(b =>
        b.id === selectedBlockId
          ? { ...b, variants: [...b.variants, newVariant] }
          : b
      ));
      setHasChanges(true);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const apiBlocks = transformBlocksToApi(blocks);
      const currentRes = await fetch("/api/prompt-blocks");
      const currentData = await currentRes.json();
      const modifiers = currentData.data?.modifiers || [];

      const res = await fetch("/api/prompt-blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: apiBlocks, modifiers }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save");
      }

      setHasChanges(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save blocks");
    } finally {
      setIsSaving(false);
    }
  };

  const getFullPromptContent = () => {
    return previewPrompt.blocks.map(pb => {
      const block = blocks.find(b => b.id === pb.blockId);
      if (!block) return "";
      const variant = pb.variantId ? block.variants.find(v => v.id === pb.variantId) : null;
      return variant?.content || block.defaultContent;
    }).join("\n\n");
  };

  const handleReset = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/prompt-blocks");
      if (!res.ok) throw new Error("Failed to reload");
      const data = await res.json();

      if (data.data?.blocks) {
        const apiBlocks = transformApiBlocks(data.data.blocks);
        setBlocks(apiBlocks);
        const newPrompts = transformCompositions(defaultCompositions, apiBlocks);
        setPrompts(newPrompts);
      }
      setHasChanges(false);
    } catch (err) {
      setBlocks(fallbackBlocks);
      setPrompts(fallbackPrompts);
      setHasChanges(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Block selector + variant editor */}
      <div style={{ width: leftPanelWidth }} className="flex-shrink-0 flex flex-col bg-white border-r">
        {/* Header controls */}
        <div className="p-3 border-b flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all",
                canEditPrompt
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              )}
              onClick={() => setCanEditPrompt(!canEditPrompt)}
              title={canEditPrompt ? "Lock prompt editing" : "Unlock prompt editing"}
            >
              {canEditPrompt ? <Pencil className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              Prompt
            </button>
            <button
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all",
                canEditVariants
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              )}
              onClick={() => setCanEditVariants(!canEditVariants)}
              title={canEditVariants ? "Lock variant editing" : "Unlock variant editing"}
            >
              {canEditVariants ? <Pencil className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              Variants
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex gap-1">
            {loadError && (
              <span className="text-xs text-amber-600">Using local data</span>
            )}
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges || isLoading || isSaving} className="h-7 text-xs">
              <RotateCcw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
              Reset
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={!hasChanges || isSaving} className="h-7 text-xs">
              {isSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Prompt selector */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Preview:</span>
          </div>
          <Select
            value={selectedRuntimeId || previewPromptId}
            onValueChange={(val) => {
              if (val.startsWith("rt_")) {
                setSelectedRuntimeId(val);
              } else {
                setSelectedRuntimeId(null);
                setPreviewPromptId(val);
                const newPrompt = prompts.find(p => p.id === val);
                const blockRef = newPrompt?.blocks.find(pb => pb.blockId === selectedBlockId);
                setSelectedVariantId(blockRef?.variantId || null);
              }
              setPromptSearch("");
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={promptSearch}
                    onChange={(e) => setPromptSearch(e.target.value)}
                    placeholder="Search prompts..."
                    className="w-full h-7 pl-7 pr-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              {promptCategories.map(category => {
                const filteredContexts = category.contexts.filter(contextId => {
                  const prompt = prompts.find(p => p.id === contextId);
                  if (!prompt) return false;
                  return prompt.name.toLowerCase().includes(promptSearch.toLowerCase()) ||
                         contextId.toLowerCase().includes(promptSearch.toLowerCase());
                });
                if (filteredContexts.length === 0) return null;
                return (
                  <SelectGroup key={category.id}>
                    <SelectLabel className="text-xs text-muted-foreground font-medium">
                      {category.name}
                    </SelectLabel>
                    {filteredContexts.map(contextId => {
                      const prompt = prompts.find(p => p.id === contextId);
                      if (!prompt) return null;
                      const colors = promptColors[prompt.color];
                      return (
                        <SelectItem key={prompt.id} value={prompt.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", colors?.bg)} />
                            {prompt.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                );
              })}
              {(() => {
                const filteredRuntime = runtimePrompts.filter(rt =>
                  rt.name.toLowerCase().includes(promptSearch.toLowerCase()) ||
                  rt.description.toLowerCase().includes(promptSearch.toLowerCase())
                );
                if (filteredRuntime.length === 0) return null;
                return (
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground font-medium">
                      Runtime Context
                    </SelectLabel>
                    {filteredRuntime.map(rt => (
                      <SelectItem key={rt.id} value={rt.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          {rt.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })()}
            </SelectContent>
          </Select>
        </div>

        {/* Block type selector */}
        <div className="p-4 border-b">
          <BlockTypeSelector
            blocks={blocks}
            selectedId={selectedBlockId}
            onSelect={(id) => {
              setSelectedBlockId(id);
              const blockRef = previewPrompt.blocks.find(pb => pb.blockId === id);
              setSelectedVariantId(blockRef?.variantId || null);
              setEditingVariantId(null);
            }}
            onAddBlock={handleAddBlock}
            usedInPreview={new Set(previewPrompt.blocks.map(pb => pb.blockId))}
            showOnlyInPrompt={showOnlyInPrompt}
            onToggleFilter={() => setShowOnlyInPrompt(!showOnlyInPrompt)}
          />
        </div>

        {/* Variants for selected block */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">{selectedBlock?.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedBlock?.description}</p>
            </div>
            {selectedBlock && <TierBadge tier={selectedBlock.tier} />}
          </div>

          <div className="space-y-3">
            {/* Default variant */}
            {selectedBlock && (
              <VariantCard
                variant={{ id: "default", name: "Default", content: selectedBlock.defaultContent }}
                isDefault={true}
                isSelected={selectedVariantId === null}
                isEditing={editingVariantId === "default"}
                prompts={prompts}
                onSelect={() => {
                  setSelectedVariantId(null);
                  if (canEditPrompt) {
                    setPrompts(prompts.map(p =>
                      p.id === previewPromptId
                        ? {
                            ...p,
                            blocks: p.blocks.map(pb =>
                              pb.blockId === selectedBlockId
                                ? { ...pb, variantId: null }
                                : pb
                            ),
                          }
                        : p
                    ));
                    setHasChanges(true);
                  }
                }}
                onEdit={() => canEditVariants && handleEditVariant("default")}
                isEditLocked={!canEditVariants}
                onSave={handleSaveVariant}
                onCancel={() => setEditingVariantId(null)}
                onDuplicate={() => handleDuplicateVariant(null)}
                editContent={editContent}
                setEditContent={setEditContent}
                editName={editName}
                setEditName={setEditName}
              />
            )}

            {/* Custom variants */}
            {selectedBlock?.variants.map(variant => (
              <VariantCard
                key={variant.id}
                variant={variant}
                isDefault={false}
                isSelected={selectedVariantId === variant.id}
                isEditing={editingVariantId === variant.id}
                prompts={prompts}
                onSelect={() => {
                  setSelectedVariantId(variant.id);
                  if (canEditPrompt) {
                    setPrompts(prompts.map(p =>
                      p.id === previewPromptId
                        ? {
                            ...p,
                            blocks: p.blocks.map(pb =>
                              pb.blockId === selectedBlockId
                                ? { ...pb, variantId: variant.id }
                                : pb
                            ),
                          }
                        : p
                    ));
                    setHasChanges(true);
                  }
                }}
                onEdit={() => canEditVariants && handleEditVariant(variant.id)}
                isEditLocked={!canEditVariants}
                onSave={handleSaveVariant}
                onCancel={() => setEditingVariantId(null)}
                onDelete={() => canEditVariants ? handleDeleteVariant(variant.id) : undefined}
                onDuplicate={() => handleDuplicateVariant(variant.id)}
                editContent={editContent}
                setEditContent={setEditContent}
                editName={editName}
                setEditName={setEditName}
              />
            ))}

            {/* Add variant button */}
            {canEditVariants && (
              <button
                className="w-full py-3 rounded-lg border-2 border-dashed border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                onClick={handleAddVariant}
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Add Variant</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 hover:w-1.5 bg-slate-200 hover:bg-blue-400 cursor-col-resize transition-all flex-shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Center: Full prompt preview */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
        <div className="flex-1 overflow-auto">
          {selectedRuntimeId ? (
            <div className="max-w-3xl mx-auto py-6 px-6">
              {(() => {
                const rt = runtimePrompts.find(r => r.id === selectedRuntimeId);
                if (!rt) return null;
                return (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="w-3 h-3 rounded-full bg-yellow-500 mt-1 flex-shrink-0" />
                      <div>
                        <h2 className="font-semibold text-lg">{rt.name}</h2>
                        <p className="text-sm text-muted-foreground">{rt.description}</p>
                        <div className="flex gap-1.5 mt-2">
                          {rt.usedIn.map(ctx => (
                            <Badge key={ctx} variant="secondary" className="text-[10px]">
                              {contextNames[ctx as PromptContext] || ctx}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 rounded" />
                      <div className="pl-4 py-4 pr-4 bg-yellow-50/60 rounded-r-lg">
                        <pre className="text-sm font-mono whitespace-pre-wrap text-slate-700 leading-relaxed">
                          {rt.template}
                        </pre>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      This template is injected at runtime based on user selections. Variables like {"{{title}}"} are replaced with actual data.
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 pl-32 pr-6">
              <p className="text-xs text-muted-foreground mb-4">
                {contextDescriptions[previewPromptId as PromptContext]}
              </p>
              {previewPrompt && (
                <PromptPreview
                  prompt={previewPrompt}
                  blocks={blocks}
                  selectedBlockId={selectedBlockId}
                  isLocked={!canEditPrompt}
                  onSelectBlock={(id) => {
                    if (!canEditPrompt) return;
                    setSelectedBlockId(id);
                    const blockRef = previewPrompt.blocks.find(pb => pb.blockId === id);
                    setSelectedVariantId(blockRef?.variantId || null);
                    setEditingVariantId(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-white flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {selectedRuntimeId
              ? "Runtime context template (read-only)"
              : `${previewPrompt?.blocks.length || 0} blocks in this prompt`}
          </span>
          <span>
            {selectedRuntimeId
              ? "These templates are defined in the API routes"
              : canEditPrompt && canEditVariants
                ? "Click variants to swap, edit button to modify content"
                : canEditPrompt
                  ? "Click a variant to apply it to the prompt"
                  : canEditVariants
                    ? "Click edit to modify variant content"
                    : "Unlock Prompt or Variants to make changes"}
          </span>
        </div>

        {!showAIPanel && (
          <button
            onClick={() => setShowAIPanel(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-l-lg shadow-lg transition-colors z-10"
            title="Open AI Assistant"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Right: AI Assistant Panel */}
      {showAIPanel && (
        <AIAssistantPanel
          isOpen={showAIPanel}
          onToggle={() => setShowAIPanel(false)}
          currentPrompt={selectedRuntimeId
            ? runtimePrompts.find(r => r.id === selectedRuntimeId)?.template || ""
            : getFullPromptContent()}
          promptName={selectedRuntimeId
            ? runtimePrompts.find(r => r.id === selectedRuntimeId)?.name || ""
            : contextNames[previewPromptId as PromptContext] || previewPromptId}
          blockCount={selectedRuntimeId ? 1 : previewPrompt?.blocks.length || 0}
        />
      )}
    </div>
  );
}
