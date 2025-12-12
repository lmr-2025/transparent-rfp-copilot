"use client";

import { useEffect, useMemo, useState } from "react";
import { SKILLS_STORAGE_KEY, loadSkillsFromStorage, saveSkillsToStorage } from "@/lib/skillStorage";
import { Skill, SkillFact, SourceUrl, SkillOwner, SkillHistoryEntry } from "@/types/skill";
import SkillOwnerEditor from "@/components/SkillOwnerEditor";
import SkillHistoryViewer from "@/components/SkillHistoryViewer";
import { SkillDraft } from "@/lib/llm";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { SKILL_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LibraryRecommendation, AnalyzeLibraryResponse } from "@/types/libraryAnalysis";
import TransparencyModal from "@/components/TransparencyModal";

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
type ViewMode = "grid" | "list";

type DiffLine = {
  type: "unchanged" | "added" | "removed" | "modified-old" | "modified-new";
  lineNumber: number | null;
  newLineNumber: number | null;
  content: string;
};

// Compute a simple line-by-line diff between old and new content
function computeLineDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = (a: string[], b: string[]): Set<string> => {
    const aSet = new Set(a);
    const bSet = new Set(b);
    const common = new Set<string>();
    aSet.forEach((line) => {
      if (bSet.has(line)) common.add(line);
    });
    return common;
  };

  const commonLines = lcs(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldIdx >= oldLines.length) {
      // Only new lines left - these are additions
      result.push({
        type: "added",
        lineNumber: null,
        newLineNumber: newLineNum++,
        content: newLine,
      });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      // Only old lines left - these are removals
      result.push({
        type: "removed",
        lineNumber: oldLineNum++,
        newLineNumber: null,
        content: oldLine,
      });
      oldIdx++;
    } else if (oldLine === newLine) {
      // Lines match - unchanged
      result.push({
        type: "unchanged",
        lineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
        content: oldLine,
      });
      oldIdx++;
      newIdx++;
    } else if (!commonLines.has(oldLine) && commonLines.has(newLine)) {
      // Old line not in common, new line is - old line was removed
      result.push({
        type: "removed",
        lineNumber: oldLineNum++,
        newLineNumber: null,
        content: oldLine,
      });
      oldIdx++;
    } else if (commonLines.has(oldLine) && !commonLines.has(newLine)) {
      // Old line in common, new line not - new line was added
      result.push({
        type: "added",
        lineNumber: null,
        newLineNumber: newLineNum++,
        content: newLine,
      });
      newIdx++;
    } else {
      // Both lines are unique - treat as modification (remove old, add new)
      result.push({
        type: "removed",
        lineNumber: oldLineNum++,
        newLineNumber: null,
        content: oldLine,
      });
      result.push({
        type: "added",
        lineNumber: null,
        newLineNumber: newLineNum++,
        content: newLine,
      });
      oldIdx++;
      newIdx++;
    }
  }

  return result;
}

