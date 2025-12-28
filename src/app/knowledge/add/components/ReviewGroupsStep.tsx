"use client";

import { ChevronDown, ChevronUp, FileText, Lightbulb, AlertTriangle } from "lucide-react";
import { type SkillGroup } from "@/stores/bulk-import-store";
import { Skill } from "@/types/skill";
import { styles, getGroupStatusStyle } from "./styles";

type ReviewGroupsStepProps = {
  skillGroups: SkillGroup[];
  setSkillGroups: (groups: SkillGroup[]) => void;
  updateSkillGroup: (groupId: string, updates: Partial<SkillGroup>) => void;
  expandedGroups: Set<string>;
  toggleGroupExpanded: (id: string) => void;
  toggleGroupApproval: (id: string) => void;
  rejectGroup: (id: string) => void;
  approveAll: () => void;
  moveUrl: (fromGroupId: string, url: string, toGroupId: string) => void;
  createNewGroupFromUrl: (groupId: string, url: string, newTitle: string) => void;
  pendingCount: number;
  approvedCount: number;
  skills: Skill[];
  onGenerateDrafts: () => void;
  onReset: () => void;
  promptForSkillName: () => Promise<string | null>;
};

export default function ReviewGroupsStep({
  skillGroups,
  setSkillGroups,
  updateSkillGroup,
  expandedGroups,
  toggleGroupExpanded,
  toggleGroupApproval,
  rejectGroup,
  approveAll,
  moveUrl,
  createNewGroupFromUrl,
  pendingCount,
  approvedCount,
  skills,
  onGenerateDrafts,
  onReset,
  promptForSkillName,
}: ReviewGroupsStepProps) {
  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0 }}>Review Source Groupings</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          {approvedCount > 0 && (
            <button
              onClick={onGenerateDrafts}
              style={{
                padding: "10px 20px",
                backgroundColor: "#15803d",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Generate Content for {approvedCount} →
            </button>
          )}
          <button onClick={onReset} style={{ padding: "10px 20px", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>
            Start Over
          </button>
        </div>
      </div>

      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
        Approve groups to generate AI content. You&apos;ll review the content before it&apos;s saved.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
          <span><strong>{skillGroups.length}</strong> groups</span>
          {pendingCount > 0 && <span style={{ color: "#64748b" }}><strong>{pendingCount}</strong> pending</span>}
          {approvedCount > 0 && <span style={{ color: "#15803d" }}><strong>{approvedCount}</strong> approved</span>}
        </div>
        {pendingCount > 0 && (
          <button onClick={approveAll} style={{ padding: "6px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
            Approve All
          </button>
        )}
      </div>

      {/* Group Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {skillGroups.map((group) => (
          <div key={group.id} style={{ border: `1px solid ${getGroupStatusStyle(group.status).borderColor}`, borderRadius: "8px", backgroundColor: getGroupStatusStyle(group.status).backgroundColor, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => toggleGroupExpanded(group.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <div style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: group.type === "create" ? "#dbeafe" : "#fef3c7", color: group.type === "create" ? "#1e40af" : "#92400e" }}>
                  {group.type === "create" ? "CREATE" : "UPDATE"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "15px" }}>{group.skillTitle}</div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    {group.urls.length > 0 && `${group.urls.length} URL${group.urls.length !== 1 ? "s" : ""}`}
                    {group.urls.length > 0 && (group.documents?.length || 0) > 0 && " + "}
                    {(group.documents?.length || 0) > 0 && `${group.documents!.length} doc${group.documents!.length !== 1 ? "s" : ""}`}
                  </div>
                  {group.reason && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "6px", fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
                      <Lightbulb size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "1px" }} />
                      <span>{group.reason}</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {group.status === "pending" && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); toggleGroupApproval(group.id); }} style={{ padding: "6px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Approve</button>
                    <button onClick={(e) => { e.stopPropagation(); rejectGroup(group.id); }} style={{ padding: "6px 12px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Skip</button>
                  </>
                )}
                {group.status === "approved" && <span style={{ color: "#15803d", fontSize: "13px", fontWeight: 500 }}>✓ Approved</span>}
                {group.status === "rejected" && <span style={{ color: "#dc2626", fontSize: "13px", fontWeight: 500 }}>Skipped</span>}
                {expandedGroups.has(group.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {expandedGroups.has(group.id) && (
              <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.5)" }}>
                {/* URLs */}
                {group.urls.length > 0 && (
                  <>
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", fontWeight: 500 }}>URLs:</div>
                    {group.urls.map((url, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#f8fafc", borderRadius: "4px", fontSize: "12px", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "monospace", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{url}</span>
                        {group.status === "pending" && (
                          <select
                            onChange={async (e) => {
                              const value = e.target.value;
                              e.target.value = "";
                              if (value === "new") {
                                const newTitle = await promptForSkillName();
                                if (newTitle) createNewGroupFromUrl(group.id, url, newTitle);
                              } else if (value.startsWith("existing:")) {
                                const skillId = value.replace("existing:", "");
                                const existingSkill = skills.find(s => s.id === skillId);
                                if (existingSkill) {
                                  const existingGroup = skillGroups.find(g => g.existingSkillId === skillId);
                                  if (existingGroup) {
                                    moveUrl(group.id, url, existingGroup.id);
                                  } else {
                                    const newGroup: SkillGroup = {
                                      id: `group-existing-${skillId}-${Date.now()}`,
                                      type: "update",
                                      skillTitle: existingSkill.title,
                                      existingSkillId: skillId,
                                      urls: [url],
                                      status: "pending",
                                    };
                                    const updatedGroups = skillGroups
                                      .map(g => g.id === group.id ? { ...g, urls: g.urls.filter(u => u !== url) } : g)
                                      .filter(g => g.urls.length > 0 || (g.documents && g.documents.length > 0));
                                    setSkillGroups([...updatedGroups, newGroup]);
                                  }
                                }
                              } else if (value) {
                                moveUrl(group.id, url, value);
                              }
                            }}
                            style={{ marginLeft: "8px", padding: "4px 8px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
                            defaultValue=""
                          >
                            <option value="" disabled>Move to...</option>
                            {skillGroups.filter(g => g.id !== group.id).length > 0 && (
                              <optgroup label="Current groups">
                                {skillGroups.filter(g => g.id !== group.id).map(g => <option key={g.id} value={g.id}>{g.skillTitle}</option>)}
                              </optgroup>
                            )}
                            {skills.filter(s => !skillGroups.some(g => g.existingSkillId === s.id)).length > 0 && (
                              <optgroup label="Existing skills">
                                {skills
                                  .filter(s => !skillGroups.some(g => g.existingSkillId === s.id))
                                  .map(s => <option key={s.id} value={`existing:${s.id}`}>{s.title}</option>)}
                              </optgroup>
                            )}
                            <option value="new">+ New skill</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </>
                )}
                {/* Documents */}
                {group.documents && group.documents.length > 0 && (
                  <>
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", marginTop: group.urls.length > 0 ? "12px" : 0, fontWeight: 500 }}>Documents:</div>
                    {group.documents.map((doc) => (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", backgroundColor: "#f0fdf4", borderRadius: "4px", fontSize: "12px", marginBottom: "4px", border: "1px solid #bbf7d0" }}>
                        <FileText size={14} style={{ color: "#15803d", marginRight: "8px", flexShrink: 0 }} />
                        <span style={{ color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{doc.filename}</span>
                      </div>
                    ))}
                  </>
                )}
                {/* Discrepancy Warning for UPDATE groups */}
                {group.type === "update" && group.discrepancyAnalysis && (
                  <div style={{ marginTop: "12px", padding: "12px", backgroundColor: group.discrepancyAnalysis.changeLevel === "significant" ? "#fef3c7" : group.discrepancyAnalysis.changeLevel === "moderate" ? "#fef9c3" : "#f0fdf4", border: `1px solid ${group.discrepancyAnalysis.changeLevel === "significant" ? "#fbbf24" : group.discrepancyAnalysis.changeLevel === "moderate" ? "#fde047" : "#86efac"}`, borderRadius: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <AlertTriangle size={16} style={{ color: group.discrepancyAnalysis.changeLevel === "significant" ? "#f59e0b" : group.discrepancyAnalysis.changeLevel === "moderate" ? "#eab308" : "#22c55e", flexShrink: 0 }} />
                      <div style={{ fontSize: "13px", fontWeight: 600, color: group.discrepancyAnalysis.changeLevel === "significant" ? "#92400e" : group.discrepancyAnalysis.changeLevel === "moderate" ? "#713f12" : "#166534" }}>
                        Content Discrepancy Detected
                      </div>
                      <div style={{ marginLeft: "auto", fontSize: "11px", padding: "2px 6px", borderRadius: "4px", backgroundColor: group.discrepancyAnalysis.changeLevel === "significant" ? "#fbbf24" : group.discrepancyAnalysis.changeLevel === "moderate" ? "#fde047" : "#86efac", color: "#000", fontWeight: 600 }}>
                        {group.discrepancyAnalysis.changePercentage}% different
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#374151", marginBottom: "8px" }}>
                      {group.discrepancyAnalysis.recommendation}
                    </div>
                    {(group.discrepancyAnalysis.changeSummary.newTopics.length > 0 ||
                      group.discrepancyAnalysis.changeSummary.updatedContent.length > 0 ||
                      group.discrepancyAnalysis.changeSummary.removedContent.length > 0) && (
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>
                        {group.discrepancyAnalysis.changeSummary.newTopics.length > 0 && (
                          <div style={{ marginBottom: "4px" }}>
                            <strong>New:</strong> {group.discrepancyAnalysis.changeSummary.newTopics.join(", ")}
                          </div>
                        )}
                        {group.discrepancyAnalysis.changeSummary.updatedContent.length > 0 && (
                          <div style={{ marginBottom: "4px" }}>
                            <strong>Updated:</strong> {group.discrepancyAnalysis.changeSummary.updatedContent.join(", ")}
                          </div>
                        )}
                        {group.discrepancyAnalysis.changeSummary.removedContent.length > 0 && (
                          <div>
                            <strong>Removed:</strong> {group.discrepancyAnalysis.changeSummary.removedContent.join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Coherence Warning for groups with multiple sources */}
                {group.coherenceAnalysis && !group.coherenceAnalysis.coherent && (
                  <div style={{ marginTop: "12px", padding: "12px", backgroundColor: group.coherenceAnalysis.coherenceLevel === "low" ? "#fee2e2" : "#fef3c7", border: `1px solid ${group.coherenceAnalysis.coherenceLevel === "low" ? "#fca5a5" : "#fbbf24"}`, borderRadius: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <AlertTriangle size={16} style={{ color: group.coherenceAnalysis.coherenceLevel === "low" ? "#dc2626" : "#f59e0b", flexShrink: 0 }} />
                      <div style={{ fontSize: "13px", fontWeight: 600, color: group.coherenceAnalysis.coherenceLevel === "low" ? "#7f1d1d" : "#92400e" }}>
                        Source Conflicts Detected
                      </div>
                      <div style={{ marginLeft: "auto", fontSize: "11px", padding: "2px 6px", borderRadius: "4px", backgroundColor: group.coherenceAnalysis.coherenceLevel === "low" ? "#fca5a5" : "#fbbf24", color: "#000", fontWeight: 600 }}>
                        {group.coherenceAnalysis.coherencePercentage}% coherent
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#374151", marginBottom: "8px" }}>
                      {group.coherenceAnalysis.summary}
                    </div>
                    {group.coherenceAnalysis.conflicts.length > 0 && (
                      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "8px" }}>
                        <strong style={{ display: "block", marginBottom: "4px" }}>Conflicts:</strong>
                        {group.coherenceAnalysis.conflicts.map((conflict, idx) => (
                          <div key={idx} style={{ marginBottom: "4px", paddingLeft: "8px", borderLeft: `2px solid ${conflict.severity === "high" ? "#dc2626" : conflict.severity === "medium" ? "#f59e0b" : "#10b981"}` }}>
                            <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{conflict.type.replace(/_/g, " ")}:</span> {conflict.description}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#374151", fontWeight: 500 }}>
                      💡 {group.coherenceAnalysis.recommendation}
                    </div>
                  </div>
                )}
                {/* Notes/Guidance */}
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px", fontWeight: 500 }}>
                    Notes for AI (optional):
                  </div>
                  <textarea
                    value={group.notes || ""}
                    onChange={(e) => updateSkillGroup(group.id, { notes: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Add guidance for content generation, e.g., 'Focus on security aspects' or 'Keep it concise'"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "13px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      resize: "vertical",
                      minHeight: "60px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
