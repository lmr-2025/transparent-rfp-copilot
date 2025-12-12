"use client";

import { useEffect, useState, useRef } from "react";
import { loadSkillsFromStorage, saveSkillsToStorage } from "@/lib/skillStorage";
import { Skill, SourceUrl, SkillHistoryEntry, SkillCategoryItem } from "@/types/skill";
import { loadCategories } from "@/lib/categoryStorage";
import { defaultSkillSections, buildSkillPromptFromSections, EditableSkillSection } from "@/lib/promptSections";
import { SKILL_PROMPT_SECTIONS_KEY } from "@/lib/promptStorage";
import LoadingSpinner from "@/components/LoadingSpinner";

// Helper to load skill sections from localStorage
const loadSkillSections = (): EditableSkillSection[] => {
  if (typeof window === "undefined") {
    return defaultSkillSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
  }
  try {
    const raw = window.localStorage.getItem(SKILL_PROMPT_SECTIONS_KEY);
    if (!raw) {
      return defaultSkillSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
    }
    const parsed = JSON.parse(raw) as EditableSkillSection[];
    if (!Array.isArray(parsed)) {
      return defaultSkillSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
    }
    return parsed.map(section => ({
      ...section,
      enabled: section.enabled ?? true,
      text: section.text ?? section.defaultText ?? "",
    }));
  } catch {
    return defaultSkillSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
  }
};

type UploadStatus = {
  id: string;
  filename: string;
  status: "pending" | "processing" | "saved" | "error";
  message?: string;
};

type SkillDraft = {
  title: string;
  tags: string[];
  content: string;
  sourceMapping?: string[];
  // Store source URLs directly in the draft so they survive any re-renders
  _sourceUrls?: string[];
};

// Analysis result types
type SplitSuggestion = {
  title: string;
  category?: string;
  description: string;
  relevantUrls: string[];
};

type SkillSuggestion = {
  action: "create_new" | "update_existing" | "split_topics";
  existingSkillId?: string;
  existingSkillTitle?: string;
  suggestedTitle?: string;
  suggestedCategory?: string;
  suggestedTags?: string[];
  splitSuggestions?: SplitSuggestion[];
  reason: string;
};

type AnalysisResult = {
  suggestion: SkillSuggestion;
  sourcePreview: string;
  urlAlreadyUsed?: {
    skillId: string;
    skillTitle: string;
    matchedUrls: string[];
  };
};

const styles = {
  container: {
    maxWidth: "820px",
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
    marginTop: "12px",
  },
  queueCard: {
    border: "1px dashed #cbd5f5",
    borderRadius: "10px",
    padding: "12px",
    marginTop: "12px",
    backgroundColor: "#f8fafc",
  },
  queueItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "10px 12px",
    marginTop: "12px",
  },
};

const deriveTitleFromFilename = (filename: string) =>
  filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Untitled document";