// GitHub-style split diff component
function GitHubDiff({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const diffLines = useMemo(() => computeLineDiff(oldContent, newContent), [oldContent, newContent]);

  // Split into left (old) and right (new) for side-by-side view
  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];

  let i = 0;
  while (i < diffLines.length) {
    const line = diffLines[i];

    if (line.type === "unchanged") {
      leftLines.push(line);
      rightLines.push(line);
      i++;
    } else if (line.type === "removed") {
      // Check if next line is added (modification pair)
      const nextLine = diffLines[i + 1];
      if (nextLine && nextLine.type === "added") {
        leftLines.push(line);
        rightLines.push(nextLine);
        i += 2;
      } else {
        leftLines.push(line);
        rightLines.push({ type: "unchanged", lineNumber: null, newLineNumber: null, content: "" });
        i++;
      }
    } else if (line.type === "added") {
      leftLines.push({ type: "unchanged", lineNumber: null, newLineNumber: null, content: "" });
      rightLines.push(line);
      i++;
    } else {
      i++;
    }
  }

  const lineNumberStyle: React.CSSProperties = {
    width: "40px",
    minWidth: "40px",
    padding: "0 8px",
    textAlign: "right",
    color: "#6b7280",
    fontSize: "12px",
    userSelect: "none",
    borderRight: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  };

  const codeStyle: React.CSSProperties = {
    flex: 1,
    padding: "0 8px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  const getRowStyle = (type: DiffLine["type"]): React.CSSProperties => {
    switch (type) {
      case "added":
        return { backgroundColor: "#d1fae5" };
      case "removed":
        return { backgroundColor: "#fee2e2" };
      default:
        return { backgroundColor: "#fff" };
    }
  };

  const getCodeStyle = (type: DiffLine["type"]): React.CSSProperties => {
    switch (type) {
      case "added":
        return { ...codeStyle, backgroundColor: "#bbf7d0" };
      case "removed":
        return { ...codeStyle, backgroundColor: "#fecaca", textDecoration: "line-through", color: "#991b1b" };
      default:
        return codeStyle;
    }
  };

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: "8px", overflow: "hidden", fontSize: "12px" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #d1d5db" }}>
        <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", fontWeight: 600, fontSize: "12px", color: "#991b1b", borderRight: "1px solid #d1d5db", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
          Current
        </div>
        <div style={{ padding: "8px 12px", backgroundColor: "#f0fdf4", fontWeight: 600, fontSize: "12px", color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
          Proposed
        </div>
      </div>

      {/* Diff content */}
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {leftLines.map((leftLine, idx) => {
          const rightLine = rightLines[idx];
          return (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: idx < leftLines.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              {/* Left side (old) */}
              <div style={{ display: "flex", ...getRowStyle(leftLine.type), borderRight: "1px solid #d1d5db", minHeight: "22px" }}>
                <div style={{ ...lineNumberStyle, backgroundColor: leftLine.type === "removed" ? "#fecaca" : "#f9fafb" }}>
                  {leftLine.lineNumber ?? ""}
                </div>
                <div style={getCodeStyle(leftLine.type)}>
                  {leftLine.content || (leftLine.type === "unchanged" && !leftLine.lineNumber ? "" : leftLine.content)}
                </div>
              </div>
              {/* Right side (new) */}
              <div style={{ display: "flex", ...getRowStyle(rightLine.type), minHeight: "22px" }}>
                <div style={{ ...lineNumberStyle, backgroundColor: rightLine.type === "added" ? "#bbf7d0" : "#f9fafb" }}>
                  {rightLine.newLineNumber ?? ""}
                </div>
                <div style={getCodeStyle(rightLine.type)}>
                  {rightLine.content || (rightLine.type === "unchanged" && !rightLine.newLineNumber ? "" : rightLine.content)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats footer */}
      <div style={{ padding: "8px 12px", backgroundColor: "#f9fafb", borderTop: "1px solid #d1d5db", fontSize: "11px", color: "#6b7280", display: "flex", gap: "16px" }}>
        <span style={{ color: "#dc2626" }}>
          − {diffLines.filter(l => l.type === "removed").length} lines
        </span>
        <span style={{ color: "#16a34a" }}>
          + {diffLines.filter(l => l.type === "added").length} lines
        </span>
      </div>
    </div>
  );
}

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

// New simpler response - LLM returns complete draft
type DraftUpdateResponse = {
  hasChanges: boolean;
  summary: string;
  title: string;
  tags: string[];
  content: string;
  changeHighlights: string[];
};

type SkillRefreshState = {
  sourceLinks: string;
  isRefreshing: boolean;
  error: string | null;
  draft?: SkillDraft;
  updates?: UpdateResponse; // Legacy: incremental update suggestions
  draftUpdate?: DraftUpdateResponse; // New: complete draft from LLM
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

// Library analysis state
type AnalysisTransparency = AnalyzeLibraryResponse["transparency"];

type LibraryAnalysisState = {
  isAnalyzing: boolean;
  recommendations: LibraryRecommendation[];
  summary: string;
  healthScore: number;
  error: string | null;
  dismissedIds: Set<string>;
  showPanel: boolean;
  transparency: AnalysisTransparency | null;
  showTransparencyModal: boolean;
};

const createAnalysisState = (): LibraryAnalysisState => ({
  isAnalyzing: false,
  recommendations: [],
  summary: "",
  healthScore: 0,
  error: null,
  dismissedIds: new Set(),
  showPanel: false,
  transparency: null,
  showTransparencyModal: false,
});

export default function KnowledgeLibraryPage() {
  // loadSkillsFromStorage automatically handles migration and persists changes
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [refreshStates, setRefreshStates] = useState<Record<string, SkillRefreshState>>({});
  const [promptText] = useStoredPrompt(SKILL_PROMPT_STORAGE_KEY, defaultSkillPrompt);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<LibraryAnalysisState>(createAnalysisState);

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

  const handleUpdateSkillOwners = (skillId: string, owners: SkillOwner[]) => {
    setSkills((prev) => {
      const updated = prev.map((skill) => {
        if (skill.id !== skillId) return skill;

        // Add history entry for owner changes
        const existingOwners = skill.owners || [];
        const addedOwners = owners.filter(o => !existingOwners.some(eo => eo.name === o.name));
        const removedOwners = existingOwners.filter(eo => !owners.some(o => o.name === eo.name));

        const historyEntries: SkillHistoryEntry[] = [];
        const now = new Date().toISOString();

        if (addedOwners.length > 0) {
          historyEntries.push({
            date: now,
            action: 'owner_added',
            summary: `Added owner(s): ${addedOwners.map(o => o.name).join(', ')}`,
          });
        }
        if (removedOwners.length > 0) {
          historyEntries.push({
            date: now,
            action: 'owner_removed',
            summary: `Removed owner(s): ${removedOwners.map(o => o.name).join(', ')}`,
          });
        }

        return {
          ...skill,
          owners: owners.length > 0 ? owners : undefined,
          history: [...(skill.history || []), ...historyEntries],
        };
      });
      saveSkillsToStorage(updated);
      return updated;
    });
  };

  const handleRefreshSkill = async (skillId: string, urlsOverride?: string[]) => {
    const state = getRefreshState(skillId);
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) return;

    // Use override URLs (from quick refresh) or parse from textarea
    const urls = urlsOverride || state.sourceLinks
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

      // Check if we got the new draft mode or legacy updates
      if (payload.draftMode && payload.draft) {
        // New simpler approach - LLM gives us the complete draft
        mergeRefreshState(skillId, {
          draftUpdate: payload.draft,
          isRefreshing: false,
        });
      } else if (payload.updateMode && payload.updates) {
        // Legacy incremental updates mode
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

        // Merge source URLs
        const existingUrls = skill.sourceUrls || [];
        const existingUrlStrings = new Set(existingUrls.map(u => u.url));
        const newSourceUrls: SourceUrl[] = urls
          .filter(url => !existingUrlStrings.has(url))
          .map(url => ({ url, addedAt: now, lastFetchedAt: now }));
        const updatedExistingUrls = existingUrls.map(u =>
          urls.includes(u.url) ? { ...u, lastFetchedAt: now } : u
        );

        // Add history entry for the refresh
        const historyEntry: SkillHistoryEntry = {
          date: now,
          action: 'refreshed',
          summary: `Applied ${state.selectedSuggestions?.size ?? 0} update suggestions from ${urls.length} source${urls.length > 1 ? 's' : ''}`,
        };

        return {
          ...skill,
          content: newContent,
          tags: newTags,
          sourceUrls: [...updatedExistingUrls, ...newSourceUrls],
          lastRefreshedAt: now,
          history: [...(skill.history || []), historyEntry],
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

      // Merge source URLs
      const existingUrls = skill.sourceUrls || [];
      const existingUrlStrings = new Set(existingUrls.map(u => u.url));
      const newSourceUrls: SourceUrl[] = urls
        .filter(url => !existingUrlStrings.has(url))
        .map(url => ({ url, addedAt: now, lastFetchedAt: now }));
      const updatedExistingUrls = existingUrls.map(u =>
        urls.includes(u.url) ? { ...u, lastFetchedAt: now } : u
      );

      // Add history entry for the refresh
      const historyEntry: SkillHistoryEntry = {
        date: now,
        action: 'refreshed',
        summary: `Skill refreshed from ${urls.length} source${urls.length > 1 ? 's' : ''}`,
      };

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
        sourceUrls: [...updatedExistingUrls, ...newSourceUrls],
        information: nextInformation,
        lastRefreshedAt: now,
        history: [...(skill.history || []), historyEntry],
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

  // Library analysis
  const handleAnalyzeLibrary = async () => {
    setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null, showPanel: true }));

    try {
      const skillSummaries = skills.map(skill => ({
        id: skill.id,
        title: skill.title,
        tags: skill.tags,
        contentPreview: skill.content.substring(0, 500),
      }));

      const response = await fetch("/api/skills/analyze-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: skillSummaries }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze library");
      }

      const result = await response.json() as AnalyzeLibraryResponse;
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        recommendations: result.recommendations || [],
        summary: result.summary || "",
        healthScore: result.healthScore || 0,
        transparency: result.transparency || null,
      }));
    } catch (error) {
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      }));
    }
  };

  const dismissRecommendation = (index: number) => {
    setAnalysisState(prev => {
      const newDismissed = new Set(prev.dismissedIds);
      newDismissed.add(String(index));
      return { ...prev, dismissedIds: newDismissed };
    });
  };

  const visibleRecommendations = analysisState.recommendations.filter(
    (_, idx) => !analysisState.dismissedIds.has(String(idx))
  );

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

  // Get unique owners from all skills
  const uniqueOwners = useMemo(() => {
    const ownerNames = new Set<string>();
    skills.forEach((skill) => {
      (skill.owners || []).forEach((owner) => {
        ownerNames.add(owner.name);
      });
    });
    return Array.from(ownerNames).sort();
  }, [skills]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return skills.filter((skill) => {
      if (statusFilter === "active" && !skill.isActive) return false;
      if (statusFilter === "inactive" && skill.isActive) return false;

      // Filter by owner
      if (ownerFilter !== "all") {
        if (ownerFilter === "unassigned") {
          if (skill.owners && skill.owners.length > 0) return false;
        } else {
          const hasOwner = (skill.owners || []).some((o) => o.name === ownerFilter);
          if (!hasOwner) return false;
        }
      }

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
        (skill.owners || []).map((o) => o.name).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [skills, search, statusFilter, ownerFilter]);

  const stats = useMemo(() => {
    const total = skills.length;
    const active = skills.filter((skill) => skill.isActive).length;
    const inactive = total - active;
    const unassigned = skills.filter((skill) => !skill.owners || skill.owners.length === 0).length;
    return { total, active, inactive, unassigned };
  }, [skills]);

  return (
    <div style={styles.container}>
      <h1>Knowledge Gremlin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Library)</span></h1>
      <p style={{ color: "#475569" }}>
        Review every uploaded knowledge artifact. Use this view to validate quick facts, confirm
        coverage, and identify candidates for future updates.
      </p>

      <SkillUpdateBanner skills={skills} />

      <div style={{ ...styles.card, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <strong>Total Skills:</strong> {stats.total}
          </div>
          <div>
            <strong>Active:</strong> {stats.active}
          </div>
          <div>
            <strong>Inactive:</strong> {stats.inactive}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              onClick={handleAnalyzeLibrary}
              disabled={analysisState.isAnalyzing || skills.length < 2}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: analysisState.isAnalyzing || skills.length < 2 ? "#94a3b8" : "#8b5cf6",
                color: "#fff",
                fontWeight: 600,
                cursor: analysisState.isAnalyzing || skills.length < 2 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                opacity: skills.length < 2 ? 0.6 : 1,
              }}
              title={skills.length < 2 ? `Need at least 2 skills to analyze (currently ${skills.length})` : "Analyze library for redundancy and organization issues"}
            >
              {analysisState.isAnalyzing ? "Analyzing..." : "Review Library"}
            </button>
            {skills.length < 2 && (
              <div style={{
                fontSize: "11px",
                color: "#64748b",
                marginTop: "4px",
                textAlign: "center",
              }}>
                Need {2 - skills.length} more skill{2 - skills.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
          <a href="/knowledge" style={{ color: "#2563eb", fontWeight: 600 }}>
            Add more →
          </a>
        </div>
      </div>

      {/* Library Analysis Panel */}
      {analysisState.showPanel && (
        <div style={{
          ...styles.card,
          backgroundColor: "#faf5ff",
          border: "1px solid #c4b5fd",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0, color: "#6d28d9", display: "flex", alignItems: "center", gap: "8px" }}>
                Library Analysis
                {!analysisState.isAnalyzing && analysisState.healthScore > 0 && (
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 600,
                    backgroundColor: analysisState.healthScore >= 90 ? "#dcfce7" :
                                     analysisState.healthScore >= 70 ? "#fef9c3" :
                                     analysisState.healthScore >= 50 ? "#fed7aa" : "#fecaca",
                    color: analysisState.healthScore >= 90 ? "#166534" :
                           analysisState.healthScore >= 70 ? "#854d0e" :
                           analysisState.healthScore >= 50 ? "#9a3412" : "#991b1b",
                  }}>
                    Health: {analysisState.healthScore}/100
                  </span>
                )}
              </h3>
              {!analysisState.isAnalyzing && analysisState.summary && (
                <p style={{ color: "#6b7280", margin: "8px 0 0 0", fontSize: "14px" }}>
                  {analysisState.summary}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {!analysisState.isAnalyzing && analysisState.transparency && (
                <button
                  type="button"
                  onClick={() => setAnalysisState(prev => ({ ...prev, showTransparencyModal: true }))}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #c4b5fd",
                    backgroundColor: "#ede9fe",
                    color: "#6d28d9",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  View what was sent
                </button>
              )}
              <button
                type="button"
                onClick={() => setAnalysisState(createAnalysisState)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #c4b5fd",
                  backgroundColor: "#fff",
                  color: "#6d28d9",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Close
              </button>
            </div>
          </div>

          {analysisState.isAnalyzing && (
            <LoadingSpinner
              title="Analyzing your knowledge library..."
              subtitle="Checking for redundancy, organization issues, and gaps. This may take 15-30 seconds."
            />
          )}

          {analysisState.error && (
            <div style={styles.error}>{analysisState.error}</div>
          )}

          {!analysisState.isAnalyzing && visibleRecommendations.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#475569" }}>
                Recommendations ({visibleRecommendations.length})
              </h4>
              {visibleRecommendations.map((rec, idx) => {
                const originalIdx = analysisState.recommendations.indexOf(rec);
                const typeColors: Record<string, { bg: string; text: string; label: string }> = {
                  merge: { bg: "#dbeafe", text: "#1e40af", label: "Merge" },
                  split: { bg: "#fce7f3", text: "#9d174d", label: "Split" },
                  rename: { bg: "#e0e7ff", text: "#3730a3", label: "Rename" },
                  retag: { bg: "#d1fae5", text: "#065f46", label: "Retag" },
                  gap: { bg: "#fef3c7", text: "#92400e", label: "Gap" },
                };
                const priorityColors: Record<string, { bg: string; text: string }> = {
                  high: { bg: "#fee2e2", text: "#991b1b" },
                  medium: { bg: "#fef9c3", text: "#854d0e" },
                  low: { bg: "#f1f5f9", text: "#475569" },
                };
                const typeStyle = typeColors[rec.type] || typeColors.merge;
                const priorityStyle = priorityColors[rec.priority] || priorityColors.medium;

                return (
                  <div
                    key={idx}
                    style={{
                      padding: "12px",
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: typeStyle.bg,
                            color: typeStyle.text,
                          }}>
                            {typeStyle.label}
                          </span>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: priorityStyle.bg,
                            color: priorityStyle.text,
                          }}>
                            {rec.priority}
                          </span>
                        </div>
                        <strong style={{ fontSize: "14px", color: "#1e293b" }}>{rec.title}</strong>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#475569" }}>
                          {rec.description}
                        </p>
                        {rec.affectedSkillTitles.length > 0 && (
                          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                            <strong>Affects:</strong> {rec.affectedSkillTitles.join(", ")}
                          </p>
                        )}
                        {rec.suggestedAction && (
                          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#059669", fontStyle: "italic" }}>
                            💡 {rec.suggestedAction}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissRecommendation(originalIdx)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#f8fafc",
                          color: "#64748b",
                          cursor: "pointer",
                          fontSize: "11px",
                          flexShrink: 0,
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!analysisState.isAnalyzing && visibleRecommendations.length === 0 && analysisState.recommendations.length > 0 && (
            <p style={{ color: "#059669", fontSize: "14px", margin: "12px 0 0 0" }}>
              ✓ All recommendations addressed!
            </p>
          )}

          {!analysisState.isAnalyzing && analysisState.recommendations.length === 0 && !analysisState.error && (
            <p style={{ color: "#059669", fontSize: "14px", margin: "12px 0 0 0" }}>
              ✓ Your knowledge library is well organized. No issues detected.
            </p>
          )}
        </div>
      )}

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div>
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
            {uniqueOwners.length > 0 && (
              <div>
                <label style={styles.label}>Filter by owner</label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #fde047",
                    backgroundColor: ownerFilter !== "all" ? "#fef9c3" : "#fff",
                    color: "#713f12",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  <option value="all">All owners</option>
                  <option value="unassigned">Unassigned ({stats.unassigned})</option>
                  {uniqueOwners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label style={styles.label}>View</label>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px 0 0 6px",
                  border: "1px solid #cbd5f5",
                  backgroundColor: viewMode === "grid" ? "#2563eb" : "#fff",
                  color: viewMode === "grid" ? "#fff" : "#0f172a",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ▦
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List view"
                style={{
                  padding: "6px 10px",
                  borderRadius: "0 6px 6px 0",
                  border: "1px solid #cbd5f5",
                  borderLeft: "none",
                  backgroundColor: viewMode === "list" ? "#2563eb" : "#fff",
                  color: viewMode === "list" ? "#fff" : "#0f172a",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ☰
              </button>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={styles.card}>
          <p style={{ color: "#94a3b8" }}>
            No skills found. Upload curated documentation from the{" "}
            <a href="/knowledge" style={{ color: "#2563eb", fontWeight: 600 }}>
              Knowledge Uploads page
            </a>{" "}
            to seed the assistant.
          </p>
        </div>
      )}

      {filtered.length > 0 && viewMode === "grid" && (
        /* Grid View - Compact cards */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
        }}>
          {filtered.map((skill) => (
            <div
              key={skill.id}
              onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
              style={{
                ...styles.card,
                cursor: "pointer",
                marginBottom: 0,
                transition: "box-shadow 0.2s, transform 0.2s",
                minHeight: "140px",
                display: "flex",
                flexDirection: "column",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", flex: 1, lineHeight: 1.3 }}>{skill.title}</h3>
                <span
                  style={{
                    ...styles.pill,
                    backgroundColor: skill.isActive ? "#dcfce7" : "#fee2e2",
                    color: skill.isActive ? "#166534" : "#b91c1c",
                    flexShrink: 0,
                    fontSize: "0.7rem",
                  }}
                >
                  {skill.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {skill.tags.length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {skill.tags.slice(0, 3).map((tag) => (
                    <span key={tag} style={{ ...styles.pill, fontSize: "0.7rem", padding: "2px 6px" }}>
                      {tag}
                    </span>
                  ))}
                  {skill.tags.length > 3 && (
                    <span style={{ ...styles.pill, fontSize: "0.7rem", padding: "2px 6px", backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      +{skill.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              <p style={{
                marginTop: "auto",
                paddingTop: "12px",
                color: "#64748b",
                fontSize: "0.8rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: 1.4,
              }}>
                {skill.content.substring(0, 150)}...
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Skill Modal (for grid view) */}
      {viewMode === "grid" && expandedSkillId && (() => {
        const skill = filtered.find(s => s.id === expandedSkillId);
        if (!skill) return null;
        const refreshState = getRefreshState(skill.id);
        const showQuickFacts = skill.quickFacts.length > 0;
        const showEdgeCases = skill.edgeCases.length > 0 && !contentHasEdgeCases(skill.content);
        const hasSupportingDetails = !!(skill.information && (skill.information.responseTemplate || (skill.information.sources && skill.information.sources.length > 0)));
        const showSupportingInfo = hasSupportingDetails && !contentHasSupportingInfo(skill.content);

        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 1000,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              paddingTop: "40px",
              paddingBottom: "40px",
              overflowY: "auto",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setExpandedSkillId(null);
            }}
          >
            <div
              style={{
                ...styles.card,
                maxWidth: "800px",
                width: "90%",
                maxHeight: "calc(100vh - 80px)",
                overflowY: "auto",
                margin: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h2 style={{ margin: 0 }}>{skill.title}</h2>
                <button
                  type="button"
                  onClick={() => setExpandedSkillId(null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
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
                  onClick={() => setConfirmingDeleteId((current) => (current === skill.id ? null : skill.id))}
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

              <p style={{ color: "#94a3b8", marginTop: "8px" }}>
                Added {new Date(skill.createdAt).toLocaleString()}
                {skill.lastRefreshedAt && <> • Refreshed {new Date(skill.lastRefreshedAt).toLocaleString()}</>}
                {skill.sourceUrls && skill.sourceUrls.length > 0 && (
                  <> • {skill.sourceUrls.length} source URL{skill.sourceUrls.length > 1 ? "s" : ""}</>
                )}
              </p>

              {confirmingDeleteId === skill.id && (
                <div style={styles.confirmBox}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#991b1b" }}>
                    Delete "{skill.title}" permanently?
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={() => { handleDeleteSkill(skill.id); setExpandedSkillId(null); }} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", backgroundColor: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Yes, delete</button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5f5", backgroundColor: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              {skill.tags.length > 0 && (
                <div style={{ margin: "12px 0" }}>
                  {skill.tags.map((tag) => <span key={tag} style={styles.pill}>{tag}</span>)}
                </div>
              )}

              <div style={{ whiteSpace: "pre-wrap", marginTop: "12px" }}>{skill.content}</div>

              {showQuickFacts && (
                <div style={{ marginTop: "12px" }}>
                  <strong>Quick Facts</strong>
                  <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                    {skill.quickFacts.map((fact, idx) => (
                      <li key={idx}><strong>Q:</strong> {fact.question} <br /><strong>A:</strong> {fact.answer}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showEdgeCases && (
                <div style={{ marginTop: "12px" }}>
                  <strong>Edge cases</strong>
                  <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                    {skill.edgeCases.map((ec, idx) => <li key={idx}>{ec}</li>)}
                  </ul>
                </div>
              )}

              {showSupportingInfo && (
                <div style={{ marginTop: "12px" }}>
                  <strong>Supporting information</strong>
                  {skill.information?.responseTemplate && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>{skill.information.responseTemplate}</p>}
                  {skill.information?.sources && skill.information.sources.length > 0 && (
                    <ul style={{ margin: "8px 0 0 20px" }}>
                      {skill.information.sources.map((source, idx) => <li key={idx}>{source}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Source URLs */}
              {skill.sourceUrls && skill.sourceUrls.length > 0 && (
                <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: "13px", color: "#475569" }}>Source URLs ({skill.sourceUrls.length})</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0, fontSize: "13px" }}>
                    {skill.sourceUrls.map((sourceUrl, idx) => (
                      <li key={idx} style={{ marginBottom: "4px" }}>
                        <a href={sourceUrl.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>
                          {sourceUrl.url}
                        </a>
                        <span style={{ color: "#94a3b8", marginLeft: "8px", fontSize: "12px" }}>
                          added {new Date(sourceUrl.addedAt).toLocaleDateString()}
                          {sourceUrl.lastFetchedAt && sourceUrl.lastFetchedAt !== sourceUrl.addedAt && (
                            <>, fetched {new Date(sourceUrl.lastFetchedAt).toLocaleDateString()}</>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Skill Owners */}
              <SkillOwnerEditor
                owners={skill.owners || []}
                onOwnersChange={(owners) => handleUpdateSkillOwners(skill.id, owners)}
              />

              {/* Change History */}
              <SkillHistoryViewer history={skill.history || []} />

              <div style={{ marginTop: "18px", borderTop: "1px dashed #e2e8f0", paddingTop: "16px" }}>
                <h3 style={{ marginTop: 0 }}>Refresh / Validate</h3>
                <p style={{ color: "#64748b", marginTop: "4px" }}>
                  {skill.sourceUrls && skill.sourceUrls.length > 0
                    ? "Re-fetch the original source URLs to check for updates, or add new sources."
                    : "Provide documentation links to build this skill."}
                </p>

                {/* Quick refresh button - only show if skill has source URLs and not in edit mode */}
                {skill.sourceUrls && skill.sourceUrls.length > 0 && !refreshState.isInputVisible && !refreshState.draftUpdate && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const urls = skill.sourceUrls.map(s => s.url).join("\n");
                        mergeRefreshState(skill.id, { sourceLinks: urls, isInputVisible: false, error: null });
                        handleRefreshSkill(skill.id, skill.sourceUrls.map(s => s.url));
                      }}
                      disabled={refreshState.isRefreshing}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: refreshState.isRefreshing ? "#94a3b8" : "#10b981",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: refreshState.isRefreshing ? "not-allowed" : "pointer",
                      }}
                    >
                      {refreshState.isRefreshing ? "Refreshing..." : `Refresh from ${skill.sourceUrls.length} source${skill.sourceUrls.length > 1 ? "s" : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mergeRefreshState(skill.id, {
                          isInputVisible: true,
                          sourceLinks: skill.sourceUrls.map(s => s.url).join("\n"),
                          error: null
                        })
                      }
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#fff",
                        color: "#475569",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Edit sources
                    </button>
                  </div>
                )}

                {refreshState.isRefreshing && !refreshState.isInputVisible && (
                  <LoadingSpinner
                    title="Analyzing source material..."
                    subtitle="Comparing with existing skill and generating update suggestions. This may take 15-30 seconds."
                  />
                )}

                {refreshState.isInputVisible ? (
                  <>
                    <textarea
                      value={refreshState.sourceLinks}
                      onChange={(e) => mergeRefreshState(skill.id, { sourceLinks: e.target.value })}
                      style={{ ...styles.input, minHeight: "80px", resize: "vertical" }}
                      placeholder="Source links (one per line)"
                    />
                    {refreshState.error && <div style={styles.error}>{refreshState.error}</div>}
                    <button
                      type="button"
                      onClick={() => handleRefreshSkill(skill.id)}
                      disabled={refreshState.isRefreshing}
                      style={{ padding: "10px 16px", borderRadius: "6px", border: "none", backgroundColor: refreshState.isRefreshing ? "#94a3b8" : "#0ea5e9", color: "#fff", fontWeight: 600, cursor: refreshState.isRefreshing ? "not-allowed" : "pointer", marginTop: "4px" }}
                    >
                      {refreshState.isRefreshing ? "Refreshing..." : "Generate refresh draft"}
                    </button>
                    {refreshState.isRefreshing && (
                      <LoadingSpinner
                        title="Analyzing source material..."
                        subtitle="Comparing with existing skill and generating update suggestions. This may take 15-30 seconds."
                      />
                    )}
                  </>
                ) : (
                  /* Only show "Update / Refresh skill" button if skill has no stored sourceUrls */
                  !skill.sourceUrls?.length && (
                    <button
                      type="button"
                      onClick={() => mergeRefreshState(skill.id, { isInputVisible: true, error: null })}
                      style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid #2563eb", backgroundColor: "#fff", color: "#2563eb", fontWeight: 600, cursor: "pointer" }}
                    >
                      Add source URLs
                    </button>
                  )
                )}

                {/* New: Draft-based update UI - LLM provides complete updated draft */}
                {refreshState.draftUpdate && (
                  <div style={{ marginTop: "16px" }}>
                    {refreshState.draftUpdate.hasChanges ? (
                      <>
                        <h4 style={{ marginBottom: "4px", color: "#0369a1" }}>
                          Review Proposed Changes
                        </h4>
                        <p style={{ color: "#64748b", marginTop: 0, marginBottom: "12px" }}>
                          {refreshState.draftUpdate.summary}
                        </p>

                        {/* Change highlights */}
                        {refreshState.draftUpdate.changeHighlights.length > 0 && (
                          <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#f0f9ff", borderRadius: "6px", border: "1px solid #bae6fd" }}>
                            <strong style={{ fontSize: "13px", color: "#0369a1" }}>What changed:</strong>
                            <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", color: "#475569", fontSize: "13px" }}>
                              {refreshState.draftUpdate.changeHighlights.map((highlight, idx) => (
                                <li key={idx} style={{ marginBottom: "4px" }}>{highlight}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* GitHub-style diff showing before/after */}
                        <GitHubDiff oldContent={skill.content} newContent={refreshState.draftUpdate.content} />

                        {/* New tags if any */}
                        {refreshState.draftUpdate.tags.length > 0 && refreshState.draftUpdate.tags.some(t => !skill.tags.includes(t)) && (
                          <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                            <strong style={{ fontSize: "12px", color: "#166534" }}>New tags:</strong>{" "}
                            {refreshState.draftUpdate.tags
                              .filter((t) => !skill.tags.includes(t))
                              .map((tag) => (
                                <span key={tag} style={{ display: "inline-block", padding: "2px 8px", marginLeft: "6px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "4px", fontSize: "11px" }}>
                                  + {tag}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Apply / Dismiss buttons */}
                        <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              // Apply the draft update
                              const now = new Date().toISOString();
                              const historyEntry: SkillHistoryEntry = {
                                date: now,
                                action: 'refreshed',
                                summary: refreshState.draftUpdate!.summary || 'Skill refreshed with proposed changes',
                              };
                              const updatedSkill: Skill = {
                                ...skill,
                                title: refreshState.draftUpdate!.title || skill.title,
                                content: refreshState.draftUpdate!.content,
                                tags: [...new Set([...skill.tags, ...refreshState.draftUpdate!.tags])],
                                lastRefreshedAt: now,
                                history: [...(skill.history || []), historyEntry],
                              };
                              setSkills((prev) => {
                                const updated = prev.map((s) => (s.id === skill.id ? updatedSkill : s));
                                saveSkillsToStorage(updated);
                                return updated;
                              });
                              mergeRefreshState(skill.id, { draftUpdate: undefined, isInputVisible: false, sourceLinks: "" });
                            }}
                            style={{ padding: "10px 16px", borderRadius: "6px", border: "none", backgroundColor: "#22c55e", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                          >
                            Apply Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => mergeRefreshState(skill.id, { draftUpdate: undefined })}
                            style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid #cbd5f5", backgroundColor: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </>
                    ) : (
                      // No changes needed
                      <div style={{ padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "20px" }}>✓</span>
                          <strong style={{ color: "#166534" }}>No updates needed</strong>
                        </div>
                        <p style={{ margin: 0, color: "#475569", fontSize: "13px" }}>
                          {refreshState.draftUpdate.summary}
                        </p>
                        <button
                          type="button"
                          onClick={() => mergeRefreshState(skill.id, { draftUpdate: undefined, isInputVisible: false, sourceLinks: "" })}
                          style={{ marginTop: "12px", padding: "8px 14px", borderRadius: "6px", border: "1px solid #bbf7d0", backgroundColor: "#fff", color: "#166534", fontWeight: 600, cursor: "pointer" }}
                        >
                          Got it
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy: Incremental update suggestions - GitHub-style side-by-side */}
                {refreshState.updates && (() => {
                  // Build proposed content with selected suggestions
                  // Start with current content
                  let proposedContent = skill.content;

                  // Helper to find and remove content with fuzzy matching
                  // Takes optional sectionHint to use as fallback when content is empty
                  const fuzzyRemove = (content: string, toRemove: string, sectionHint?: string): string => {
                    // If toRemove is empty, use section hint to find and remove that section
                    if (!toRemove || toRemove.trim().length === 0) {
                      if (sectionHint) {
                        // Try to find section by name in content
                        const sectionName = sectionHint.replace(/^#+\s*/, '').toLowerCase();
                        const lines = content.split('\n');
                        const headerIdx = lines.findIndex(l => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(sectionName));
                        if (headerIdx !== -1) {
                          // Find next header at same or higher level
                          const headerLevel = (lines[headerIdx].match(/^#+/) || [''])[0].length;
                          const nextHeaderIdx = lines.findIndex((l, i) => {
                            if (i <= headerIdx) return false;
                            const match = l.match(/^(#+)\s/);
                            return match && match[1].length <= headerLevel;
                          });
                          if (nextHeaderIdx !== -1) {
                            return [...lines.slice(0, headerIdx), ...lines.slice(nextHeaderIdx)].join('\n');
                          } else {
                            return lines.slice(0, headerIdx).join('\n');
                          }
                        }
                      }
                      return content;
                    }

                    // Strategy 1: Direct match - remove exactly that text
                    if (content.includes(toRemove)) {
                      return content.replace(toRemove, "");
                    }

                    // Strategy 2: Find contiguous block by first line match
                    // Look for the first non-empty line of toRemove in content
                    const removeLines = toRemove.split("\n").filter(l => l.trim().length > 0);
                    if (removeLines.length > 0) {
                      const firstLine = removeLines[0].trim();
                      const contentLines = content.split("\n");
                      // Find where this first line appears
                      const startIdx = contentLines.findIndex(l => {
                        const trimmed = l.trim();
                        // Match if line starts with or equals the first line (at least first 40 chars)
                        return trimmed === firstLine ||
                               (firstLine.length > 40 && trimmed.startsWith(firstLine.substring(0, 40)));
                      });
                      if (startIdx !== -1) {
                        // Remove a contiguous block of approximately the same length
                        const endIdx = Math.min(startIdx + removeLines.length, contentLines.length);
                        return [...contentLines.slice(0, startIdx), ...contentLines.slice(endIdx)].join("\n");
                      }
                    }

                    // Strategy 3: Look for section header in toRemove and remove that section
                    const sectionMatch = toRemove.match(/^(#{1,3}\s+.+)/m);
                    if (sectionMatch) {
                      const header = sectionMatch[1].trim();
                      const headerIdx = content.indexOf(header);
                      if (headerIdx !== -1) {
                        // Find next section header at same or higher level
                        const headerLevel = (header.match(/^#+/) || [''])[0].length;
                        const afterHeader = content.substring(headerIdx + header.length);
                        const nextSectionMatch = afterHeader.match(new RegExp(`\\n#{1,${headerLevel}}\\s`));
                        if (nextSectionMatch && nextSectionMatch.index !== undefined) {
                          return content.substring(0, headerIdx) + afterHeader.substring(nextSectionMatch.index);
                        } else {
                          // Remove to end
                          return content.substring(0, headerIdx).trim();
                        }
                      }
                    }

                    // Strategy 4: Use section hint as fallback if provided
                    if (sectionHint) {
                      const sectionName = sectionHint.replace(/^#+\s*/, '').toLowerCase();
                      const lines = content.split('\n');
                      const headerIdx = lines.findIndex(l => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(sectionName));
                      if (headerIdx !== -1) {
                        const headerLevel = (lines[headerIdx].match(/^#+/) || [''])[0].length;
                        const nextHeaderIdx = lines.findIndex((l, i) => {
                          if (i <= headerIdx) return false;
                          const match = l.match(/^(#+)\s/);
                          return match && match[1].length <= headerLevel;
                        });
                        if (nextHeaderIdx !== -1) {
                          return [...lines.slice(0, headerIdx), ...lines.slice(nextHeaderIdx)].join('\n');
                        } else {
                          return lines.slice(0, headerIdx).join('\n');
                        }
                      }
                    }

                    return content; // No match found
                  };

                  // Apply removals first (find and remove matching text)
                  refreshState.updates.suggestions.forEach((s, idx) => {
                    if ((refreshState.selectedSuggestions?.has(idx) ?? false) && s.action === "remove") {
                      proposedContent = fuzzyRemove(proposedContent, s.content, s.section);
                    }
                  });

                  // Apply modifications (replace section content)
                  refreshState.updates.suggestions.forEach((s, idx) => {
                    if ((refreshState.selectedSuggestions?.has(idx) ?? false) && s.action === "modify") {
                      // For modifications, append with a marker showing it's a replacement
                      proposedContent = proposedContent + "\n\n[UPDATED: " + s.section + "]\n" + s.content;
                    }
                  });

                  // Apply additions
                  const selectedAdditions = refreshState.updates.suggestions
                    .filter((s, idx) => (refreshState.selectedSuggestions?.has(idx) ?? false) && s.action === "add")
                    .map(s => s.content);
                  if (selectedAdditions.length > 0) {
                    proposedContent = proposedContent + "\n\n" + selectedAdditions.join("\n\n");
                  }

                  // Clean up extra newlines
                  proposedContent = proposedContent.replace(/\n{3,}/g, "\n\n").trim();

                  return (
                    <div style={{ marginTop: "16px" }}>
                      <h4 style={{ marginBottom: "4px", color: "#0369a1" }}>
                        Review Changes
                      </h4>
                      <p style={{ color: "#64748b", marginTop: 0, marginBottom: "12px" }}>
                        {refreshState.updates.summary}
                      </p>

                      {/* Suggestions to select */}
                      <div style={{ marginBottom: "16px" }}>
                        <h5 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#475569" }}>
                          Select changes to apply ({refreshState.selectedSuggestions?.size ?? 0} of {refreshState.updates.suggestions.length} selected):
                        </h5>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {refreshState.updates.suggestions.map((suggestion, idx) => {
                            const isSelected = refreshState.selectedSuggestions?.has(idx) ?? false;
                            // Check if content already exists (redundant) - only for adds
                            const isRedundant = suggestion.action === "add" && skill.content.toLowerCase().includes(suggestion.content.toLowerCase().substring(0, 50));
                            return (
                              <label key={idx} style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                                padding: "10px 12px",
                                borderRadius: "6px",
                                border: `1px solid ${isSelected ? (suggestion.action === "remove" ? "#fca5a5" : "#86efac") : "#e2e8f0"}`,
                                backgroundColor: isRedundant ? "#fef3c7" : (isSelected ? (suggestion.action === "remove" ? "#fef2f2" : "#f0fdf4") : "#fff"),
                                cursor: "pointer",
                              }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSuggestionSelection(skill.id, idx)}
                                  style={{ width: "16px", height: "16px", marginTop: "2px", cursor: "pointer" }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{
                                      padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                                      backgroundColor: suggestion.action === "add" ? "#dcfce7" : suggestion.action === "modify" ? "#fef3c7" : "#fee2e2",
                                      color: suggestion.action === "add" ? "#166534" : suggestion.action === "modify" ? "#92400e" : "#991b1b",
                                    }}>
                                      {suggestion.action}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: "13px" }}>{suggestion.section}</span>
                                    {isRedundant && (
                                      <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, backgroundColor: "#fef3c7", color: "#92400e" }}>
                                        Possibly redundant
                                      </span>
                                    )}
                                  </div>
                                  <p style={{ color: "#64748b", margin: 0, fontSize: "12px" }}>{suggestion.description}</p>
                                  {/* Show content preview for removals */}
                                  {suggestion.action === "remove" && (
                                    <pre style={{
                                      margin: "8px 0 0 0",
                                      padding: "8px",
                                      backgroundColor: "#fee2e2",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      color: "#991b1b",
                                      whiteSpace: "pre-wrap",
                                      maxHeight: "80px",
                                      overflow: "auto",
                                      textDecoration: "line-through"
                                    }}>
                                      {suggestion.content && suggestion.content.trim().length > 0
                                        ? `${suggestion.content.substring(0, 200)}${suggestion.content.length > 200 ? "..." : ""}`
                                        : `[Will remove section: ${suggestion.section}]`}
                                    </pre>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* GitHub-style diff */}
                      {(refreshState.selectedSuggestions?.size ?? 0) > 0 && (
                        <GitHubDiff oldContent={skill.content} newContent={proposedContent} />
                      )}

                      {(refreshState.selectedSuggestions?.size ?? 0) === 0 && (
                        <div style={{ padding: "24px", border: "1px dashed #d1d5db", borderRadius: "8px", textAlign: "center", color: "#6b7280" }}>
                          Select changes above to see a side-by-side diff preview
                        </div>
                      )}

                      {refreshState.updates.tags.length > 0 && refreshState.updates.tags.some(t => !skill.tags.includes(t)) && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                          <strong style={{ fontSize: "12px", color: "#166534" }}>New tags:</strong>{" "}
                          {refreshState.updates.tags
                            .filter((t) => !skill.tags.includes(t))
                            .map((tag) => (
                              <span key={tag} style={{ display: "inline-block", padding: "2px 8px", marginLeft: "6px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "4px", fontSize: "11px" }}>
                                + {tag}
                              </span>
                            ))}
                        </div>
                      )}

                      <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => handleApplySuggestion(skill.id)} disabled={(refreshState.selectedSuggestions?.size ?? 0) === 0}
                          style={{ padding: "10px 16px", borderRadius: "6px", border: "none", backgroundColor: (refreshState.selectedSuggestions?.size ?? 0) === 0 ? "#cbd5e1" : "#22c55e", color: "#fff", fontWeight: 600, cursor: (refreshState.selectedSuggestions?.size ?? 0) === 0 ? "not-allowed" : "pointer" }}>
                          Apply {refreshState.selectedSuggestions?.size ?? 0} selected
                        </button>
                        <button type="button" onClick={() => handleDismissSuggestion(skill.id)}
                          style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid #cbd5f5", backgroundColor: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Full draft mode (fallback) */}
                {refreshState.draft && (
                  <div style={{ marginTop: "16px" }}>
                    <h4 style={{ marginBottom: "4px" }}>Review suggested updates</h4>
                    <p style={{ color: "#64748b", marginTop: 0 }}>Apply only if the new content looks correct.</p>
                    {renderDiffBlock("Content", skill.content, refreshState.draft.content ?? "")}
                    <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => handleApplySuggestion(skill.id)}
                        style={{ padding: "10px 16px", borderRadius: "6px", border: "none", backgroundColor: "#22c55e", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                        Apply updates
                      </button>
                      <button type="button" onClick={() => handleDismissSuggestion(skill.id)}
                        style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid #cbd5f5", backgroundColor: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {filtered.length > 0 && viewMode === "list" && (
        /* List View - Full detail cards */
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
                {skill.sourceUrls && skill.sourceUrls.length > 0 && (
                  <>
                    {" "}
                    • {skill.sourceUrls.length} source URL{skill.sourceUrls.length > 1 ? "s" : ""}
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

              {/* Source URLs */}
              {skill.sourceUrls && skill.sourceUrls.length > 0 && (
                <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: "13px", color: "#475569" }}>Source URLs ({skill.sourceUrls.length})</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0, fontSize: "13px" }}>
                    {skill.sourceUrls.map((sourceUrl, idx) => (
                      <li key={`${skill.id}-url-${idx}`} style={{ marginBottom: "4px" }}>
                        <a href={sourceUrl.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>
                          {sourceUrl.url}
                        </a>
                        <span style={{ color: "#94a3b8", fontSize: "11px", marginLeft: "8px" }}>
                          added {new Date(sourceUrl.addedAt).toLocaleDateString()}
                          {sourceUrl.lastFetchedAt && sourceUrl.lastFetchedAt !== sourceUrl.addedAt && (
                            <>, fetched {new Date(sourceUrl.lastFetchedAt).toLocaleDateString()}</>
                          )}
                        </span>
                      </li>
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

              {/* Skill Owners */}
              <SkillOwnerEditor
                owners={skill.owners || []}
                onOwnersChange={(owners) => handleUpdateSkillOwners(skill.id, owners)}
              />

              {/* Change History */}
              <SkillHistoryViewer history={skill.history || []} />

              <div style={{ marginTop: "18px", borderTop: "1px dashed #e2e8f0", paddingTop: "16px" }}>
                <h3 style={{ marginTop: 0 }}>Refresh / Validate this skill</h3>
                <p style={{ color: "#64748b", marginTop: "4px" }}>
                  {skill.sourceUrls && skill.sourceUrls.length > 0
                    ? "Re-fetch the original source URLs to check for updates, or add new sources."
                    : "Provide documentation links to build this skill."}
                </p>

                {/* Quick refresh button - only show if skill has source URLs */}
                {skill.sourceUrls && skill.sourceUrls.length > 0 && !refreshState.isInputVisible && !refreshState.draftUpdate && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const urls = skill.sourceUrls.map(s => s.url).join("\n");
                        mergeRefreshState(skill.id, { sourceLinks: urls, isInputVisible: false, error: null });
                        // Trigger refresh directly
                        handleRefreshSkill(skill.id, skill.sourceUrls.map(s => s.url));
                      }}
                      disabled={refreshState.isRefreshing}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: refreshState.isRefreshing ? "#94a3b8" : "#10b981",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: refreshState.isRefreshing ? "not-allowed" : "pointer",
                      }}
                    >
                      {refreshState.isRefreshing ? "Refreshing..." : `Refresh from ${skill.sourceUrls.length} source${skill.sourceUrls.length > 1 ? "s" : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mergeRefreshState(skill.id, {
                          isInputVisible: true,
                          sourceLinks: skill.sourceUrls.map(s => s.url).join("\n"),
                          error: null
                        })
                      }
                      style={{
                        padding: "10px 16px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#fff",
                        color: "#475569",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Edit sources
                    </button>
                  </div>
                )}

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
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                        }}
                      >
                        {refreshState.isRefreshing ? "Refreshing..." : "Generate refresh draft"}
                      </button>
                      <button
                        type="button"
                        onClick={() => mergeRefreshState(skill.id, { isInputVisible: false, error: null })}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#fff",
                          color: "#64748b",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  !skill.sourceUrls?.length && (
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
                      Add source URLs
                    </button>
                  )
                )}

                {/* New: Draft-based update UI - LLM provides complete updated draft */}
                {refreshState.draftUpdate && (
                  <div style={{ marginTop: "16px" }}>
                    {refreshState.draftUpdate.hasChanges ? (
                      <>
                        <h4 style={{ marginBottom: "4px", color: "#0369a1" }}>
                          Review Proposed Changes
                        </h4>
                        <p style={{ color: "#64748b", marginTop: 0, marginBottom: "12px" }}>
                          {refreshState.draftUpdate.summary}
                        </p>

                        {/* Change highlights */}
                        {refreshState.draftUpdate.changeHighlights.length > 0 && (
                          <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#f0f9ff", borderRadius: "6px", border: "1px solid #bae6fd" }}>
                            <strong style={{ fontSize: "13px", color: "#0369a1" }}>What changed:</strong>
                            <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", color: "#475569", fontSize: "13px" }}>
                              {refreshState.draftUpdate.changeHighlights.map((highlight, idx) => (
                                <li key={idx} style={{ marginBottom: "4px" }}>{highlight}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* GitHub-style diff showing before/after */}
                        <GitHubDiff oldContent={skill.content} newContent={refreshState.draftUpdate.content} />

                        {/* New tags if any */}
                        {refreshState.draftUpdate.tags.length > 0 && refreshState.draftUpdate.tags.some(t => !skill.tags.includes(t)) && (
                          <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                            <strong style={{ fontSize: "12px", color: "#166534" }}>New tags:</strong>{" "}
                            {refreshState.draftUpdate.tags
                              .filter((t) => !skill.tags.includes(t))
                              .map((tag) => (
                                <span key={tag} style={{ display: "inline-block", padding: "2px 8px", marginLeft: "6px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "4px", fontSize: "11px" }}>
                                  + {tag}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Apply / Dismiss buttons */}
                        <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              // Apply the draft update
                              const now = new Date().toISOString();
                              const historyEntry: SkillHistoryEntry = {
                                date: now,
                                action: 'refreshed',
                                summary: refreshState.draftUpdate!.summary || 'Skill refreshed with proposed changes',
                              };
                              const updatedSkill: Skill = {
                                ...skill,
                                title: refreshState.draftUpdate!.title || skill.title,
                                content: refreshState.draftUpdate!.content,
                                tags: [...new Set([...skill.tags, ...refreshState.draftUpdate!.tags])],
                                lastRefreshedAt: now,
                                history: [...(skill.history || []), historyEntry],
                              };
                              setSkills((prev) => {
                                const updated = prev.map((s) => (s.id === skill.id ? updatedSkill : s));
                                saveSkillsToStorage(updated);
                                return updated;
                              });
                              mergeRefreshState(skill.id, { draftUpdate: undefined, isInputVisible: false, sourceLinks: "" });
                            }}
                            style={{ padding: "10px 16px", borderRadius: "6px", border: "none", backgroundColor: "#22c55e", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                          >
                            Apply Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => mergeRefreshState(skill.id, { draftUpdate: undefined })}
                            style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid #cbd5f5", backgroundColor: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </>
                    ) : (
                      // No changes needed
                      <div style={{ padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "20px" }}>✓</span>
                          <strong style={{ color: "#166534" }}>No updates needed</strong>
                        </div>
                        <p style={{ margin: 0, color: "#475569", fontSize: "13px" }}>
                          {refreshState.draftUpdate.summary}
                        </p>
                        <button
                          type="button"
                          onClick={() => mergeRefreshState(skill.id, { draftUpdate: undefined, isInputVisible: false, sourceLinks: "" })}
                          style={{ marginTop: "12px", padding: "8px 14px", borderRadius: "6px", border: "1px solid #bbf7d0", backgroundColor: "#fff", color: "#166534", fontWeight: 600, cursor: "pointer" }}
                        >
                          Got it
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy: Incremental update suggestions - GitHub-style side-by-side */}
                {refreshState.updates && (() => {
                  // Build proposed content with selected suggestions
                  // Start with current content
                  let proposedContent = skill.content;

                  // Helper to find and remove content with fuzzy matching
                  // Takes optional sectionHint to use as fallback when content is empty
                  const fuzzyRemove = (content: string, toRemove: string, sectionHint?: string): string => {
                    // If toRemove is empty, use section hint to find and remove that section
                    if (!toRemove || toRemove.trim().length === 0) {
                      if (sectionHint) {
                        // Try to find section by name in content
                        const sectionName = sectionHint.replace(/^#+\s*/, '').toLowerCase();
                        const lines = content.split('\n');
                        const headerIdx = lines.findIndex(l => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(sectionName));
                        if (headerIdx !== -1) {
                          // Find next header at same or higher level
                          const headerLevel = (lines[headerIdx].match(/^#+/) || [''])[0].length;
                          const nextHeaderIdx = lines.findIndex((l, i) => {
                            if (i <= headerIdx) return false;
                            const match = l.match(/^(#+)\s/);
                            return match && match[1].length <= headerLevel;
                          });
                          if (nextHeaderIdx !== -1) {
                            return [...lines.slice(0, headerIdx), ...lines.slice(nextHeaderIdx)].join('\n');
                          } else {
                            return lines.slice(0, headerIdx).join('\n');
                          }
                        }
                      }
                      return content;
                    }

                    // Strategy 1: Direct match - remove exactly that text
                    if (content.includes(toRemove)) {
                      return content.replace(toRemove, "");
                    }

                    // Strategy 2: Find contiguous block by first line match
                    // Look for the first non-empty line of toRemove in content
                    const removeLines = toRemove.split("\n").filter(l => l.trim().length > 0);
                    if (removeLines.length > 0) {
                      const firstLine = removeLines[0].trim();
                      const contentLines = content.split("\n");
                      // Find where this first line appears
                      const startIdx = contentLines.findIndex(l => {
                        const trimmed = l.trim();
                        // Match if line starts with or equals the first line (at least first 40 chars)
                        return trimmed === firstLine ||
                               (firstLine.length > 40 && trimmed.startsWith(firstLine.substring(0, 40)));
                      });
                      if (startIdx !== -1) {
                        // Remove a contiguous block of approximately the same length
                        const endIdx = Math.min(startIdx + removeLines.length, contentLines.length);
                        return [...contentLines.slice(0, startIdx), ...contentLines.slice(endIdx)].join("\n");
                      }
                    }

                    // Strategy 3: Look for section header in toRemove and remove that section
                    const sectionMatch = toRemove.match(/^(#{1,3}\s+.+)/m);
                    if (sectionMatch) {
                      const header = sectionMatch[1].trim();
                      const headerIdx = content.indexOf(header);
                      if (headerIdx !== -1) {
                        // Find next section header at same or higher level
                        const headerLevel = (header.match(/^#+/) || [''])[0].length;
                        const afterHeader = content.substring(headerIdx + header.length);
                        const nextSectionMatch = afterHeader.match(new RegExp(`\\n#{1,${headerLevel}}\\s`));
                        if (nextSectionMatch && nextSectionMatch.index !== undefined) {
                          return content.substring(0, headerIdx) + afterHeader.substring(nextSectionMatch.index);
                        } else {
                          // Remove to end
                          return content.substring(0, headerIdx).trim();
                        }
                      }
                    }

                    // Strategy 4: Use section hint as fallback if provided
                    if (sectionHint) {
                      const sectionName = sectionHint.replace(/^#+\s*/, '').toLowerCase();
                      const lines = content.split('\n');
                      const headerIdx = lines.findIndex(l => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(sectionName));
                      if (headerIdx !== -1) {
                        const headerLevel = (lines[headerIdx].match(/^#+/) || [''])[0].length;
                        const nextHeaderIdx = lines.findIndex((l, i) => {
                          if (i <= headerIdx) return false;
                          const match = l.match(/^(#+)\s/);
                          return match && match[1].length <= headerLevel;
                        });
                        if (nextHeaderIdx !== -1) {
                          return [...lines.slice(0, headerIdx), ...lines.slice(nextHeaderIdx)].join('\n');
                        } else {
                          return lines.slice(0, headerIdx).join('\n');
                        }
                      }
                    }

                    return content; // No match found
                  };

                  // Apply removals first (find and remove matching text)
                  refreshState.updates.suggestions.forEach((s, idx) => {
                    if ((refreshState.selectedSuggestions?.has(idx) ?? false) && s.action === "remove") {
                      proposedContent = fuzzyRemove(proposedContent, s.content, s.section);
                    }
                  });

                  // Apply modifications (replace section content)
                  refreshState.updates.suggestions.forEach((s, idx) => {
                    if ((refreshState.selectedSuggestions?.has(idx) ?? false) && s.action === "modify") {
                      // For modifications, append with a marker showing it's a replacement
                      proposedContent = proposedContent + "\n\n[UPDATED: " + s.section + "]\n" + s.content;
                    }
                  });

                  // Apply additions
                  const selectedAdditions = refreshState.updates.suggestions
                    .filter((s, idx) => (refreshState.selectedSuggestions?.has(idx) ?? false) && s.action === "add")
                    .map(s => s.content);
                  if (selectedAdditions.length > 0) {
                    proposedContent = proposedContent + "\n\n" + selectedAdditions.join("\n\n");
                  }

                  // Clean up extra newlines
                  proposedContent = proposedContent.replace(/\n{3,}/g, "\n\n").trim();

                  return (
                    <div style={{ marginTop: "16px" }}>
                      <h4 style={{ marginBottom: "4px", color: "#0369a1" }}>
                        Review Changes
                      </h4>
                      <p style={{ color: "#64748b", marginTop: 0, marginBottom: "12px" }}>
                        {refreshState.updates.summary}
                      </p>

                      {/* Suggestions to select */}
                      <div style={{ marginBottom: "16px" }}>
                        <h5 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#475569" }}>
                          Select changes to apply ({refreshState.selectedSuggestions?.size ?? 0} of {refreshState.updates.suggestions.length} selected):
                        </h5>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {refreshState.updates.suggestions.map((suggestion, idx) => {
                            const isSelected = refreshState.selectedSuggestions?.has(idx) ?? false;
                            // Check if content already exists (redundant) - only for adds
                            const isRedundant = suggestion.action === "add" && skill.content.toLowerCase().includes(suggestion.content.toLowerCase().substring(0, 50));
                            return (
                              <label key={`${skill.id}-suggestion-${idx}`} style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                                padding: "10px 12px",
                                borderRadius: "6px",
                                border: `1px solid ${isSelected ? (suggestion.action === "remove" ? "#fca5a5" : "#86efac") : "#e2e8f0"}`,
                                backgroundColor: isRedundant ? "#fef3c7" : (isSelected ? (suggestion.action === "remove" ? "#fef2f2" : "#f0fdf4") : "#fff"),
                                cursor: "pointer",
                              }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSuggestionSelection(skill.id, idx)}
                                  style={{ width: "16px", height: "16px", marginTop: "2px", cursor: "pointer" }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{
                                      padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                                      backgroundColor: suggestion.action === "add" ? "#dcfce7" : suggestion.action === "modify" ? "#fef3c7" : "#fee2e2",
                                      color: suggestion.action === "add" ? "#166534" : suggestion.action === "modify" ? "#92400e" : "#991b1b",
                                    }}>
                                      {suggestion.action}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: "13px" }}>{suggestion.section}</span>
                                    {isRedundant && (
                                      <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, backgroundColor: "#fef3c7", color: "#92400e" }}>
                                        Possibly redundant
                                      </span>
                                    )}
                                  </div>
                                  <p style={{ color: "#64748b", margin: 0, fontSize: "12px" }}>{suggestion.description}</p>
                                  {/* Show content preview for removals */}
                                  {suggestion.action === "remove" && (
                                    <pre style={{
                                      margin: "8px 0 0 0",
                                      padding: "8px",
                                      backgroundColor: "#fee2e2",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      color: "#991b1b",
                                      whiteSpace: "pre-wrap",
                                      maxHeight: "80px",
                                      overflow: "auto",
                                      textDecoration: "line-through"
                                    }}>
                                      {suggestion.content && suggestion.content.trim().length > 0
                                        ? `${suggestion.content.substring(0, 200)}${suggestion.content.length > 200 ? "..." : ""}`
                                        : `[Will remove section: ${suggestion.section}]`}
                                    </pre>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* GitHub-style diff */}
                      {(refreshState.selectedSuggestions?.size ?? 0) > 0 && (
                        <GitHubDiff oldContent={skill.content} newContent={proposedContent} />
                      )}

                      {(refreshState.selectedSuggestions?.size ?? 0) === 0 && (
                        <div style={{ padding: "24px", border: "1px dashed #d1d5db", borderRadius: "8px", textAlign: "center", color: "#6b7280" }}>
                          Select changes above to see a side-by-side diff preview
                        </div>
                      )}

                      {refreshState.updates.tags.length > 0 && refreshState.updates.tags.some(t => !skill.tags.includes(t)) && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                          <strong style={{ fontSize: "12px", color: "#166534" }}>New tags:</strong>{" "}
                          {refreshState.updates.tags
                            .filter((t) => !skill.tags.includes(t))
                            .map((tag) => (
                              <span key={tag} style={{ display: "inline-block", padding: "2px 8px", marginLeft: "6px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "4px", fontSize: "11px" }}>
                                + {tag}
                              </span>
                            ))}
                        </div>
                      )}

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
                  );
                })()}

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

      {/* Library Analysis Transparency Modal */}
      {analysisState.showTransparencyModal && analysisState.transparency && (
        <TransparencyModal
          title="Library Analysis Transparency"
          subtitle="See exactly what was sent to analyze your knowledge library"
          headerColor="purple"
          onClose={() => setAnalysisState(prev => ({ ...prev, showTransparencyModal: false }))}
          configs={[
            { label: "MODEL", value: analysisState.transparency.model, color: "purple" },
            { label: "MAX TOKENS", value: analysisState.transparency.maxTokens, color: "yellow" },
            { label: "TEMPERATURE", value: analysisState.transparency.temperature, color: "green" },
            { label: "SKILLS ANALYZED", value: analysisState.transparency.skillCount, color: "blue" },
          ]}
          systemPrompt={analysisState.transparency.systemPrompt}
          systemPromptNote={<>You can customize this prompt on the <a href="/prompts" style={{ color: "#6d28d9" }}>Prompts page</a></>}
          userPrompt={analysisState.transparency.userPrompt}
          userPromptLabel="User Prompt (Skills Data Sent)"
          userPromptNote={`Total user prompt: ${analysisState.transparency.userPrompt.length.toLocaleString()} characters`}
        />
      )}
    </div>
  );
}
