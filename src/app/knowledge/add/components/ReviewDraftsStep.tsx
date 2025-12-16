"use client";

import { ArrowLeft, Eye, Edit3 } from "lucide-react";
import { diffLines, Change } from "diff";
import { type SkillGroup } from "@/stores/bulk-import-store";
import { styles, getGroupStatusStyle } from "./styles";

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

                {/* Edit Content Button */}
                <div style={{ marginTop: "12px" }}>
                  <button
                    onClick={async () => {
                      const newContent = await promptForContent({ defaultValue: group.draft?.content || "" });
                      if (newContent !== null) {
                        updateDraftField(group.id, "content", newContent);
                      }
                    }}
                    style={{ padding: "8px 12px", backgroundColor: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                  >
                    <Edit3 size={14} style={{ marginRight: "4px" }} /> Edit Content
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
