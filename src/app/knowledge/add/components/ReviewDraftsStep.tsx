"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Eye, Edit3, MessageSquare, Send, Loader2, X } from "lucide-react";
import { diffLines, Change } from "diff";
import { type SkillGroup } from "@/stores/bulk-import-store";
import { styles, getGroupStatusStyle } from "./styles";

interface ClarifyMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ReviewDraftsStepProps = {
  skillGroups: SkillGroup[];
  readyForReviewCount: number;
  reviewedCount: number;
  previewGroup: SkillGroup | null;
  setPreviewGroup: (group: SkillGroup | null) => void;
  editingDraft: { groupId: string; field: "title" | "content" } | null;
  setEditingDraft: (editing: { groupId: string; field: "title" | "content" } | null) => void;
  approveDraft: (id: string) => void;
  approveAllDrafts: () => void;
  rejectDraft: (id: string) => void;
  updateDraftField: (groupId: string, field: "title" | "content", value: string) => void;
  onSaveReviewedDrafts: () => void;
  onBack: () => void;
  promptForContent: (options: { defaultValue: string }) => Promise<string | null>;
};

export default function ReviewDraftsStep({
  skillGroups,
  readyForReviewCount,
  reviewedCount,
  previewGroup,
  setPreviewGroup,
  editingDraft,
  setEditingDraft,
  approveDraft,
  approveAllDrafts,
  rejectDraft,
  updateDraftField,
  onSaveReviewedDrafts,
  onBack,
  promptForContent,
}: ReviewDraftsStepProps) {
  // Clarify state - keyed by group ID
  const [clarifyOpenFor, setClarifyOpenFor] = useState<string | null>(null);
  const [clarifyMessages, setClarifyMessages] = useState<Record<string, ClarifyMessage[]>>({});
  const [clarifyInput, setClarifyInput] = useState("");
  const [isClarifying, setIsClarifying] = useState(false);
  const clarifyEndRef = useRef<HTMLDivElement>(null);

  const handleClarifySubmit = async (group: SkillGroup) => {
    if (!clarifyInput.trim() || isClarifying) return;

    const userMessage: ClarifyMessage = { role: 'user', content: clarifyInput.trim() };
    setClarifyMessages(prev => ({
      ...prev,
      [group.id]: [...(prev[group.id] || []), userMessage],
    }));
    const inputText = clarifyInput.trim();
    setClarifyInput("");
    setIsClarifying(true);

    try {
      const systemPrompt = `You are explaining why you generated specific content for a knowledge skill.

Skill being reviewed:
- Title: "${group.draft?.title || group.skillTitle}"
- Content: "${group.draft?.content || ''}"
- Source URLs: ${group.urls.join(', ') || 'None'}
${group.documents && group.documents.length > 0 ? `- Source Documents: ${group.documents.map(d => d.filename).join(', ')}` : ''}
${group.type === 'update' ? `- This is an UPDATE to an existing skill` : '- This is a NEW skill'}
${group.draft?.changeHighlights ? `- Changes made: ${group.draft.changeHighlights.join('; ')}` : ''}

The user is reviewing this generated content and asking questions. Your role is to:
1. Explain WHY you wrote specific content the way you did
2. Cite which source URL or document contains the information
3. If you're unsure or made an inference, be honest about it
4. If the user points out an error, acknowledge it and suggest a correction

Be direct and helpful. If something was inferred rather than directly stated in the sources, say so clearly.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: [
            ...(clarifyMessages[group.id] || []).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: inputText },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const json = await response.json();
      const content = json.data?.content ?? json.content;
      const assistantContent = (content as { type: string; text?: string }[])
        .filter(block => block.type === 'text')
        .map(block => block.text ?? '')
        .join('\n');

      setClarifyMessages(prev => ({
        ...prev,
        [group.id]: [...(prev[group.id] || []), { role: 'assistant', content: assistantContent }],
      }));

      setTimeout(() => clarifyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      setClarifyMessages(prev => ({
        ...prev,
        [group.id]: [...(prev[group.id] || []), {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
        }],
      }));
    } finally {
      setIsClarifying(false);
    }
  };

  // Simple diff visualization
  const renderDiff = (original: string | undefined, updated: string) => {
    if (!original) {
      return (
        <div style={{ backgroundColor: "#f0fdf4", padding: "12px", borderRadius: "6px", fontSize: "13px", whiteSpace: "pre-wrap" }}>
          <span style={{ color: "#166534" }}>{updated}</span>
        </div>
      );
    }

    const diff = diffLines(original, updated);

    return (
      <div style={{ fontSize: "12px", fontFamily: "monospace", lineHeight: "1.5", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", overflow: "auto", maxHeight: "400px" }}>
        {diff.map((part: Change, index: number) => {
          if (part.added) {
            return (
              <div key={index} style={{ backgroundColor: "#dcfce7", borderLeft: "3px solid #22c55e", paddingLeft: "8px", whiteSpace: "pre-wrap" }}>
                {part.value}
              </div>
            );
          } else if (part.removed) {
            return (
              <div key={index} style={{ backgroundColor: "#fee2e2", borderLeft: "3px solid #ef4444", paddingLeft: "8px", whiteSpace: "pre-wrap", textDecoration: "line-through", opacity: 0.7 }}>
                {part.value}
              </div>
            );
          } else {
            const lines = part.value.split("\n");
            if (lines.length > 6) {
              return (
                <div key={index} style={{ color: "#64748b", whiteSpace: "pre-wrap" }}>
                  {lines.slice(0, 3).join("\n")}
                  {"\n"}
                  <div style={{ color: "#94a3b8", fontStyle: "italic", padding: "4px 0" }}>... {lines.length - 6} unchanged lines ...</div>
                  {lines.slice(-3).join("\n")}
                </div>
              );
            }
            return (
              <div key={index} style={{ color: "#64748b", whiteSpace: "pre-wrap" }}>
                {part.value}
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0 }}>Review Generated Content</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          {reviewedCount > 0 && (
            <button onClick={onSaveReviewedDrafts} style={{ padding: "10px 20px", backgroundColor: "#15803d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
              Save {reviewedCount} Skill{reviewedCount !== 1 ? "s" : ""} →
            </button>
          )}
          <button onClick={onBack} style={{ padding: "10px 20px", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>
            <ArrowLeft size={14} style={{ marginRight: "4px" }} /> Back
          </button>
        </div>
      </div>

      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
        Review each skill&apos;s content before saving. Click to expand and see the full diff.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
          {readyForReviewCount > 0 && <span style={{ color: "#ca8a04" }}><strong>{readyForReviewCount}</strong> pending review</span>}
          {reviewedCount > 0 && <span style={{ color: "#15803d" }}><strong>{reviewedCount}</strong> approved</span>}
        </div>
        {readyForReviewCount > 0 && (
          <button onClick={approveAllDrafts} style={{ padding: "6px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
            Approve All
          </button>
        )}
      </div>

      {/* Draft Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {skillGroups.filter(g => g.draft || g.status === "error").map((group) => (
          <div key={group.id} style={{ border: `1px solid ${getGroupStatusStyle(group.status).borderColor}`, borderRadius: "8px", backgroundColor: getGroupStatusStyle(group.status).backgroundColor, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: group.type === "create" ? "#dbeafe" : "#fef3c7", color: group.type === "create" ? "#1e40af" : "#92400e" }}>
                    {group.type === "create" ? "NEW SKILL" : "UPDATE"}
                  </div>
                  {group.draft?.hasChanges === false && (
                    <div style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      No changes needed
                    </div>
                  )}
                </div>

                {/* Editable Title */}
                {editingDraft?.groupId === group.id && editingDraft.field === "title" ? (
                  <input
                    type="text"
                    value={group.draft?.title || ""}
                    onChange={(e) => updateDraftField(group.id, "title", e.target.value)}
                    onBlur={() => setEditingDraft(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingDraft(null)}
                    autoFocus
                    style={{ fontSize: "18px", fontWeight: 600, border: "1px solid #2563eb", borderRadius: "4px", padding: "4px 8px", width: "100%" }}
                  />
                ) : (
                  <h4 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => setEditingDraft({ groupId: group.id, field: "title" })}>
                    {group.draft?.title || group.skillTitle}
                    <Edit3 size={14} style={{ color: "#94a3b8" }} />
                  </h4>
                )}

                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                  {group.urls.length} source URL{group.urls.length !== 1 ? "s" : ""}
                </div>

                {/* Change highlights */}
                {group.draft?.changeHighlights && group.draft.changeHighlights.length > 0 && (
                  <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>What changed:</div>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#475569" }}>
                      {group.draft.changeHighlights.map((highlight, idx) => (
                        <li key={idx}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {(group.status === "ready_for_review" || group.status === "reviewed") && (
                  <>
                    <button onClick={() => setPreviewGroup(previewGroup?.id === group.id ? null : group)} style={{ padding: "8px 12px", backgroundColor: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Eye size={14} /> {previewGroup?.id === group.id ? "Hide" : "Preview"}
                    </button>
                    {group.status === "ready_for_review" && (
                      <>
                        <button onClick={() => approveDraft(group.id)} style={{ padding: "8px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                          Approve
                        </button>
                        <button onClick={() => rejectDraft(group.id)} style={{ padding: "8px 12px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                          Skip
                        </button>
                      </>
                    )}
                    {group.status === "reviewed" && (
                      <span style={{ padding: "8px 12px", color: "#15803d", fontSize: "13px", fontWeight: 500 }}>✓ Approved</span>
                    )}
                  </>
                )}
                {group.status === "error" && (
                  <span style={{ color: "#dc2626", fontSize: "13px" }}>{group.error}</span>
                )}
              </div>
            </div>

            {/* Preview/Diff Panel */}
            {previewGroup?.id === group.id && group.draft && (
              <div style={{ borderTop: "1px solid #e2e8f0", padding: "16px", backgroundColor: "#f8fafc" }}>
                {/* Source URLs */}
                {group.urls.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
                      Source URLs:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
                      {group.urls.map((url, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Content Diff */}
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
                    Content {group.type === "update" ? (group.draft.hasChanges ? "Changes" : "") : "Preview"}:
                  </div>
                  {group.type === "update" ? (
                    group.draft.hasChanges === false ? (
                      <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "16px", textAlign: "center" }}>
                        <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>
                          ✓ The existing skill already covers this content
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                          No updates are needed. The source material doesn&apos;t contain new information.
                        </div>
                      </div>
                    ) : (
                      renderDiff(group.originalContent, group.draft.content)
                    )
                  ) : (
                    <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", maxHeight: "400px", overflow: "auto" }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "13px", fontFamily: "inherit" }}>{group.draft.content}</pre>
                    </div>
                  )}
                </div>

                {/* Transparency Details */}
                {(group.draft?.reasoning || group.draft?.inference || group.draft?.sources) && (
                  <div style={{
                    marginTop: "16px",
                    padding: "12px",
                    backgroundColor: "#eff6ff",
                    border: "1px solid #93c5fd",
                    borderRadius: "6px",
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e40af", marginBottom: "10px", textTransform: "uppercase" }}>
                      Transparency Report
                    </div>

                    {group.draft.reasoning && (
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>Reasoning:</div>
                        <div style={{ fontSize: "13px", color: "#1e3a5f", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                          {group.draft.reasoning}
                        </div>
                      </div>
                    )}

                    {group.draft.inference && (
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>Inference:</div>
                        <div style={{
                          fontSize: "13px",
                          color: group.draft.inference.toLowerCase() === "none" ? "#166534" : "#ca8a04",
                          whiteSpace: "pre-wrap",
                          lineHeight: "1.5",
                          fontWeight: group.draft.inference.toLowerCase() === "none" ? 500 : 400,
                        }}>
                          {group.draft.inference}
                        </div>
                      </div>
                    )}

                    {group.draft.sources && (
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>Sources:</div>
                        <div style={{ fontSize: "13px", color: "#1e3a5f", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                          {group.draft.sources}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={async () => {
                      const newContent = await promptForContent({ defaultValue: group.draft?.content || "" });
                      if (newContent !== null) {
                        updateDraftField(group.id, "content", newContent);
                      }
                    }}
                    style={{ padding: "8px 12px", backgroundColor: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Edit3 size={14} style={{ marginRight: "4px" }} /> Edit Content
                  </button>
                  <button
                    onClick={() => setClarifyOpenFor(clarifyOpenFor === group.id ? null : group.id)}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: clarifyOpenFor === group.id ? "#dbeafe" : "#fff",
                      color: clarifyOpenFor === group.id ? "#1e40af" : "#475569",
                      border: `1px solid ${clarifyOpenFor === group.id ? "#93c5fd" : "#cbd5e1"}`,
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <MessageSquare size={14} style={{ marginRight: "4px" }} />
                    {clarifyOpenFor === group.id ? "Hide Chat" : "Ask Why"}
                  </button>
                </div>

                {/* Clarify Chat Panel */}
                {clarifyOpenFor === group.id && (
                  <div style={{
                    marginTop: "12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    backgroundColor: "#fff",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "10px 12px",
                      backgroundColor: "#0ea5e9",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <span>Ask about this content</span>
                      <button
                        onClick={() => setClarifyOpenFor(null)}
                        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "2px" }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                      padding: "12px",
                      maxHeight: "250px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      backgroundColor: "#f8fafc",
                    }}>
                      {(!clarifyMessages[group.id] || clarifyMessages[group.id].length === 0) && (
                        <div style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>
                          Ask about the generated content. For example:
                          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                            <li>&quot;Why did you write it this way?&quot;</li>
                            <li>&quot;Where did this information come from?&quot;</li>
                            <li>&quot;Is this accurate?&quot;</li>
                          </ul>
                        </div>
                      )}
                      {(clarifyMessages[group.id] || []).map((msg, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            maxWidth: "100%",
                            backgroundColor: msg.role === 'user' ? "#0ea5e9" : "#fff",
                            color: msg.role === 'user' ? "#fff" : "#0f172a",
                            border: msg.role === 'assistant' ? "1px solid #e2e8f0" : "none",
                            alignSelf: msg.role === 'user' ? "flex-end" : "flex-start",
                          }}
                        >
                          <div style={{ whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: "1.5" }}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isClarifying && clarifyOpenFor === group.id && (
                        <div style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}>
                          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                          <span style={{ color: "#64748b", fontSize: "13px" }}>Thinking...</span>
                        </div>
                      )}
                      <div ref={clarifyEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                      padding: "10px 12px",
                      borderTop: "1px solid #e2e8f0",
                      backgroundColor: "#fff",
                      display: "flex",
                      gap: "8px",
                    }}>
                      <input
                        type="text"
                        value={clarifyInput}
                        onChange={(e) => setClarifyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleClarifySubmit(group);
                          }
                        }}
                        placeholder="Ask about this content..."
                        disabled={isClarifying}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "13px",
                        }}
                      />
                      <button
                        onClick={() => handleClarifySubmit(group)}
                        disabled={!clarifyInput.trim() || isClarifying}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: clarifyInput.trim() && !isClarifying ? "#0ea5e9" : "#cbd5e1",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: clarifyInput.trim() && !isClarifying ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
