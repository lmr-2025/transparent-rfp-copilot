"use client";

import { useState } from "react";
import { PromptBlock, PromptModifier, PromptContext, PromptComposition, PromptTier, tierConfig } from "@/lib/promptBlocks";

type PromptBlocksEditorProps = {
  blocks: PromptBlock[];
  modifiers: PromptModifier[];
  compositions: PromptComposition[];
  onBlockChange: (blockId: string, variants: Record<string, string>) => void;
  onModifierChange: (modifierId: string, content: string) => void;
  saving?: boolean;
  previewContext: PromptContext;
};

// Tier badge component
function TierBadge({ tier }: { tier?: PromptTier }) {
  const effectiveTier = tier ?? 3; // Default to Open if not specified
  const config = tierConfig[effectiveTier];
  if (!config) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        backgroundColor: config.color.bg,
        border: `1px solid ${config.color.border}`,
        color: config.color.text,
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 500,
      }}
      title={config.description}
    >
      {config.icon} {config.label}
    </span>
  );
}

// Warning banner for tier 1 and 2 blocks
function TierWarning({ tier }: { tier?: PromptTier }) {
  const effectiveTier = tier ?? 3;
  const config = tierConfig[effectiveTier];
  if (!config || !config.warning) return null;

  return (
    <div
      style={{
        padding: "10px 12px",
        backgroundColor: config.color.bg,
        border: `1px solid ${config.color.border}`,
        borderRadius: "6px",
        marginBottom: "12px",
        fontSize: "12px",
        color: config.color.text,
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
      }}
    >
      <span style={{ fontSize: "14px" }}>{config.icon}</span>
      <span>{config.warning}</span>
    </div>
  );
}

const contextLabels: Record<PromptContext, string> = {
  questions: "Question Answering",
  skills: "Skill Building",
  analysis: "Document Analysis",
  chat: "Knowledge Chat",
  contracts: "Contract Analysis",
  skill_organize: "Skill Organization",
  skill_analyze: "URL/Doc Analysis",
  skill_refresh: "Skill Refresh",
  skill_analyze_rfp: "RFP Import",
  customer_profile: "Customer Profiles",
  prompt_optimize: "Prompt Optimization",
};

const contextColors: Record<PromptContext, { bg: string; border: string; text: string }> = {
  questions: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  skills: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
  analysis: { bg: "#fefce8", border: "#fde68a", text: "#ca8a04" },
  chat: { bg: "#faf5ff", border: "#e9d5ff", text: "#9333ea" },
  contracts: { bg: "#fff1f2", border: "#fecdd3", text: "#e11d48" },
  skill_organize: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669" },
  skill_analyze: { bg: "#f0fdfa", border: "#99f6e4", text: "#0d9488" },
  skill_refresh: { bg: "#fdf4ff", border: "#f5d0fe", text: "#a855f7" },
  skill_analyze_rfp: { bg: "#fef9c3", border: "#fde047", text: "#a16207" },
  customer_profile: { bg: "#fef3c7", border: "#fcd34d", text: "#b45309" },
  prompt_optimize: { bg: "#f0f9ff", border: "#7dd3fc", text: "#0284c7" },
};

