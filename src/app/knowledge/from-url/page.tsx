"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { loadSkillsFromStorage, loadSkillsFromApi, createSkillViaApi, updateSkillViaApi } from "@/lib/skillStorage";
import { Skill, SourceUrl, SkillHistoryEntry, SkillCategoryItem } from "@/types/skill";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import { INPUT_LIMITS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import BuildTypeSelector, { BuildType } from "@/components/BuildTypeSelector";
import SkillDraftReview from "./components/SkillDraftReview";
import SnippetDraftReview from "./components/SnippetDraftReview";
import AnalysisResultPanel from "./components/AnalysisResultPanel";
import { styles } from "./styles";
import { UploadStatus, SkillDraft, SnippetDraft, AnalysisResult, SplitSuggestion } from "./types";

const deriveTitleFromFilename = (filename: string) =>
  filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Untitled document";

function KnowledgeUploadPageContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());
  const [queue, setQueue] = useState<UploadStatus[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Build type selector (skill vs snippet) - initialize from URL param
  const [buildType, setBuildType] = useState<BuildType>(() =>
    typeParam === "snippet" ? "snippet" : "skill"
  );

  // Skill builder from URLs
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<SkillDraft | null>(null);
  const [generatedSnippetDraft, setGeneratedSnippetDraft] = useState<SnippetDraft | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);
  const [selectedSplitIndex, setSelectedSplitIndex] = useState<number | null>(null);
  // Track the URLs used for the current build (to store in skill)
  const buildUrlsRef = useRef<string[]>([]);

  // Load skills and categories from API on mount
  useEffect(() => {
    loadSkillsFromApi().then(setSkills).catch(() => toast.error("Failed to load skills"));
    loadCategoriesFromApi().then(setCategories).catch(() => toast.error("Failed to load categories"));
  }, []);

  const updateQueueItem = (id: string, patch: Partial<UploadStatus>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  // Step 1: Analyze URLs to determine routing (or build snippet directly)
  const handleAnalyzeUrls = async () => {
    setBuildError(null);
    setAnalysisResult(null);
    setGeneratedDraft(null);
    setGeneratedSnippetDraft(null);
    setSelectedSplitIndex(null);

    const urls = urlInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setBuildError("Please enter at least one URL");
      return;
    }

    // For snippets, skip analysis and build directly
    if (buildType === "snippet") {
      await handleBuildSnippet(urls);
      return;
    }

    setIsAnalyzing(true);
    try {
      // Prepare existing skills summary for analysis (including sourceUrls for matching)
      const existingSkills = skills.map(s => ({
        id: s.id,
        title: s.title,
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
        throw new Error(getApiErrorMessage(errorData, "Failed to analyze URLs"));
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

  // Build a context snippet from URLs
  const handleBuildSnippet = async (urls: string[]) => {
    setBuildError(null);
    setIsBuilding(true);

    try {
      const response = await fetch("/api/context-snippets/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrls: urls }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(getApiErrorMessage(errorData, "Failed to build snippet"));
      }

      const data = await response.json();
      setGeneratedSnippetDraft({ ...data.draft, _sourceUrls: urls });
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Failed to build snippet");
    } finally {
      setIsBuilding(false);
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

        const response = await fetch("/api/skills/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrls: urls,
            existingSkill: {
              title: existingSkill.title,
              content: existingSkill.content,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(getApiErrorMessage(errorData, "Failed to update skill"));
        }

        const data = await response.json();
        if (data.draftMode && data.draft) {
          if (data.draft.hasChanges) {
            // Show review step instead of auto-saving
            setGeneratedDraft({
              title: data.draft.title || existingSkill.title,
              content: data.draft.content,
              _sourceUrls: urls,
              _isUpdate: true,
              _existingSkillId: existingSkill.id,
              _originalTitle: existingSkill.title,
              _originalContent: existingSkill.content,
              _changeHighlights: data.draft.changeHighlights || [],
              _changeSummary: data.draft.summary,
            });
            setAnalysisResult(null);
          } else {
            toast.info("No significant changes found. The existing skill already covers this content.");
            setAnalysisResult(null);
          }
        }
      } else {
        // Create new skill
        const response = await fetch("/api/skills/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrls: urls }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(getApiErrorMessage(errorData, "Failed to build skill"));
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

  const handleSaveDraft = async () => {
    if (!generatedDraft) return;

    const now = new Date().toISOString();
    const urlsToSave = generatedDraft._sourceUrls ?? buildUrlsRef.current;

    // Handle update mode
    if (generatedDraft._isUpdate && generatedDraft._existingSkillId) {
      const existingSkill = skills.find(s => s.id === generatedDraft._existingSkillId);
      if (!existingSkill) {
        toast.error("Original skill not found");
        return;
      }

      // Merge new URLs with existing ones (avoid duplicates)
      const existingUrls = existingSkill.sourceUrls || [];
      const existingUrlStrings = new Set(existingUrls.map(u => u.url));
      const newSourceUrls: SourceUrl[] = urlsToSave
        .filter(url => !existingUrlStrings.has(url))
        .map(url => ({ url, addedAt: now, lastFetchedAt: now }));
      // Update lastFetchedAt for URLs that were re-fetched
      const updatedExistingUrls = existingUrls.map(u =>
        urlsToSave.includes(u.url) ? { ...u, lastFetchedAt: now } : u
      );

      const updates = {
        title: generatedDraft.title,
        content: generatedDraft.content,
        sourceUrls: [...updatedExistingUrls, ...newSourceUrls],
        lastRefreshedAt: now,
      };

      try {
        const updatedSkill = await updateSkillViaApi(existingSkill.id, updates);
        setSkills((prev) => prev.map((s) => (s.id === existingSkill.id ? updatedSkill : s)));
        setGeneratedDraft(null);
        setSelectedCategories([]);
        setUrlInput("");
        buildUrlsRef.current = [];
        toast.success(`Updated skill: "${generatedDraft.title}"`);
      } catch (error) {
        console.error("Failed to update skill:", error);
        toast.error("Failed to update skill. Please try again.");
      }
      return;
    }

    // Create new skill mode
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

    const skillData = {
      title: generatedDraft.title,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      content: generatedDraft.content,
      quickFacts: [],
      edgeCases: [],
      sourceUrls,
      isActive: true,
      history,
    };

    try {
      // Save to database via API
      const newSkill = await createSkillViaApi(skillData);
      setSkills((prev) => [newSkill, ...prev]);
      setGeneratedDraft(null);
      setSelectedCategories([]);
      setUrlInput("");
      buildUrlsRef.current = [];
    } catch (error) {
      console.error("Failed to save skill:", error);
      toast.error("Failed to save skill. Please try again.");
    }
  };

  const handleCancelDraft = () => {
    setGeneratedDraft(null);
  };

  const handleSaveSnippetDraft = async () => {
    if (!generatedSnippetDraft) return;

    try {
      const response = await fetch("/api/context-snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: generatedSnippetDraft.name,
          key: generatedSnippetDraft.key,
          content: generatedSnippetDraft.content,
          category: generatedSnippetDraft.category,
          description: generatedSnippetDraft.description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(getApiErrorMessage(errorData, "Failed to save snippet"));
      }

      setGeneratedSnippetDraft(null);
      setUrlInput("");
      toast.success(`Snippet "${generatedSnippetDraft.name}" saved!`);
    } catch (error) {
      console.error("Failed to save snippet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save snippet. Please try again.");
    }
  };

  const handleCancelSnippetDraft = () => {
    setGeneratedSnippetDraft(null);
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
      reader.onload = async () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        if (!text.trim()) {
          updateQueueItem(queueId, { status: "error", message: "File was empty" });
          return;
        }
        const skillData = {
          title: deriveTitleFromFilename(file.name),
          tags: [] as string[],
          content: text,
          quickFacts: [] as { question: string; answer: string }[],
          edgeCases: [] as string[],
          sourceUrls: [] as SourceUrl[], // File uploads don't have source URLs
          isActive: true,
          history: [{
            date: new Date().toISOString(),
            action: 'created' as const,
            summary: `Skill created from uploaded file: ${file.name}`,
          }],
        };
        try {
          const newSkill = await createSkillViaApi(skillData);
          setSkills((prev) => [newSkill, ...prev]);
          updateQueueItem(queueId, { status: "saved", message: "Saved" });
        } catch (error) {
          console.error("Failed to save skill:", error);
          updateQueueItem(queueId, { status: "error", message: "Failed to save" });
        }
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
        <h1>Knowledge Gremlin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Content Builder)</span></h1>
      <p style={{ color: "#475569" }}>
        Build knowledge skills or context snippets from documentation URLs. Content appears in the
        Knowledge Library instantly.
      </p>

      {/* Build from URLs */}
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>What do you want to build?</h3>
        <BuildTypeSelector
          value={buildType}
          onChange={setBuildType}
          disabled={isBuilding || isAnalyzing || generatedDraft !== null || generatedSnippetDraft !== null || analysisResult !== null}
        />

        <h3 style={{ marginTop: "24px", marginBottom: "12px" }}>Build from Documentation URLs</h3>
        <p style={{ color: "#64748b", fontSize: "14px" }}>
          Paste documentation URLs (one per line). The system will fetch and compile them into {buildType === "skill" ? "a skill" : "a context snippet"}.
        </p>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "8px" }}>
          <strong>Limits:</strong> Each URL is capped at 20,000 characters, with a total combined limit of 100,000 characters.
          For best results, use <strong>5-10 URLs</strong> of typical documentation pages.
        </p>
        <textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value.slice(0, INPUT_LIMITS.URL_INPUT))}
          placeholder="https://example.com/docs/security&#10;https://example.com/docs/compliance&#10;https://example.com/docs/privacy"
          disabled={isBuilding || isAnalyzing || generatedDraft !== null || generatedSnippetDraft !== null || analysisResult !== null}
          maxLength={INPUT_LIMITS.URL_INPUT}
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
          disabled={isBuilding || isAnalyzing || !urlInput.trim() || generatedDraft !== null || generatedSnippetDraft !== null || analysisResult !== null}
          style={{
            marginTop: "12px",
            padding: "10px 20px",
            backgroundColor: isBuilding || isAnalyzing || !urlInput.trim() || generatedDraft !== null || generatedSnippetDraft !== null || analysisResult !== null ? "#cbd5e1" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: isBuilding || isAnalyzing || !urlInput.trim() || generatedDraft !== null || generatedSnippetDraft !== null || analysisResult !== null ? "not-allowed" : "pointer",
          }}
        >
          {isAnalyzing ? "Analyzing..." : isBuilding ? "Building..." : buildType === "skill" ? "Analyze & Build Skill" : "Build Snippet"}
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
            title={buildType === "skill" ? "Building skill from documentation..." : "Building snippet from documentation..."}
            subtitle={buildType === "skill" ? "Fetching URLs and generating structured knowledge. This may take 20-30 seconds." : "Fetching URLs and extracting reusable content. This may take 15-20 seconds."}
          />
        )}

        {/* Analysis Result UI */}
        {analysisResult && !generatedDraft && !isBuilding && (
          <AnalysisResultPanel
            analysisResult={analysisResult}
            selectedSplitIndex={selectedSplitIndex}
            onBuildFromUrls={handleBuildFromUrls}
            onSkipAnalysis={handleSkipAnalysis}
            onBuildSplitSkill={handleBuildSplitSkill}
            onCancel={() => setAnalysisResult(null)}
          />
        )}
      </div>

      {/* Generated Draft Review */}
      {generatedDraft && (
        <SkillDraftReview
          draft={generatedDraft}
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
          onSave={handleSaveDraft}
          onCancel={handleCancelDraft}
        />
      )}

      {/* Generated Snippet Draft Review */}
      {generatedSnippetDraft && (
        <SnippetDraftReview
          draft={generatedSnippetDraft}
          onSave={handleSaveSnippetDraft}
          onCancel={handleCancelSnippetDraft}
        />
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
          <a href="/knowledge" style={{ color: "#2563eb", fontWeight: 600 }}>
            Knowledge Library
          </a>{" "}
          to review, refresh, or delete uploads.
        </p>
      </div>
    </div>
  );
}

export default function KnowledgeUploadPage() {
  return (
    <Suspense fallback={<div style={styles.container}><p style={{ color: "#64748b", textAlign: "center" }}>Loading...</p></div>}>
      <KnowledgeUploadPageContent />
    </Suspense>
  );
}