export default function KnowledgeUploadPage() {
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());
  const [queue, setQueue] = useState<UploadStatus[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Skill builder from URLs
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<SkillDraft | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories] = useState<SkillCategoryItem[]>(() => loadCategories());
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedSplitIndex, setSelectedSplitIndex] = useState<number | null>(null);
  // Track the URLs used for the current build (to store in skill)
  const buildUrlsRef = useRef<string[]>([]);
  // Load configured skill prompt sections
  const [skillSections] = useState<EditableSkillSection[]>(() => loadSkillSections());

  useEffect(() => {
    saveSkillsToStorage(skills);
  }, [skills]);

  const updateQueueItem = (id: string, patch: Partial<UploadStatus>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  // Step 1: Analyze URLs to determine routing
  const handleAnalyzeUrls = async () => {
    setBuildError(null);
    setAnalysisResult(null);
    setGeneratedDraft(null);
    setSelectedSplitIndex(null);

    const urls = urlInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setBuildError("Please enter at least one URL");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Prepare existing skills summary for analysis (including sourceUrls for matching)
      const existingSkills = skills.map(s => ({
        id: s.id,
        title: s.title,
        tags: s.tags,
        contentPreview: s.content.substring(0, 500),
        sourceUrls: s.sourceUrls?.map(u => u.url) || [],
      }));

      const response = await fetch("/api/skills/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrls: urls, existingSkills }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze URLs");
      }

      const data = await response.json() as AnalysisResult;
      setAnalysisResult(data);
      // Set suggested category if provided
      if (data.suggestion.suggestedCategory) {
        setSelectedCategories([data.suggestion.suggestedCategory]);
      }
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Failed to analyze URLs");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Build skill based on analysis decision
  const handleBuildFromUrls = async (urlsOverride?: string[], forUpdate?: { skillId: string }) => {
    setBuildError(null);
    const urls = urlsOverride || urlInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setBuildError("Please enter at least one URL");
      return;
    }

    // Store URLs for later use when saving the skill
    buildUrlsRef.current = urls;

    setIsBuilding(true);
    try {
      // If updating existing skill, use update mode
      if (forUpdate) {
        const existingSkill = skills.find(s => s.id === forUpdate.skillId);
        if (!existingSkill) {
          throw new Error("Skill not found");
        }

        // Build the prompt from configured sections
        const configuredPrompt = buildSkillPromptFromSections(skillSections);

        const response = await fetch("/api/skills/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrls: urls,
            prompt: configuredPrompt,
            existingSkill: {
              title: existingSkill.title,
              content: existingSkill.content,
              tags: existingSkill.tags,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update skill");
        }

        const data = await response.json();
        if (data.draftMode && data.draft) {
          // Apply the update directly if has changes
          if (data.draft.hasChanges) {
            const now = new Date().toISOString();
            // Merge new URLs with existing ones (avoid duplicates)
            const existingUrls = existingSkill.sourceUrls || [];
            const existingUrlStrings = new Set(existingUrls.map(u => u.url));
            const newSourceUrls: SourceUrl[] = urls
              .filter(url => !existingUrlStrings.has(url))
              .map(url => ({ url, addedAt: now, lastFetchedAt: now }));
            // Update lastFetchedAt for URLs that were re-fetched
            const updatedExistingUrls = existingUrls.map(u =>
              urls.includes(u.url) ? { ...u, lastFetchedAt: now } : u
            );

            const updatedSkill: Skill = {
              ...existingSkill,
              title: data.draft.title || existingSkill.title,
              content: data.draft.content,
              tags: [...new Set([...existingSkill.tags, ...data.draft.tags])],
              sourceUrls: [...updatedExistingUrls, ...newSourceUrls],
              lastRefreshedAt: now,
            };
            setSkills((prev) => prev.map((s) => (s.id === existingSkill.id ? updatedSkill : s)));
            setAnalysisResult(null);
            setUrlInput("");
            alert(`Updated skill: "${existingSkill.title}"`);
          } else {
            alert("No significant changes found. The existing skill already covers this content.");
            setAnalysisResult(null);
          }
        }
      } else {
        // Create new skill
        const configuredPrompt = buildSkillPromptFromSections(skillSections);

        const response = await fetch("/api/skills/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrls: urls, prompt: configuredPrompt }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to build skill");
        }

        const data = await response.json();
        // Store URLs directly in the draft so they survive re-renders
        setGeneratedDraft({ ...data.draft, _sourceUrls: urls });
        setAnalysisResult(null);
      }
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Failed to build skill");
    } finally {
      setIsBuilding(false);
    }
  };

  // Handle building one of the split suggestions
  const handleBuildSplitSkill = async (split: SplitSuggestion, index: number) => {
    setSelectedSplitIndex(index);
    await handleBuildFromUrls(split.relevantUrls);
    setSelectedSplitIndex(null);
  };

  // Skip analysis and build directly (user override)
  const handleSkipAnalysis = () => {
    setAnalysisResult(null);
    handleBuildFromUrls();
  };

  const handleSaveDraft = () => {
    if (!generatedDraft) return;

    const now = new Date().toISOString();
    // Use URLs from draft (primary) or ref (fallback)
    const urlsToSave = generatedDraft._sourceUrls ?? buildUrlsRef.current;
    const sourceUrls: SourceUrl[] = urlsToSave.map(url => ({
      url,
      addedAt: now,
      lastFetchedAt: now,
    }));

    // Create initial history entry
    const history: SkillHistoryEntry[] = [{
      date: now,
      action: 'created',
      summary: `Skill created from ${urlsToSave.length} source URL${urlsToSave.length > 1 ? 's' : ''}`,
    }];

    const newSkill: Skill = {
      id: crypto.randomUUID(),
      title: generatedDraft.title,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      tags: generatedDraft.tags,
      content: generatedDraft.content,
      quickFacts: [],
      edgeCases: [],
      sourceUrls,
      isActive: true,
      createdAt: now,
      history,
    };

    setSkills((prev) => [newSkill, ...prev]);
    setGeneratedDraft(null);
    setSelectedCategories([]);
    setUrlInput("");
    buildUrlsRef.current = [];
  };

  const handleCancelDraft = () => {
    setGeneratedDraft(null);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) {
      return;
    }
    setErrorMessage(null);
    const files = Array.from(list);
    const newQueueEntries = files.map((file) => ({
      id: crypto.randomUUID(),
      filename: file.name,
      status: "pending" as const,
    }));
    setQueue((prev) => [...newQueueEntries, ...prev]);

    files.forEach((file, index) => {
      const queueId = newQueueEntries[index].id;
      updateQueueItem(queueId, { status: "processing" });
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        if (!text.trim()) {
          updateQueueItem(queueId, { status: "error", message: "File was empty" });
          return;
        }
        const createdAt = new Date().toISOString();
        const newSkill: Skill = {
          id: crypto.randomUUID(),
          title: deriveTitleFromFilename(file.name),
          tags: [],
          content: text,
          quickFacts: [],
          edgeCases: [],
          sourceUrls: [], // File uploads don't have source URLs
          isActive: true,
          createdAt,
          history: [{
            date: createdAt,
            action: 'created',
            summary: `Skill created from uploaded file: ${file.name}`,
          }],
        };
        setSkills((prev) => [newSkill, ...prev]);
        updateQueueItem(queueId, { status: "saved", message: "Saved" });
      };
      reader.onerror = () =>
        updateQueueItem(queueId, { status: "error", message: "Could not read file" });
      reader.readAsText(file);
    });
  };

  const recentUploads = [...skills]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div style={styles.container}>
        <h1>Knowledge Gremlin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Skill Builder)</span></h1>
      <p style={{ color: "#475569" }}>
        Build skills from documentation URLs or upload finalized files. Skills appear in the
        Knowledge Library instantly.
      </p>

      {/* Build Skill from URLs */}
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Build Skill from Documentation URLs</h3>
        <p style={{ color: "#64748b", fontSize: "14px" }}>
          Paste documentation URLs (one per line). The system will fetch and compile them into a skill.
        </p>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "8px" }}>
          <strong>Limits:</strong> Each URL is capped at 20,000 characters, with a total combined limit of 100,000 characters.
          For best results, use <strong>5-10 URLs</strong> of typical documentation pages.
        </p>
        <textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value.slice(0, 10000))}
          placeholder="https://example.com/docs/security&#10;https://example.com/docs/compliance&#10;https://example.com/docs/privacy"
          disabled={isBuilding || isAnalyzing || generatedDraft !== null || analysisResult !== null}
          maxLength={10000}
          style={{
            width: "100%",
            minHeight: "120px",
            padding: "10px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontFamily: "monospace",
            fontSize: "13px",
            resize: "vertical",
          }}
        />
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "4px",
          fontSize: "11px",
          color: urlInput.length > 9000 ? "#dc2626" : "#94a3b8",
        }}>
          {urlInput.length.toLocaleString()} / 10,000
        </div>
        <button
          onClick={handleAnalyzeUrls}
          disabled={isBuilding || isAnalyzing || !urlInput.trim() || generatedDraft !== null || analysisResult !== null}
          style={{
            marginTop: "12px",
            padding: "10px 20px",
            backgroundColor: isBuilding || isAnalyzing || !urlInput.trim() || generatedDraft !== null || analysisResult !== null ? "#cbd5e1" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: isBuilding || isAnalyzing || !urlInput.trim() || generatedDraft !== null || analysisResult !== null ? "not-allowed" : "pointer",
          }}
        >
          {isAnalyzing ? "Analyzing..." : "Analyze & Build Skill"}
        </button>
        {buildError && <div style={styles.error}>{buildError}</div>}
        {isAnalyzing && (
          <LoadingSpinner
            title="Analyzing source content..."
            subtitle="Checking if this should update an existing skill or create a new one. This takes 10-15 seconds."
          />
        )}
        {isBuilding && (
          <LoadingSpinner
            title="Building skill from documentation..."
            subtitle="Fetching URLs and generating structured knowledge. This may take 20-30 seconds."
          />
        )}

        {/* Analysis Result UI */}
        {analysisResult && !generatedDraft && !isBuilding && (
          <div style={{ marginTop: "16px" }}>
            {/* URL Already Used Notice */}
            {analysisResult.urlAlreadyUsed && (
              <div style={{
                padding: "12px",
                backgroundColor: "#fef9c3",
                borderRadius: "8px",
                border: "1px solid #fde047",
                marginBottom: "16px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}>
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: "13px", color: "#854d0e" }}>
                    URL already used in &quot;{analysisResult.urlAlreadyUsed.skillTitle}&quot;
                  </strong>
                  <p style={{ margin: "4px 0 0 0", color: "#a16207", fontSize: "12px" }}>
                    {analysisResult.urlAlreadyUsed.matchedUrls.length === 1
                      ? "This URL was"
                      : `${analysisResult.urlAlreadyUsed.matchedUrls.length} URLs were`} previously used to build that skill.
                    Updating will refresh the content from the source.
                  </p>
                </div>
              </div>
            )}

            {/* Source Preview */}
            <div style={{
              padding: "12px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              marginBottom: "16px",
            }}>
              <strong style={{ fontSize: "13px", color: "#475569" }}>Content detected:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                {analysisResult.sourcePreview}
              </p>
            </div>

            {/* Recommendation based on action type */}
            {analysisResult.suggestion.action === "update_existing" && (
              <div style={{
                padding: "16px",
                backgroundColor: "#fef3c7",
                borderRadius: "8px",
                border: "1px solid #fcd34d",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "18px" }}>📝</span>
                  <strong style={{ color: "#92400e" }}>Suggested: Update existing skill</strong>
                </div>
                <p style={{ margin: "0 0 12px 0", color: "#78350f", fontSize: "14px" }}>
                  This content looks related to <strong>&quot;{analysisResult.suggestion.existingSkillTitle}&quot;</strong>.
                </p>
                <p style={{ margin: "0 0 12px 0", color: "#92400e", fontSize: "13px" }}>
                  {analysisResult.suggestion.reason}
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleBuildFromUrls(undefined, { skillId: analysisResult.suggestion.existingSkillId! })}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#f59e0b",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Update &quot;{analysisResult.suggestion.existingSkillTitle}&quot;
                  </button>
                  <button
                    onClick={handleSkipAnalysis}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#fff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Create New Skill Instead
                  </button>
                  <button
                    onClick={() => setAnalysisResult(null)}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#fff",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {analysisResult.suggestion.action === "create_new" && (
              <div style={{
                padding: "16px",
                backgroundColor: "#dcfce7",
                borderRadius: "8px",
                border: "1px solid #86efac",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "18px" }}>✨</span>
                  <strong style={{ color: "#166534" }}>Ready to create new skill</strong>
                </div>
                <p style={{ margin: "0 0 8px 0", color: "#15803d", fontSize: "14px" }}>
                  Suggested title: <strong>&quot;{analysisResult.suggestion.suggestedTitle}&quot;</strong>
                </p>
                <p style={{ margin: "0 0 12px 0", color: "#166534", fontSize: "13px" }}>
                  {analysisResult.suggestion.reason}
                </p>
                {analysisResult.suggestion.suggestedTags && analysisResult.suggestion.suggestedTags.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#166534" }}>Suggested tags: </span>
                    {analysisResult.suggestion.suggestedTags.map((tag, i) => (
                      <span key={i} style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        marginLeft: "4px",
                        backgroundColor: "#bbf7d0",
                        color: "#166534",
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleBuildFromUrls()}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#22c55e",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Build Skill
                  </button>
                  <button
                    onClick={() => setAnalysisResult(null)}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#fff",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {analysisResult.suggestion.action === "split_topics" && analysisResult.suggestion.splitSuggestions && (
              <div style={{
                padding: "16px",
                backgroundColor: "#ede9fe",
                borderRadius: "8px",
                border: "1px solid #c4b5fd",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "18px" }}>🔀</span>
                  <strong style={{ color: "#5b21b6" }}>Multiple topics detected</strong>
                </div>
                <p style={{ margin: "0 0 12px 0", color: "#6d28d9", fontSize: "14px" }}>
                  {analysisResult.suggestion.reason}
                </p>
                <p style={{ margin: "0 0 12px 0", color: "#7c3aed", fontSize: "13px" }}>
                  Consider creating separate, focused skills for each topic:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                  {analysisResult.suggestion.splitSuggestions.map((split, idx) => (
                    <div key={idx} style={{
                      padding: "12px",
                      backgroundColor: "#fff",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <strong style={{ color: "#5b21b6", fontSize: "14px" }}>{split.title}</strong>
                          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "12px" }}>
                            {split.description}
                          </p>
                          <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "11px" }}>
                            {split.relevantUrls.length} URL(s)
                          </p>
                        </div>
                        <button
                          onClick={() => handleBuildSplitSkill(split, idx)}
                          disabled={selectedSplitIndex !== null}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: selectedSplitIndex === idx ? "#94a3b8" : "#8b5cf6",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            cursor: selectedSplitIndex !== null ? "not-allowed" : "pointer",
                            fontSize: "13px",
                          }}
                        >
                          {selectedSplitIndex === idx ? "Building..." : "Build This"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid #ddd6fe" }}>
                  <button
                    onClick={handleSkipAnalysis}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#fff",
                      color: "#5b21b6",
                      border: "1px solid #c4b5fd",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Build All as One Skill Anyway
                  </button>
                  <button
                    onClick={() => setAnalysisResult(null)}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#fff",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skill Prompt Preview */}
      <div style={{
        ...styles.card,
        backgroundColor: "#fafaf9",
        borderColor: "#d6d3d1",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>Claude Prompt for Skill Generation</h3>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            style={{
              padding: "6px 12px",
              backgroundColor: "#78716c",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {showPrompt ? "Hide Prompt" : "Show Prompt"}
          </button>
        </div>
        <p style={{ color: "#78716c", fontSize: "14px", margin: "0 0 12px 0" }}>
          This is the system prompt sent to Claude when building skills. To edit it, go to the{" "}
          <a href="/prompts" style={{ color: "#2563eb", fontWeight: 600 }}>
            Prompt Configuration
          </a>{" "}
          page.
        </p>
        {showPrompt && (
          <textarea
            value={buildSkillPromptFromSections(skillSections)}
            readOnly
            style={{
              width: "100%",
              minHeight: "400px",
              padding: "12px",
              border: "1px solid #d6d3d1",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "13px",
              resize: "vertical",
              backgroundColor: "#fff",
              color: "#44403c",
            }}
          />
        )}
      </div>

      {/* Generated Draft Review */}
      {generatedDraft && (
        <div style={{
          ...styles.card,
          backgroundColor: "#f0fdf4",
          border: "2px solid #86efac",
        }}>
          <h3 style={{ marginTop: 0, color: "#15803d" }}>Generated Skill - Review & Save</h3>
          <div style={{ marginBottom: "16px" }}>
            <strong>Title:</strong> {generatedDraft.title}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <strong>Categories:</strong>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "8px",
            }}>
              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.name);
                return (
                  <label
                    key={cat.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: isSelected ? "1px solid #818cf8" : "1px solid #cbd5e1",
                      backgroundColor: isSelected ? "#e0e7ff" : "#fff",
                      color: isSelected ? "#3730a3" : "#475569",
                      cursor: "pointer",
                      fontSize: "13px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, cat.name]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(c => c !== cat.name));
                        }
                      }}
                      style={{ margin: 0 }}
                    />
                    {cat.name}
                  </label>
                );
              })}
            </div>
            {selectedCategories.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                Select at least one category (optional)
              </p>
            )}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <strong>Tags:</strong> {generatedDraft.tags.join(", ") || "None"}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <strong>Content:</strong>
            <pre style={{
              backgroundColor: "#fff",
              padding: "12px",
              borderRadius: "6px",
              overflow: "auto",
              maxHeight: "300px",
              fontSize: "13px",
              whiteSpace: "pre-wrap",
            }}>
              {generatedDraft.content}
            </pre>
          </div>
          {generatedDraft.sourceMapping && generatedDraft.sourceMapping.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <strong>Sources:</strong>
              <ul style={{ margin: "4px 0 0 20px", fontSize: "13px" }}>
                {generatedDraft.sourceMapping.map((url, index) => (
                  <li key={index} style={{ marginBottom: "4px" }}>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleSaveDraft}
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
              Save to Library
            </button>
            <button
              onClick={handleCancelDraft}
              style={{
                padding: "10px 20px",
                backgroundColor: "#94a3b8",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      <h3 style={{ marginTop: "32px" }}>Or Upload Finalized Files</h3>
      <p style={{ color: "#64748b" }}>
        Supported formats: Markdown, TXT, CSV, JSON, or other UTF-8 text files. Keep files small
        enough to open in a browser for best results.
      </p>

      <div style={styles.card}>
        <label style={styles.label} htmlFor="file-input">
          Select one or more files
        </label>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".md,.txt,.csv,.log,.json"
          onChange={(event) => handleFiles(event.target.files)}
        />
        {errorMessage && <div style={styles.error}>{errorMessage}</div>}
      </div>

      {queue.length > 0 && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Upload queue</h3>
          <div style={styles.queueCard}>
            {queue.map((item) => (
              <div key={item.id} style={{ ...styles.queueItem, borderBottom: "1px solid #e2e8f0" }}>
                <span>{item.filename}</span>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      item.status === "saved"
                        ? "#15803d"
                        : item.status === "error"
                          ? "#b91c1c"
                          : "#0f172a",
                  }}
                >
                  {item.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Recently added</h3>
        {recentUploads.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>No uploads yet.</p>
        ) : (
          <ul style={{ margin: "0 0 0 16px", padding: 0 }}>
            {recentUploads.map((skill) => (
              <li key={skill.id} style={{ marginBottom: "8px" }}>
                <strong>{skill.title}</strong> — added{" "}
                {new Date(skill.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: "12px" }}>
          Head to the{" "}
          <a href="/knowledge/library" style={{ color: "#2563eb", fontWeight: 600 }}>
            Knowledge Library
          </a>{" "}
          to review, refresh, or delete uploads.
        </p>
      </div>
    </div>
  );
}
