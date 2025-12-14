"use client";

import { useState } from "react";
import { PromptBlock, PromptModifier, PromptContext, PromptComposition } from "@/lib/promptBlocks";

// Types for optimization suggestions
type OptimizationSuggestion = {
  sectionId: string;
  sectionTitle: string;
  type: "remove" | "simplify" | "merge" | "restructure";
  priority: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
  originalText: string;
  optimizedText?: string;
  tokenSavings?: number;
};

type OptimizeResponse = {
  suggestions: OptimizationSuggestion[];
  summary: string;
  currentTokenEstimate: number;
  potentialTokenEstimate: number;
  savingsPercent: number;
};

type PromptPreviewPanelProps = {
  blocks: PromptBlock[];
  modifiers: PromptModifier[];
  compositions: PromptComposition[];
  previewContext: PromptContext;
  onContextChange: (context: PromptContext) => void;
  previewPrompt: string;
  onBlockChange: (blockId: string, variants: Record<string, string>) => void;
};

const contextLabels: Record<PromptContext, string> = {
  questions: "Questions",
  skills: "Skills",
  analysis: "Analysis",
  chat: "Chat",
  contracts: "Contracts",
  skill_organize: "Skill Org",
  customer_profile: "Customers",
  prompt_optimize: "Optimize",
};

const contextColors: Record<PromptContext, { bg: string; border: string; text: string }> = {
  questions: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  skills: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
  analysis: { bg: "#fefce8", border: "#fde68a", text: "#ca8a04" },
  chat: { bg: "#faf5ff", border: "#e9d5ff", text: "#9333ea" },
  contracts: { bg: "#fff1f2", border: "#fecdd3", text: "#e11d48" },
  skill_organize: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669" },
  customer_profile: { bg: "#fef3c7", border: "#fcd34d", text: "#b45309" },
  prompt_optimize: { bg: "#f0f9ff", border: "#7dd3fc", text: "#0284c7" },
};

