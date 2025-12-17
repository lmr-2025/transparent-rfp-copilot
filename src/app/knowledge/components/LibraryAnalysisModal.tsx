"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Send, Eye, X, AlertTriangle, Merge, Split, Tag, Lightbulb, ArrowRight } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Skill } from "@/types/skill";

type LibraryAnalysisModalProps = {
  skills: Skill[];
  isOpen: boolean;
  onClose: () => void;
};

type Message = {
  role: "user" | "assistant";
  content: string;
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
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisState>({ healthScore: null, recommendations: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        // Extract topic from title or description
        const topic = rec.title.replace(/^(Add|Create|Missing:?)\s*/i, "").trim();
        router.push(`/knowledge/add?mode=gap&topic=${encodeURIComponent(topic)}`);
        onClose();
        break;
      case "rename":
      case "quality":
        // For rename/quality, we could open the skill editor directly
        // For now, just navigate to the skill if we have one
        if (skillIds.length >= 1) {
          // Could link to skill detail page if it exists
          // For now, just close and let user handle manually
        }
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
        return true; // Gap always can create new
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Parse recommendations from response
  const parseRecommendations = (response: string): Recommendation[] => {
    const recMatch = response.match(/---RECOMMENDATIONS---\s*([\s\S]*?)---END_RECOMMENDATIONS---/);
    if (!recMatch) return [];

    // Simple parsing - in practice, the API should return structured data
    return [];
  };

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          width: "90vw",
          maxWidth: "1000px",
          height: "80vh",
          display: "flex",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Left Column - Chat */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
                Library Analysis
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
                {skills.length} skills in your library
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {systemPrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSystemPromptModal(true)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Prompt
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
                        ul: ({ children }) => <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

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
                Analyzing...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error display */}
          {error && (
            <div style={{ padding: "12px 24px" }}>
              <InlineError message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {/* Input Area */}
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#fafafa",
          }}>
            <div style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-end",
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your library..."
                disabled={isLoading}
                rows={1}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: "14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  minHeight: "44px",
                  maxHeight: "120px",
                }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "44px";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: input.trim() && !isLoading ? "#6366f1" : "#e2e8f0",
                  color: input.trim() && !isLoading ? "#fff" : "#94a3b8",
                  cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {isLoading ? (
                  <InlineLoader size="sm" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>

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
      </div>

      {/* System Prompt Modal */}
      {showSystemPromptModal && systemPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
          onClick={() => setShowSystemPromptModal(false)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              maxWidth: "700px",
              maxHeight: "80vh",
              overflow: "auto",
              padding: "24px",
              margin: "20px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
              Analysis System Prompt
            </h3>
            <pre style={{
              fontSize: "13px",
              backgroundColor: "#f1f5f9",
              padding: "16px",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}>
              {systemPrompt}
            </pre>
            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <Button onClick={() => setShowSystemPromptModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
