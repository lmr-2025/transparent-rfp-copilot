"use client";

import { useEffect, useMemo, useState } from "react";
import { SKILLS_STORAGE_KEY, loadSkillsFromStorage, saveSkillsToStorage } from "@/lib/skillStorage";
import { Skill, SkillFact } from "@/types/skill";
import { SkillDraft } from "@/lib/llm";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { SKILL_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";

const styles = {
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "16px",
    backgroundColor: "#fff",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5f5",
    marginBottom: "12px",
  },
  pill: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 600,
    marginRight: "8px",
    marginBottom: "4px",
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecdd3",
    borderRadius: "6px",
    padding: "8px 12px",
    marginTop: "8px",
  },
  confirmBox: {
    border: "1px solid #fecdd3",
    backgroundColor: "#fff1f2",
    borderRadius: "6px",
    padding: "12px",
    marginTop: "12px",
  },
  diffBlock: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "12px",
    marginTop: "12px",
    backgroundColor: "#fff",
  },
  diffPre: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: "0.9rem",
    margin: 0,
  },
  diffLine: {
    padding: "2px 6px",
    borderRadius: "4px",
    display: "block",
    whiteSpace: "pre-wrap" as const,
  },
  diffLineAdded: {
    backgroundColor: "#ecfdf5",
    color: "#065f46",
  },
  diffLineRemoved: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
};

type StatusFilter = "all" | "active" | "inactive";

type UpdateSuggestion = {
  action: "add" | "modify" | "remove";
  section: string;
  description: string;
  content: string;
};

type UpdateResponse = {
  title: string;
  tags: string[];
  suggestions: UpdateSuggestion[];
  summary: string;
};

type SkillRefreshState = {
  sourceLinks: string;
  isRefreshing: boolean;
  error: string | null;
  draft?: SkillDraft;
  updates?: UpdateResponse; // New: incremental update suggestions
  selectedSuggestions?: Set<number>; // Which suggestions are selected to apply
  isInputVisible: boolean;
};

const createRefreshState = (): SkillRefreshState => ({
  sourceLinks: "",
  isRefreshing: false,
  error: null,
  draft: undefined,
  updates: undefined,
  selectedSuggestions: undefined,
  isInputVisible: false,
});

const contentHasEdgeCases = (content: string) => /\bedge cases\b/i.test(content);
const contentHasSupportingInfo = (content: string) =>
  /\bresponse template\b/i.test(content) || /\bsource mapping\b/i.test(content);

type DiffSegment = {
  type: "same" | "added" | "removed";
  line: string;
};

const splitLines = (value: string) => (value ? value.split(/\r?\n/) : []);

function diffLines(previous: string, nextValue: string): DiffSegment[] {
  const oldLines = splitLines(previous);
  const newLines = splitLines(nextValue);
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      segments.push({ type: "same", line: oldLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: "removed", line: oldLines[i] });
      i += 1;
    } else {
      segments.push({ type: "added", line: newLines[j] });
      j += 1;
    }
  }
  while (i < m) {
    segments.push({ type: "removed", line: oldLines[i] });
    i += 1;
  }
  while (j < n) {
    segments.push({ type: "added", line: newLines[j] });
    j += 1;
  }
  return segments;
}

// Utility functions - kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatQuickFactsList = (facts?: SkillFact[]) =>
  (facts ?? [])
    .map(
      (fact) =>
        `Q: ${(fact?.question ?? "").trim()}\nA: ${(fact?.answer ?? "").trim()}`.trim(),
    )
    .join("\n\n");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatEdgeCasesList = (entries?: string[]) =>
  (entries ?? []).map((entry) => entry.trim()).filter(Boolean).join("\n");

const renderDiffBlock = (label: string, previous: string, nextValue: string) => {
  if (!previous && !nextValue) {
    return null;
  }
  const segments = diffLines(previous, nextValue);
  const hasChanges = segments.some((segment) => segment.type !== "same");

  return (
    <div style={styles.diffBlock}>
      <strong>{label}</strong>
      {!hasChanges && (
        <p style={{ color: "#94a3b8", margin: "6px 0" }}>No differences detected.</p>
      )}
      <pre style={styles.diffPre}>
        {segments.map((segment, index) => (
          <div
            key={`${label}-diff-${index}`}
            style={{
              ...styles.diffLine,
              ...(segment.type === "added"
                ? styles.diffLineAdded
                : segment.type === "removed"
                  ? styles.diffLineRemoved
                  : {}),
            }}
          >
            <span style={{ opacity: 0.6 }}>
              {segment.type === "added" ? "+" : segment.type === "removed" ? "-" : " "}
            </span>{" "}
            {segment.line || " "}
          </div>
        ))}
      </pre>
    </div>
  );
};