export default function PromptPreviewPanel({
  blocks,
  modifiers,
  compositions,
  previewContext,
  onContextChange,
  previewPrompt,
  onBlockChange,
}: PromptPreviewPanelProps) {
  // Optimization state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // Build sections for optimization analysis
  const buildSectionsForOptimize = () => {
    const composition = compositions.find(c => c.context === previewContext) || compositions[0];
    return composition.blockIds.map(blockId => {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return null;
      const text = block.variants[previewContext] || block.variants.default || "";
      return {
        id: block.id,
        title: block.name,
        text,
        enabled: text.trim().length > 0,
      };
    }).filter(Boolean) as { id: string; title: string; text: string; enabled: boolean }[];
  };

  // Build optimized preview with selected suggestions applied
  const buildOptimizedPreview = (): string => {
    if (!optimizeResult) return previewPrompt;

    const composition = compositions.find(c => c.context === previewContext) || compositions[0];

    // Create a map of block ID -> optimized text for selected suggestions
    const optimizations = new Map<string, string | null>();
    for (const [index, suggestion] of optimizeResult.suggestions.entries()) {
      if (!selectedSuggestions.has(index)) continue;

      if (suggestion.type === "remove") {
        optimizations.set(suggestion.sectionId, null);
      } else if (suggestion.optimizedText) {
        optimizations.set(suggestion.sectionId, suggestion.optimizedText);
      }
    }

    // Build prompt with optimizations applied
    const parts: string[] = [];
    for (const blockId of composition.blockIds) {
      const block = blocks.find(b => b.id === blockId);
      if (!block) continue;

      let text: string;
      if (optimizations.has(blockId)) {
        const optimized = optimizations.get(blockId);
        if (optimized === null || optimized === undefined) continue;
        text = optimized;
      } else {
        text = block.variants[previewContext] || block.variants.default || "";
      }

      if (text.trim()) {
        parts.push(text);
      }
    }

    return parts.join("\n\n");
  };

  const optimizedPreview = buildOptimizedPreview();

  // Run optimization analysis
  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizeError(null);
    setOptimizeResult(null);

    try {
      const sections = buildSectionsForOptimize();
      const response = await fetch("/api/prompts/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptType: contextLabels[previewContext],
          sections,
          outputFormat: "plain_text",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Optimization failed");
      }

      const result: OptimizeResponse = await response.json();
      setOptimizeResult(result);
      setSelectedSuggestions(new Set(result.suggestions.map((_, i) => i)));
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Toggle suggestion selection
  const toggleSuggestion = (index: number) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Apply selected suggestions
  const handleApplySuggestions = () => {
    if (!optimizeResult) return;

    for (const [index, suggestion] of optimizeResult.suggestions.entries()) {
      if (!selectedSuggestions.has(index)) continue;

      const block = blocks.find(b => b.id === suggestion.sectionId);
      if (!block) continue;

      if (suggestion.type === "remove") {
        onBlockChange(block.id, { ...block.variants, [previewContext]: "" });
      } else if (suggestion.optimizedText && (suggestion.type === "simplify" || suggestion.type === "restructure")) {
        onBlockChange(block.id, { ...block.variants, [previewContext]: suggestion.optimizedText });
      }
    }

    setOptimizeResult(null);
    setSelectedSuggestions(new Set());
  };

  // Priority badge colors
  const priorityColors = {
    high: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    medium: { bg: "#fefce8", border: "#fde68a", text: "#ca8a04" },
    low: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
  };

  // Estimate tokens (rough: 4 chars ≈ 1 token)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  const currentTokens = estimateTokens(previewPrompt);
  const optimizedTokens = optimizeResult ? estimateTokens(optimizedPreview) : currentTokens;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#fff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
            Live Preview
          </h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              ~{currentTokens} tokens
            </span>
            <button
              onClick={handleOptimize}
              disabled={isOptimizing}
              style={{
                padding: "4px 10px",
                backgroundColor: isOptimizing ? "#94a3b8" : "#f0f9ff",
                color: isOptimizing ? "#fff" : "#0284c7",
                border: "1px solid #7dd3fc",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: isOptimizing ? "not-allowed" : "pointer",
              }}
            >
              {isOptimizing ? "Analyzing..." : "Optimize"}
            </button>
          </div>
        </div>

        {/* Context Tabs */}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {compositions.map((comp) => (
            <button
              key={comp.context}
              onClick={() => {
                onContextChange(comp.context);
                setOptimizeResult(null);
                setSelectedSuggestions(new Set());
              }}
              style={{
                padding: "4px 10px",
                backgroundColor: previewContext === comp.context ? contextColors[comp.context].text : "#fff",
                border: `1px solid ${contextColors[comp.context].border}`,
                color: previewContext === comp.context ? "#fff" : contextColors[comp.context].text,
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: previewContext === comp.context ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {contextLabels[comp.context]}
            </button>
          ))}
        </div>
      </div>

      {/* Optimization Error */}
      {optimizeError && (
        <div style={{
          padding: "10px 16px",
          backgroundColor: "#fef2f2",
          borderBottom: "1px solid #fecaca",
          color: "#dc2626",
          fontSize: "13px",
        }}>
          {optimizeError}
        </div>
      )}

      {/* Optimization Suggestions Panel */}
      {optimizeResult && optimizeResult.suggestions.length > 0 && (
        <div style={{
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#fff",
          maxHeight: "300px",
          overflowY: "auto",
        }}>
          {/* Summary */}
          <div style={{
            padding: "10px 16px",
            backgroundColor: "#f0f9ff",
            borderBottom: "1px solid #7dd3fc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0369a1" }}>
                {optimizeResult.suggestions.length} suggestions
              </span>
              <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>
                {selectedSuggestions.size} selected
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {currentTokens} → {optimizedTokens}
              </span>
              <button
                onClick={handleApplySuggestions}
                disabled={selectedSuggestions.size === 0}
                style={{
                  padding: "4px 10px",
                  backgroundColor: selectedSuggestions.size === 0 ? "#cbd5e1" : "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: selectedSuggestions.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setOptimizeResult(null);
                  setSelectedSuggestions(new Set());
                }}
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Suggestions List */}
          <div style={{ padding: "8px" }}>
            {optimizeResult.suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => toggleSuggestion(index)}
                style={{
                  padding: "8px 10px",
                  marginBottom: "4px",
                  borderRadius: "6px",
                  backgroundColor: selectedSuggestions.has(index) ? "#f0f9ff" : "#fff",
                  border: `1px solid ${selectedSuggestions.has(index) ? "#7dd3fc" : "#e2e8f0"}`,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(index)}
                    onChange={() => toggleSuggestion(index)}
                    style={{ width: "14px", height: "14px" }}
                  />
                  <span
                    style={{
                      padding: "1px 5px",
                      borderRadius: "3px",
                      fontSize: "10px",
                      fontWeight: 600,
                      backgroundColor: priorityColors[suggestion.priority].bg,
                      color: priorityColors[suggestion.priority].text,
                      textTransform: "uppercase",
                    }}
                  >
                    {suggestion.priority}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#1e293b" }}>
                    {suggestion.sectionTitle}
                  </span>
                  {suggestion.tokenSavings && suggestion.tokenSavings > 0 && (
                    <span style={{ fontSize: "10px", color: "#16a34a", marginLeft: "auto" }}>
                      -{suggestion.tokenSavings}
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0 22px", fontSize: "11px", color: "#64748b" }}>
                  {suggestion.issue}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {optimizeResult && optimizeResult.suggestions.length > 0 ? (
          // Side by side when optimizing
          <>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #374151" }}>
              <div style={{
                padding: "6px 12px",
                backgroundColor: "#334155",
                fontSize: "10px",
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
              }}>
                Current
              </div>
              <pre style={{
                flex: 1,
                margin: 0,
                padding: "12px",
                backgroundColor: "#1e293b",
                color: "#e2e8f0",
                fontSize: "11px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                overflowY: "auto",
              }}>
                {previewPrompt}
              </pre>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{
                padding: "6px 12px",
                backgroundColor: "#0f4c3a",
                fontSize: "10px",
                fontWeight: 600,
                color: "#86efac",
                textTransform: "uppercase",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <span>Optimized</span>
                {selectedSuggestions.size > 0 && (
                  <span style={{ fontWeight: 400, color: "#4ade80" }}>
                    {selectedSuggestions.size} changes
                  </span>
                )}
              </div>
              <pre style={{
                flex: 1,
                margin: 0,
                padding: "12px",
                backgroundColor: "#14332a",
                color: "#bbf7d0",
                fontSize: "11px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                overflowY: "auto",
              }}>
                {optimizedPreview}
              </pre>
            </div>
          </>
        ) : (
          // Single preview when not optimizing
          <pre style={{
            flex: 1,
            margin: 0,
            padding: "16px",
            backgroundColor: "#1e293b",
            color: "#e2e8f0",
            fontSize: "12px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            overflowY: "auto",
          }}>
            {previewPrompt}
          </pre>
        )}
      </div>
    </div>
  );
}
