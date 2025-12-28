"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, Merge, Split, Tag, Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ConversationalPanel, Message } from "@/components/ui/conversational-panel";
import { Skill } from "@/types/skill";

type KnowledgeAnalysisModalProps = {
  skills: Skill[];
  isOpen: boolean;
  onClose: () => void;
};

type Recommendation = {
  type: "merge" | "split" | "rename" | "gap" | "quality";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedSkillIds: string[];
  affectedSkillTitles: string[];
  suggestedAction?: string;
};

type AnalysisState = {
  healthScore: number | null;
  recommendations: Recommendation[];
};

const RECOMMENDATION_ICONS: Record<string, typeof Merge> = {
  merge: Merge,
  split: Split,
  rename: Tag,
  gap: Lightbulb,
  quality: AlertTriangle,
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "#fee2e2", text: "#dc2626" },
  medium: { bg: "#fef3c7", text: "#d97706" },
  low: { bg: "#e0f2fe", text: "#0284c7" },
};

export default function KnowledgeAnalysisModal({ skills, isOpen, onClose }: KnowledgeAnalysisModalProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisState>({ healthScore: null, recommendations: [] });
  const hasInitializedRef = useRef(false);

  // Find skill IDs from titles
  const getSkillIdsByTitles = (titles: string[]): string[] => {
    return titles
      .map(title => skills.find(s => s.title.toLowerCase() === title.toLowerCase())?.id)
      .filter((id): id is string => !!id);
  };

  // Handle recommendation actions
  const handleRecommendationAction = (rec: Recommendation) => {
    const skillIds = getSkillIdsByTitles(rec.affectedSkillTitles);

    switch (rec.type) {
      case "merge":
        if (skillIds.length >= 2) {
          router.push(`/knowledge/add?mode=merge&skills=${skillIds.join(",")}`);
          onClose();
        }
        break;
      case "split":
        if (skillIds.length >= 1) {
          router.push(`/knowledge/add?mode=split&skill=${skillIds[0]}`);
          onClose();
        }
        break;
      case "gap":
        const topic = rec.title.replace(/^(Add|Create|Missing:?)\s*/i, "").trim();
        router.push(`/knowledge/add?mode=gap&topic=${encodeURIComponent(topic)}`);
        onClose();
        break;
      case "rename":
      case "quality":
        // For rename/quality, could open the skill editor directly
        break;
    }
  };

  // Check if action is available for a recommendation
  const canTakeAction = (rec: Recommendation): boolean => {
    const skillIds = getSkillIdsByTitles(rec.affectedSkillTitles);
    switch (rec.type) {
      case "merge":
        return skillIds.length >= 2;
      case "split":
        return skillIds.length >= 1;
      case "gap":
        return true;
      default:
        return false;
    }
  };

  // Get action button text
  const getActionButtonText = (type: string): string => {
    switch (type) {
      case "merge": return "Merge";
      case "split": return "Split";
      case "gap": return "Create";
      default: return "Fix";
    }
  };

  // Build skill summaries for the API
  const buildSkillSummaries = useMemo(() => {
    return skills.map(skill => ({
      id: skill.id,
      title: skill.title,
      category: skill.categories?.[0] || "Uncategorized",
      categories: skill.categories,
      contentPreview: skill.content.slice(0, 500) + (skill.content.length > 500 ? "..." : ""),
    }));
  }, [skills]);

  // Initialize conversation when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (hasInitializedRef.current) return;
    if (messages.length > 0) return;

    hasInitializedRef.current = true;

    const initializeAnalysis = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/skills/analyze-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skills: buildSkillSummaries,
            conversational: true,
            message: "Please analyze my skill library and provide an initial assessment with any issues you find.",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to analyze library");
        }

        const data = await res.json();
        const result = data.data ?? data;

        // Capture transparency info
        if (result.transparency?.systemPrompt) {
          setSystemPrompt(result.transparency.systemPrompt);
        }

        // Set initial analysis state
        if (result.healthScore !== undefined) {
          setAnalysis({
            healthScore: result.healthScore,
            recommendations: result.recommendations || [],
          });
        }

        // Add the AI's initial response as a message
        const initialMessage = result.response || result.summary || "I've analyzed your library. What would you like to know?";
        setMessages([{ role: "assistant", content: initialMessage }]);
      } catch {
        setMessages([{
          role: "assistant",
          content: `I'll help you analyze your library of ${skills.length} skills. What aspects would you like me to look at? I can check for redundancy, gaps, organization issues, or suggest improvements.`,
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAnalysis();
  }, [isOpen, buildSkillSummaries, skills.length, messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/skills/analyze-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: buildSkillSummaries,
          conversational: true,
          message: userMessage.content,
          conversationHistory: messages,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to get response");
      }

      const data = await res.json();
      const result = data.data ?? data;

      // Update recommendations if provided
      if (result.recommendations && result.recommendations.length > 0) {
        setAnalysis(prev => ({
          ...prev,
          recommendations: result.recommendations,
          healthScore: result.healthScore ?? prev.healthScore,
        }));
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: result.response || result.summary || "I've updated my analysis.",
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  // Header for the ConversationalPanel
  const header = (
    <div style={{
      padding: "16px 24px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <div>
        <h3 id="library-analysis-modal-title" style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
          Library Analysis
        </h3>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
          {skills.length} skills in your library
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[90vw] h-[80vh] overflow-hidden flex p-0">
        {/* Left Column - Chat */}
        <ConversationalPanel
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          loadingText="Analyzing..."
          placeholder="Ask about your library..."
          error={error}
          onErrorDismiss={() => setError(null)}
          header={header}
          systemPrompt={systemPrompt}
          systemPromptTitle="Analysis System Prompt"
          textareaSize="md"
        />

        {/* Right Column - Analysis Summary */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-slate-50 border-l">
          {/* Health Score */}
          <div className="p-5 border-b">
            <h4 className="text-xs text-slate-500 uppercase font-medium mb-3">
              Library Health
            </h4>
            {analysis.healthScore !== null ? (
              <div className="flex items-center gap-3">
                <div
                  className={`w-[60px] h-[60px] rounded-full flex items-center justify-center text-xl font-bold ${
                    analysis.healthScore >= 80
                      ? "bg-green-100 text-green-800"
                      : analysis.healthScore >= 60
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {analysis.healthScore}
                </div>
                <div className="text-sm text-slate-500">
                  {analysis.healthScore >= 80 ? "Well organized" : analysis.healthScore >= 60 ? "Needs attention" : "Needs work"}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">
                {isLoading ? "Calculating..." : "Ask me to analyze your library"}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="flex-1 overflow-y-auto p-5">
            <h4 className="text-xs text-slate-500 uppercase font-medium mb-3">
              Recommendations
            </h4>
            {analysis.recommendations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {analysis.recommendations.map((rec, idx) => {
                  const Icon = RECOMMENDATION_ICONS[rec.type] || Lightbulb;
                  const colors = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.medium;
                  return (
                    <div
                      key={idx}
                      className="bg-white border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon size={14} style={{ color: colors.text }} />
                        <span className="text-xs font-semibold text-slate-800">
                          {rec.title}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded ml-auto"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                        {rec.description}
                      </p>
                      {canTakeAction(rec) && (
                        <button
                          onClick={() => handleRecommendationAction(rec)}
                          className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 bg-transparent border-none p-0 cursor-pointer"
                        >
                          {getActionButtonText(rec.type)}
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">
                {isLoading ? "Finding issues..." : "No recommendations yet"}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
