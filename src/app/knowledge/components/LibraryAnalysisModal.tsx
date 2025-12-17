"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, Merge, Split, Tag, Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalContainer } from "@/components/ui/modal";
import { ConversationalPanel, Message } from "@/components/ui/conversational-panel";
import { Skill } from "@/types/skill";

type LibraryAnalysisModalProps = {
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

export default function LibraryAnalysisModal({ skills, isOpen, onClose }: LibraryAnalysisModalProps) {
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
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      width="xlarge"
      padding={false}
      contentStyle={{
        borderRadius: "16px",
        width: "90vw",
        height: "80vh",
        display: "flex",
        overflow: "hidden",
      }}
      ariaLabelledBy="library-analysis-modal-title"
    >
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
        />

        {/* Right Column - Analysis Summary */}
        <div style={{
          width: "320px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f8fafc",
          borderLeft: "1px solid #e2e8f0",
        }}>
          {/* Health Score */}
          <div style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}>
            <h4 style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px 0", textTransform: "uppercase", fontWeight: 500 }}>
              Library Health
            </h4>
            {analysis.healthScore !== null ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: analysis.healthScore >= 80 ? "#dcfce7" : analysis.healthScore >= 60 ? "#fef3c7" : "#fee2e2",
                  color: analysis.healthScore >= 80 ? "#166534" : analysis.healthScore >= 60 ? "#92400e" : "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                }}>
                  {analysis.healthScore}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  {analysis.healthScore >= 80 ? "Well organized" : analysis.healthScore >= 60 ? "Needs attention" : "Needs work"}
                </div>
              </div>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                {isLoading ? "Calculating..." : "Ask me to analyze your library"}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
          }}>
            <h4 style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px 0", textTransform: "uppercase", fontWeight: 500 }}>
              Recommendations
            </h4>
            {analysis.recommendations.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {analysis.recommendations.map((rec, idx) => {
                  const Icon = RECOMMENDATION_ICONS[rec.type] || Lightbulb;
                  const colors = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.medium;
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <Icon size={14} style={{ color: colors.text }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                          {rec.title}
                        </span>
                        <span style={{
                          fontSize: "10px",
                          backgroundColor: colors.bg,
                          color: colors.text,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          marginLeft: "auto",
                        }}>
                          {rec.priority}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 8px 0", lineHeight: "1.4" }}>
                        {rec.description}
                      </p>
                      {canTakeAction(rec) && (
                        <button
                          onClick={() => handleRecommendationAction(rec)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#6366f1",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                          }}
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
              <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                {isLoading ? "Finding issues..." : "No recommendations yet"}
              </div>
            )}
          </div>
        </div>
    </ModalContainer>
  );
}