export default function PromptBlocksEditor({
  blocks,
  modifiers,
  compositions,
  onBlockChange,
  onModifierChange,
  saving = false,
  previewContext,
}: PromptBlocksEditorProps) {
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [expandedModifier, setExpandedModifier] = useState<string | null>(null);

  // Get all contexts that use a given block
  const getBlockContexts = (blockId: string): PromptContext[] => {
    return compositions
      .filter(c => c.blockIds.includes(blockId))
      .map(c => c.context);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Blocks Section */}
      <div>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
          Building Blocks
        </h2>
        <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#64748b" }}>
          Each block can have different content for different contexts. Click to expand and edit.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {blocks.map((block) => {
            const isExpanded = expandedBlock === block.id;
            const contexts = getBlockContexts(block.id);
            const isUsedInPreview = contexts.includes(previewContext);

            return (
              <div
                key={block.id}
                style={{
                  border: isUsedInPreview ? `2px solid ${contextColors[previewContext].border}` : "1px solid #e2e8f0",
                  borderRadius: "10px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                {/* Block Header */}
                <div
                  onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    backgroundColor: isUsedInPreview ? contextColors[previewContext].bg : "#f8fafc",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
                        {block.name}
                      </span>
                      <TierBadge tier={block.tier} />
                      {isUsedInPreview && (
                        <span style={{
                          padding: "2px 6px",
                          backgroundColor: contextColors[previewContext].text,
                          color: "#fff",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}>
                          IN PREVIEW
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      {block.description}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                      {contexts.map((ctx) => (
                        <span
                          key={ctx}
                          style={{
                            padding: "2px 8px",
                            backgroundColor: ctx === previewContext ? contextColors[ctx].text : contextColors[ctx].bg,
                            border: `1px solid ${contextColors[ctx].border}`,
                            color: ctx === previewContext ? "#fff" : contextColors[ctx].text,
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 500,
                          }}
                        >
                          {contextLabels[ctx]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "12px",
                    color: "#64748b",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}>
                    ▼
                  </span>
                </div>

                {/* Block Content - Variants */}
                {isExpanded && (
                  <div style={{ padding: "16px", borderTop: "1px solid #e2e8f0" }}>
                    {/* Tier warning for locked/caution blocks */}
                    <TierWarning tier={block.tier} />

                    {/* Default variant */}
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#64748b",
                        marginBottom: "6px",
                        textTransform: "uppercase",
                      }}>
                        Default (fallback)
                      </label>
                      <textarea
                        value={block.variants.default || ""}
                        onChange={(e) => {
                          onBlockChange(block.id, { ...block.variants, default: e.target.value });
                        }}
                        disabled={saving}
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          padding: "10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontFamily: "monospace",
                          fontSize: "13px",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    {/* Context-specific variants */}
                    {contexts.map((ctx) => (
                      <div key={ctx} style={{ marginBottom: "16px" }}>
                        <label style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          marginBottom: "6px",
                        }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              backgroundColor: ctx === previewContext ? contextColors[ctx].text : contextColors[ctx].bg,
                              border: `1px solid ${contextColors[ctx].border}`,
                              color: ctx === previewContext ? "#fff" : contextColors[ctx].text,
                              borderRadius: "4px",
                            }}
                          >
                            {contextLabels[ctx]}
                          </span>
                          {!block.variants[ctx] && (
                            <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                              (using default)
                            </span>
                          )}
                        </label>
                        <textarea
                          value={block.variants[ctx] || ""}
                          onChange={(e) => {
                            onBlockChange(block.id, { ...block.variants, [ctx]: e.target.value });
                          }}
                          placeholder={`Leave empty to use default. Or customize for ${contextLabels[ctx]}...`}
                          disabled={saving}
                          style={{
                            width: "100%",
                            minHeight: "100px",
                            padding: "10px",
                            borderRadius: "6px",
                            border: ctx === previewContext ? `2px solid ${contextColors[ctx].border}` : "1px solid #cbd5e1",
                            fontFamily: "monospace",
                            fontSize: "13px",
                            resize: "vertical",
                            backgroundColor: block.variants[ctx] ? "#fff" : "#f8fafc",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modifiers Section */}
      <div>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
          Runtime Modifiers
        </h2>
        <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#64748b" }}>
          Added to prompts based on user selection (mode or domain focus).
        </p>

        {/* Modes */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#64748b" }}>
          Modes
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
          {modifiers.filter(m => m.type === "mode").map((mod) => {
            const isExpanded = expandedModifier === mod.id;
            return (
              <div
                key={mod.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                <div
                  onClick={() => setExpandedModifier(isExpanded ? null : mod.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    backgroundColor: "#f0f9ff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 500, fontSize: "14px", color: "#0369a1" }}>
                      {mod.name}
                    </span>
                    <TierBadge tier={mod.tier} />
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ padding: "12px" }}>
                    <TierWarning tier={mod.tier} />
                    <textarea
                      value={mod.content}
                      onChange={(e) => onModifierChange(mod.id, e.target.value)}
                      disabled={saving}
                      style={{
                        width: "100%",
                        minHeight: "80px",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontFamily: "monospace",
                        fontSize: "13px",
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Domains */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#64748b" }}>
          Domain Focus
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {modifiers.filter(m => m.type === "domain").map((mod) => {
            const isExpanded = expandedModifier === mod.id;
            return (
              <div
                key={mod.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                <div
                  onClick={() => setExpandedModifier(isExpanded ? null : mod.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    backgroundColor: "#fefce8",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 500, fontSize: "14px", color: "#a16207" }}>
                      {mod.name}
                    </span>
                    <TierBadge tier={mod.tier} />
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ padding: "12px" }}>
                    <TierWarning tier={mod.tier} />
                    <textarea
                      value={mod.content}
                      onChange={(e) => onModifierChange(mod.id, e.target.value)}
                      disabled={saving}
                      style={{
                        width: "100%",
                        minHeight: "80px",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontFamily: "monospace",
                        fontSize: "13px",
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