export default function KnowledgeLibraryPage() {
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshStates, setRefreshStates] = useState<Record<string, SkillRefreshState>>({});
  const [promptText] = useStoredPrompt(SKILL_PROMPT_STORAGE_KEY, defaultSkillPrompt);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const getRefreshState = (skillId: string): SkillRefreshState =>
    refreshStates[skillId] ?? createRefreshState();

  const mergeRefreshState = (skillId: string, patch: Partial<SkillRefreshState>) => {
    setRefreshStates((prev) => ({
      ...prev,
      [skillId]: { ...(prev[skillId] ?? createRefreshState()), ...patch },
    }));
  };

  useEffect(() => {
    setSkills(loadSkillsFromStorage());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SKILLS_STORAGE_KEY) {
        setSkills(loadSkillsFromStorage());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleDeleteSkill = (skillId: string) => {
    setSkills((prev) => {
      const next = prev.filter((skill) => skill.id !== skillId);
      saveSkillsToStorage(next);
      return next;
    });
    setConfirmingDeleteId(null);
    setRefreshStates((prev) => {
      const copy = { ...prev };
      delete copy[skillId];
      return copy;
    });
  };

  const handleRefreshSkill = async (skillId: string) => {
    const state = getRefreshState(skillId);
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) return;

    const urls = state.sourceLinks
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (urls.length === 0) {
      mergeRefreshState(skillId, {
        error: "Provide at least one source link before refreshing.",
      });
      return;
    }

    mergeRefreshState(skillId, { isRefreshing: true, error: null, updates: undefined, draft: undefined });

    try {
      const response = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: urls,
          prompt: promptText,
          // Send existing skill for incremental update mode
          existingSkill: {
            title: skill.title,
            content: skill.content,
            tags: skill.tags,
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to generate suggested updates.");
      }

      // Check if we got incremental updates or a full draft
      if (payload.updateMode && payload.updates) {
        const allIndices = new Set<number>(payload.updates.suggestions.map((_: UpdateSuggestion, i: number) => i));
        mergeRefreshState(skillId, {
          updates: payload.updates,
          selectedSuggestions: allIndices,
          isRefreshing: false,
        });
      } else if (payload.draft) {
        mergeRefreshState(skillId, { draft: payload.draft, isRefreshing: false });
      } else {
        throw new Error("Unable to generate suggested updates.");
      }
    } catch (error) {
      mergeRefreshState(skillId, {
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Unable to refresh this skill right now.",
      });
    }
  };

const handleApplySuggestion = (skillId: string) => {
  const state = getRefreshState(skillId);
  const urls = state.sourceLinks
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  // Handle incremental update mode
  if (state.updates && state.selectedSuggestions) {
    const selectedIndices = state.selectedSuggestions;
    if (selectedIndices.size === 0) return;

    setSkills((prev) => {
      const updated = prev.map((skill) => {
        if (skill.id !== skillId) return skill;

        const now = new Date().toISOString();
        let newContent = skill.content;

        // Apply selected suggestions
        state.updates!.suggestions.forEach((suggestion, index) => {
          if (!selectedIndices.has(index)) return;

          if (suggestion.action === "add") {
            // Add new content at the end
            newContent = newContent.trim() + "\n\n" + suggestion.content;
          } else if (suggestion.action === "modify") {
            // For modify, append the new content (user can manually merge)
            // A more sophisticated approach would try to find and replace sections
            newContent = newContent.trim() + "\n\n" + suggestion.content;
          }
          // For "remove", we'd need more sophisticated logic - skip for now
        });

        // Merge tags
        const existingTags = new Set(skill.tags);
        const newTags = [...skill.tags];
        state.updates!.tags.forEach((tag) => {
          if (!existingTags.has(tag)) {
            newTags.push(tag);
          }
        });

        return {
          ...skill,
          content: newContent,
          tags: newTags,
          lastRefreshedAt: now,
          lastSourceLink: urls[0] ?? skill.lastSourceLink,
        };
      });
      saveSkillsToStorage(updated);
      return updated;
    });

    mergeRefreshState(skillId, {
      updates: undefined,
      selectedSuggestions: undefined,
      error: null,
      sourceLinks: "",
      isInputVisible: false,
    });
    return;
  }

  // Legacy: handle full draft mode
  if (!state.draft) {
    return;
  }

  const draft = state.draft;

  setSkills((prev) => {
    const updated = prev.map((skill) => {
      if (skill.id !== skillId) {
        return skill;
      }
      const now = new Date().toISOString();
      const nextInformation =
        draft.sourceMapping && draft.sourceMapping.length > 0
          ? {
              responseTemplate: undefined,
              sources: draft.sourceMapping,
            }
          : skill.information;

      return {
        ...skill,
        tags:
          Array.isArray(draft.tags) && draft.tags.length > 0
            ? draft.tags
            : skill.tags,
        content:
          typeof draft.content === "string" && draft.content.trim().length > 0
            ? draft.content
            : skill.content,
        information: nextInformation,
        lastRefreshedAt: now,
        lastSourceLink: urls[0] ?? skill.lastSourceLink,
      };
    });
    saveSkillsToStorage(updated);
    return updated;
  });

  mergeRefreshState(skillId, {
    draft: undefined,
    error: null,
    sourceLinks: "",
    isInputVisible: false,
  });
};

  const handleDismissSuggestion = (skillId: string) => {
    mergeRefreshState(skillId, { draft: undefined, updates: undefined, selectedSuggestions: undefined });
  };

  const toggleSuggestionSelection = (skillId: string, suggestionIndex: number) => {
    const state = getRefreshState(skillId);
    const current = state.selectedSuggestions ?? new Set<number>();
    const newSet = new Set(current);
    if (newSet.has(suggestionIndex)) {
      newSet.delete(suggestionIndex);
    } else {
      newSet.add(suggestionIndex);
    }
    mergeRefreshState(skillId, { selectedSuggestions: newSet });
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return skills.filter((skill) => {
      if (statusFilter === "active" && !skill.isActive) return false;
      if (statusFilter === "inactive" && skill.isActive) return false;

      const haystack = [
        skill.title,
        skill.tags.join(" "),
        skill.content,
        skill.information?.responseTemplate ?? "",
        (skill.information?.sources ?? []).join(" "),
        (skill.edgeCases ?? []).join(" "),
        (skill.quickFacts ?? [])
          .map((fact) => `${fact.question} ${fact.answer}`)
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [skills, search, statusFilter]);

  const stats = useMemo(() => {
    const total = skills.length;
    const active = skills.filter((skill) => skill.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [skills]);

  return (
    <div style={styles.container}>
      <h1>GRC Minion – Knowledge Library</h1>
      <p style={{ color: "#475569" }}>
        Review every uploaded knowledge artifact. Use this view to validate quick facts, confirm
        coverage, and identify candidates for future updates.
      </p>

      <SkillUpdateBanner skills={skills} />

      <div style={{ ...styles.card, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <strong>Total Skills:</strong> {stats.total}
        </div>
        <div>
          <strong>Active:</strong> {stats.active}
        </div>
        <div>
          <strong>Inactive:</strong> {stats.inactive}
        </div>
        <a href="/knowledge" style={{ color: "#2563eb", fontWeight: 600 }}>
          Need to add more? Upload a document →
        </a>
      </div>

      <div style={styles.card}>
        <label style={styles.label} htmlFor="search">
          Search by title, tag, or content
        </label>
        <input
          id="search"
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={styles.input}
          placeholder="Search knowledge base..."
        />

        <label style={styles.label}>Filter by status</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {(["all", "active", "inactive"] as StatusFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
                border: "1px solid #cbd5f5",
                backgroundColor: statusFilter === option ? "#2563eb" : "#fff",
                color: statusFilter === option ? "#fff" : "#0f172a",
                cursor: "pointer",
              }}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.card}>
          <p style={{ color: "#94a3b8" }}>
            No skills found. Upload curated documentation from the{" "}
            <a href="/knowledge" style={{ color: "#2563eb", fontWeight: 600 }}>
              Knowledge Uploads page
            </a>{" "}
            to seed the assistant.
          </p>
        </div>
      ) : (
        filtered.map((skill) => {
          const refreshState = getRefreshState(skill.id);
          const showQuickFacts = skill.quickFacts.length > 0;
          const showEdgeCases =
            skill.edgeCases.length > 0 && !contentHasEdgeCases(skill.content);
          const hasSupportingDetails =
            !!(
              skill.information &&
              (skill.information.responseTemplate ||
                (skill.information.sources && skill.information.sources.length > 0))
            );
          const showSupportingInfo = hasSupportingDetails && !contentHasSupportingInfo(skill.content);
          return (
            <div key={skill.id} style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0 }}>{skill.title}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      ...styles.pill,
                      backgroundColor: skill.isActive ? "#dcfce7" : "#fee2e2",
                      color: skill.isActive ? "#166534" : "#b91c1c",
                    }}
                  >
                    {skill.isActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmingDeleteId((current) => (current === skill.id ? null : skill.id))
                    }
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #fecdd3",
                      backgroundColor: "#fff",
                      color: "#b91c1c",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p style={{ color: "#94a3b8", marginTop: "4px" }}>
                Added {new Date(skill.createdAt).toLocaleString()}
                {skill.lastRefreshedAt && (
                  <>
                    {" "}
                    • Refreshed {new Date(skill.lastRefreshedAt).toLocaleString()}
                  </>
                )}
                {skill.lastSourceLink && (
                  <>
                    {" "}
                    • Last source:{" "}
                    <a href={skill.lastSourceLink} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      {skill.lastSourceLink}
                    </a>
                  </>
                )}
              </p>
              {confirmingDeleteId === skill.id && (
                <div style={styles.confirmBox}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#991b1b" }}>
                    Delete “{skill.title}” permanently? This removes the skill from the knowledge bank.
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.id)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Yes, delete skill
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5f5",
                        backgroundColor: "#fff",
                        color: "#0f172a",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {skill.tags.length > 0 && (
                <div style={{ margin: "8px 0" }}>
                  {skill.tags.map((tag) => (
                    <span key={tag} style={styles.pill}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap", marginTop: "12px" }}>{skill.content}</div>

              {showQuickFacts && (
                <div style={{ marginTop: "12px" }}>
                  <strong>Quick Facts</strong>
                  <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                    {skill.quickFacts.map((fact, idx) => (
                      <li key={`${skill.id}-fact-${idx}`}>
                        <strong>Q:</strong> {fact.question || "—"} <br />
                        <strong>A:</strong> {fact.answer || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showEdgeCases && (
                <div style={{ marginTop: "12px" }}>
                  <strong>Edge cases</strong>
                  <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                    {skill.edgeCases.map((edgeCase, idx) => (
                      <li key={`${skill.id}-edge-${idx}`}>{edgeCase}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showSupportingInfo && (
                <div style={{ marginTop: "12px" }}>
                  <strong>Supporting information</strong>
                  {skill.information?.responseTemplate && (
                    <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>
                      {skill.information.responseTemplate}
                    </p>
                  )}
                  {skill.information?.sources && skill.information.sources.length > 0 && (
                    <ul style={{ margin: "8px 0 0 20px" }}>
                      {skill.information.sources.map((source, idx) => (
                        <li key={`${skill.id}-info-source-${idx}`}>{source}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div style={{ marginTop: "18px", borderTop: "1px dashed #e2e8f0", paddingTop: "16px" }}>
                <h3 style={{ marginTop: 0 }}>Refresh / Validate this skill</h3>
                <p style={{ color: "#64748b", marginTop: "4px" }}>
                  Provide updated documentation links so GRC Minion can re-parse them. Compare the AI
                  suggestion side-by-side before applying.
                </p>
                {refreshState.isInputVisible ? (
                  <>
                    <label style={styles.label} htmlFor={`source-links-${skill.id}`}>
                      Source links (one per line)
                    </label>
                    <textarea
                      id={`source-links-${skill.id}`}
                      value={refreshState.sourceLinks}
                      onChange={(event) =>
                        mergeRefreshState(skill.id, { sourceLinks: event.target.value })
                      }
                      style={{ ...styles.input, minHeight: "80px", resize: "vertical" }}
                      placeholder="https://docs...\nhttps://trust-portal..."
                    />
                    {refreshState.error && <div style={styles.error}>{refreshState.error}</div>}
                    <button
                      type="button"
                      onClick={() => handleRefreshSkill(skill.id)}
                      disabled={refreshState.isRefreshing}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: refreshState.isRefreshing ? "#94a3b8" : "#0ea5e9",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: refreshState.isRefreshing ? "not-allowed" : "pointer",
                        marginTop: "4px",
                      }}
                    >
                      {refreshState.isRefreshing ? "Refreshing..." : "Generate refresh draft"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      mergeRefreshState(skill.id, { isInputVisible: true, error: null })
                    }
                    style={{
                      padding: "10px 16px",
                      borderRadius: "6px",
                      border: "1px solid #2563eb",
                      backgroundColor: "#fff",
                      color: "#2563eb",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Update / Refresh skill
                  </button>
                )}

                {/* New: Incremental update suggestions (GitHub-style) */}
                {refreshState.updates && (
                  <div style={{ marginTop: "16px" }}>
                    <h4 style={{ marginBottom: "4px", color: "#0369a1" }}>
                      Suggested Changes ({refreshState.updates.suggestions.length})
                    </h4>
                    <p style={{ color: "#64748b", marginTop: 0, marginBottom: "12px" }}>
                      {refreshState.updates.summary}
                    </p>

                    {refreshState.updates.tags.length > 0 && (
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ fontSize: "13px" }}>New tags to add:</strong>{" "}
                        {refreshState.updates.tags
                          .filter((t) => !skill.tags.includes(t))
                          .map((tag) => (
                            <span
                              key={tag}
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                marginLeft: "6px",
                                backgroundColor: "#dcfce7",
                                color: "#166534",
                                borderRadius: "4px",
                                fontSize: "12px",
                              }}
                            >
                              + {tag}
                            </span>
                          ))}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {refreshState.updates.suggestions.map((suggestion, idx) => {
                        const isSelected = refreshState.selectedSuggestions?.has(idx) ?? false;
                        return (
                          <div
                            key={`${skill.id}-suggestion-${idx}`}
                            style={{
                              border: `2px solid ${isSelected ? (suggestion.action === "add" ? "#86efac" : suggestion.action === "modify" ? "#fcd34d" : "#fca5a5") : "#e2e8f0"}`,
                              borderRadius: "8px",
                              padding: "12px",
                              backgroundColor: isSelected
                                ? suggestion.action === "add"
                                  ? "#f0fdf4"
                                  : suggestion.action === "modify"
                                    ? "#fefce8"
                                    : "#fef2f2"
                                : "#fff",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSuggestionSelection(skill.id, idx)}
                                style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      backgroundColor:
                                        suggestion.action === "add"
                                          ? "#dcfce7"
                                          : suggestion.action === "modify"
                                            ? "#fef3c7"
                                            : "#fee2e2",
                                      color:
                                        suggestion.action === "add"
                                          ? "#166534"
                                          : suggestion.action === "modify"
                                            ? "#92400e"
                                            : "#991b1b",
                                    }}
                                  >
                                    {suggestion.action}
                                  </span>
                                  <span style={{ fontWeight: 600, fontSize: "13px" }}>{suggestion.section}</span>
                                </div>
                                <p style={{ color: "#475569", margin: "0 0 8px 0", fontSize: "13px" }}>
                                  {suggestion.description}
                                </p>
                                <pre
                                  style={{
                                    backgroundColor: "#f8fafc",
                                    padding: "10px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    whiteSpace: "pre-wrap",
                                    margin: 0,
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    border: "1px solid #e2e8f0",
                                  }}
                                >
                                  {suggestion.content}
                                </pre>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleApplySuggestion(skill.id)}
                        disabled={(refreshState.selectedSuggestions?.size ?? 0) === 0}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: (refreshState.selectedSuggestions?.size ?? 0) === 0 ? "#cbd5e1" : "#22c55e",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: (refreshState.selectedSuggestions?.size ?? 0) === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        Apply {refreshState.selectedSuggestions?.size ?? 0} selected
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissSuggestion(skill.id)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5f5",
                          backgroundColor: "#fff",
                          color: "#0f172a",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Legacy: Full draft mode (fallback) */}
                {refreshState.draft && (
                  <div style={{ marginTop: "16px" }}>
                    <h4 style={{ marginBottom: "4px" }}>Review suggested updates</h4>
                    <p style={{ color: "#64748b", marginTop: 0 }}>
                      Inline diff view similar to GitHub. Apply only if the new content looks correct.
                    </p>
                    {renderDiffBlock("Content", skill.content, refreshState.draft.content ?? "")}

                    {refreshState.draft.sourceMapping &&
                      refreshState.draft.sourceMapping.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <strong>Suggested sources</strong>
                          <ul style={{ margin: "8px 0 0 20px" }}>
                            {refreshState.draft.sourceMapping.map((source: string, idx: number) => (
                              <li key={`${skill.id}-draft-source-${idx}`}>{source}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleApplySuggestion(skill.id)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: "#22c55e",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Apply updates
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissSuggestion(skill.id)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5f5",
                          backgroundColor: "#fff",
                          color: "#0f172a",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
