"use client";

import { useEffect, useState, useCallback } from "react";
import { loadSkillsFromStorage, saveSkillsToStorage } from "@/lib/skillStorage";
import { Skill, SourceUrl, SkillHistoryEntry } from "@/types/skill";
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

type UrlStatus = "pending" | "analyzing" | "building" | "done" | "error" | "skipped" | "duplicate";

type UrlQueueItem = {
  id: string;
  url: string;
  status: UrlStatus;
  message?: string;
  // Analysis result
  analysis?: {
    action: "create_new" | "update_existing" | "skip";
    existingSkillId?: string;
    existingSkillTitle?: string;
    suggestedTitle?: string;
    reason: string;
    urlAlreadyUsed?: boolean;
  };
  // Result
  skillId?: string;
  skillTitle?: string;
};

type ProcessedResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  duplicates: number;
};

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
};

export default function BulkUrlImportPage() {
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());
  const [urlInput, setUrlInput] = useState("");
  const [queue, setQueue] = useState<UrlQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<ProcessedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skillSections] = useState<EditableSkillSection[]>(() => loadSkillSections());

  useEffect(() => {
    saveSkillsToStorage(skills);
  }, [skills]);

  const updateQueueItem = useCallback((id: string, patch: Partial<UrlQueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  // Parse URLs from input
  const parseUrls = (input: string): string[] => {
    return input
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => {
        if (!url) return false;
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      });
  };

  // Check if URL is already used in any skill
  const findExistingUrlUsage = useCallback((url: string): { skillId: string; skillTitle: string } | null => {
    const normalizedUrl = url.toLowerCase().replace(/\/+$/, "");
    for (const skill of skills) {
      if (!skill.sourceUrls) continue;
      const skillUrls = skill.sourceUrls.map(u => u.url.toLowerCase().replace(/\/+$/, ""));
      if (skillUrls.includes(normalizedUrl)) {
        return { skillId: skill.id, skillTitle: skill.title };
      }
    }
    return null;
  }, [skills]);

  // Initialize queue from URL input
  const handleInitQueue = () => {
    setErrorMessage(null);
    setProcessedResult(null);

    const urls = parseUrls(urlInput);
    if (urls.length === 0) {
      setErrorMessage("Please enter at least one valid URL");
      return;
    }

    // Check for duplicates within the input
    const seenUrls = new Set<string>();
    const queueItems: UrlQueueItem[] = [];

    for (const url of urls) {
      const normalizedUrl = url.toLowerCase().replace(/\/+$/, "");

      // Check if already in this batch
      if (seenUrls.has(normalizedUrl)) {
        continue; // Skip duplicate in input
      }
      seenUrls.add(normalizedUrl);

      // Check if already used in existing skill
      const existingUsage = findExistingUrlUsage(url);

      queueItems.push({
        id: crypto.randomUUID(),
        url,
        status: existingUsage ? "duplicate" : "pending",
        message: existingUsage ? `Already in "${existingUsage.skillTitle}"` : undefined,
        analysis: existingUsage ? {
          action: "update_existing",
          existingSkillId: existingUsage.skillId,
          existingSkillTitle: existingUsage.skillTitle,
          reason: "URL already used in this skill",
          urlAlreadyUsed: true,
        } : undefined,
      });
    }

    setQueue(queueItems);
    setUrlInput("");
  };

  // Analyze a single URL
  const analyzeUrl = async (item: UrlQueueItem): Promise<UrlQueueItem["analysis"]> => {
    const existingSkillsInfo = skills.map(s => ({
      id: s.id,
      title: s.title,
      tags: s.tags,
      contentPreview: s.content.substring(0, 500),
      sourceUrls: s.sourceUrls?.map(u => u.url) || [],
    }));

    const response = await fetch("/api/skills/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceUrls: [item.url],
        existingSkills: existingSkillsInfo,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Analysis failed");
    }

    const data = await response.json();

    // Map to our simplified analysis structure
    return {
      action: data.suggestion.action === "split_topics" ? "create_new" : data.suggestion.action,
      existingSkillId: data.suggestion.existingSkillId,
      existingSkillTitle: data.suggestion.existingSkillTitle,
      suggestedTitle: data.suggestion.suggestedTitle,
      reason: data.suggestion.reason,
      urlAlreadyUsed: !!data.urlAlreadyUsed,
    };
  };

  // Build/update skill from URL
  const buildSkillFromUrl = async (
    item: UrlQueueItem,
    analysis: NonNullable<UrlQueueItem["analysis"]>
  ): Promise<{ skillId: string; skillTitle: string }> => {
    const configuredPrompt = buildSkillPromptFromSections(skillSections);

    if (analysis.action === "update_existing" && analysis.existingSkillId) {
      // Update existing skill
      const existingSkill = skills.find(s => s.id === analysis.existingSkillId);
      if (!existingSkill) {
        throw new Error("Skill not found for update");
      }

      const response = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: [item.url],
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
        throw new Error(errorData.error || "Build failed");
      }

      const data = await response.json();

      if (data.draftMode && data.draft) {
        if (data.draft.hasChanges) {
          const now = new Date().toISOString();
          const existingUrls = existingSkill.sourceUrls || [];
          const existingUrlStrings = new Set(existingUrls.map(u => u.url.toLowerCase().replace(/\/+$/, "")));
          const normalizedNewUrl = item.url.toLowerCase().replace(/\/+$/, "");

          // Add new URL if not already present
          const newSourceUrls: SourceUrl[] = existingUrlStrings.has(normalizedNewUrl)
            ? []
            : [{ url: item.url, addedAt: now, lastFetchedAt: now }];

          // Update lastFetchedAt for existing URL if it was re-fetched
          const updatedExistingUrls = existingUrls.map(u =>
            u.url.toLowerCase().replace(/\/+$/, "") === normalizedNewUrl
              ? { ...u, lastFetchedAt: now }
              : u
          );

          const updatedSkill: Skill = {
            ...existingSkill,
            title: data.draft.title || existingSkill.title,
            content: data.draft.content,
            tags: [...new Set([...existingSkill.tags, ...data.draft.tags])],
            sourceUrls: [...updatedExistingUrls, ...newSourceUrls],
            lastRefreshedAt: now,
            history: [
              ...(existingSkill.history || []),
              {
                date: now,
                action: "updated",
                summary: `Updated from bulk import: ${item.url}`,
              },
            ],
          };

          setSkills(prev => prev.map(s => s.id === existingSkill.id ? updatedSkill : s));
          return { skillId: existingSkill.id, skillTitle: existingSkill.title };
        } else {
          // No changes needed - skill already has this content
          throw new Error("NO_CHANGES");
        }
      }

      throw new Error("Unexpected response format");
    } else {
      // Create new skill
      const response = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: [item.url],
          prompt: configuredPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Build failed");
      }

      const data = await response.json();
      const draft = data.draft;

      const now = new Date().toISOString();
      const sourceUrls: SourceUrl[] = [{
        url: item.url,
        addedAt: now,
        lastFetchedAt: now,
      }];

      const history: SkillHistoryEntry[] = [{
        date: now,
        action: "created",
        summary: `Created from bulk URL import`,
      }];

      const newSkill: Skill = {
        id: crypto.randomUUID(),
        title: draft.title,
        tags: draft.tags,
        content: draft.content,
        quickFacts: [],
        edgeCases: [],
        sourceUrls,
        isActive: true,
        createdAt: now,
        history,
      };

      setSkills(prev => [newSkill, ...prev]);
      return { skillId: newSkill.id, skillTitle: newSkill.title };
    }
  };

  // Process a single queue item
  const processQueueItem = async (item: UrlQueueItem): Promise<void> => {
    // Skip duplicates that user didn't explicitly include
    if (item.status === "duplicate") {
      return;
    }

    try {
      // Step 1: Analyze
      updateQueueItem(item.id, { status: "analyzing", message: "Analyzing content..." });
      const analysisResult = await analyzeUrl(item);

      if (!analysisResult) {
        updateQueueItem(item.id, {
          status: "error",
          message: "Analysis returned no result",
        });
        return;
      }

      updateQueueItem(item.id, { analysis: analysisResult });

      // Step 2: Build or skip
      if (analysisResult.action === "skip") {
        updateQueueItem(item.id, {
          status: "skipped",
          message: analysisResult.reason
        });
        return;
      }

      updateQueueItem(item.id, {
        status: "building",
        message: analysisResult.action === "update_existing"
          ? `Updating "${analysisResult.existingSkillTitle}"...`
          : `Creating "${analysisResult.suggestedTitle || "new skill"}"...`
      });

      const result = await buildSkillFromUrl(item, analysisResult);
      updateQueueItem(item.id, {
        status: "done",
        skillId: result.skillId,
        skillTitle: result.skillTitle,
        message: analysisResult.action === "update_existing"
          ? `Updated "${result.skillTitle}"`
          : `Created "${result.skillTitle}"`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "NO_CHANGES") {
        updateQueueItem(item.id, {
          status: "skipped",
          message: "No new content to add",
        });
      } else {
        updateQueueItem(item.id, {
          status: "error",
          message,
        });
      }
    }
  };

  // Process entire queue
  const processQueue = async () => {
    setIsProcessing(true);
    setProcessedResult(null);

    const pendingItems = queue.filter(item => item.status === "pending");

    for (const item of pendingItems) {
      await processQueueItem(item);
      // Small delay between items to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate results
    const results: ProcessedResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      duplicates: 0,
    };

    setQueue(prev => {
      prev.forEach(item => {
        if (item.status === "done") {
          if (item.analysis?.action === "update_existing") {
            results.updated++;
          } else {
            results.created++;
          }
        } else if (item.status === "skipped") {
          results.skipped++;
        } else if (item.status === "error") {
          results.errors++;
        } else if (item.status === "duplicate") {
          results.duplicates++;
        }
      });
      return prev;
    });

    setProcessedResult(results);
    setIsProcessing(false);
  };

  // Include duplicate URLs for processing
  const includeDuplicateForProcessing = (id: string) => {
    updateQueueItem(id, { status: "pending", message: "Will refresh content" });
  };

  // Reset everything
  const handleReset = () => {
    setQueue([]);
    setProcessedResult(null);
    setErrorMessage(null);
  };

  const pendingCount = queue.filter(i => i.status === "pending").length;
  const duplicateCount = queue.filter(i => i.status === "duplicate").length;
  const processingCount = queue.filter(i => i.status === "analyzing" || i.status === "building").length;

  return (
    <div style={styles.container}>
      <h1>
        Knowledge Gremlin{" "}
        <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>
          (Bulk URL Import)
        </span>
      </h1>
      <p style={{ color: "#475569", marginBottom: "24px" }}>
        Paste a large batch of documentation URLs. The system will analyze each one, detect duplicates,
        determine if it fits an existing skill or needs a new one, and process them automatically.
      </p>

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}

      {processedResult && (
        <div style={styles.success}>
          <strong>Processing complete!</strong>
          <div style={{ marginTop: "8px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ color: "#15803d" }}>{processedResult.created} created</span>
            <span style={{ color: "#0369a1" }}>{processedResult.updated} updated</span>
            <span style={{ color: "#ca8a04" }}>{processedResult.skipped} skipped</span>
            {processedResult.errors > 0 && (
              <span style={{ color: "#dc2626" }}>{processedResult.errors} errors</span>
            )}
            {processedResult.duplicates > 0 && (
              <span style={{ color: "#7c3aed" }}>{processedResult.duplicates} duplicates (not processed)</span>
            )}
          </div>
        </div>
      )}

      {/* URL Input Section */}
      {queue.length === 0 && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Step 1: Paste URLs</h3>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "12px" }}>
            Paste documentation URLs (one per line or comma-separated).
            The system will automatically detect which ones are new vs. already used.
          </p>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://docs.example.com/security&#10;https://docs.example.com/compliance&#10;https://docs.example.com/privacy&#10;..."
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "12px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "13px",
              resize: "vertical",
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "12px"
          }}>
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>
              {parseUrls(urlInput).length} valid URLs detected
            </span>
            <button
              onClick={handleInitQueue}
              disabled={parseUrls(urlInput).length === 0}
              style={{
                padding: "10px 20px",
                backgroundColor: parseUrls(urlInput).length === 0 ? "#cbd5e1" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: parseUrls(urlInput).length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Analyze URLs
            </button>
          </div>
        </div>
      )}

      {/* Queue Section */}
      {queue.length > 0 && (
        <>
          <div style={styles.card}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}>
              <h3 style={{ margin: 0 }}>Step 2: Review Queue ({queue.length} URLs)</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                {!isProcessing && pendingCount > 0 && (
                  <button
                    onClick={processQueue}
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
                    Process {pendingCount} URL{pendingCount !== 1 ? "s" : ""}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontWeight: 500,
                    cursor: isProcessing ? "not-allowed" : "pointer",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Summary stats */}
            <div style={{
              display: "flex",
              gap: "16px",
              padding: "12px",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              marginBottom: "16px",
              fontSize: "14px",
            }}>
              <span>
                <strong style={{ color: "#64748b" }}>{pendingCount}</strong> pending
              </span>
              {duplicateCount > 0 && (
                <span>
                  <strong style={{ color: "#7c3aed" }}>{duplicateCount}</strong> already used
                </span>
              )}
              {processingCount > 0 && (
                <span>
                  <strong style={{ color: "#0ea5e9" }}>{processingCount}</strong> processing
                </span>
              )}
            </div>

            {/* Queue items */}
            <div style={{
              maxHeight: "500px",
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
            }}>
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: index < queue.length - 1 ? "1px solid #f1f5f9" : "none",
                    backgroundColor: item.status === "done"
                      ? "#f0fdf4"
                      : item.status === "error"
                        ? "#fef2f2"
                        : item.status === "duplicate"
                          ? "#faf5ff"
                          : item.status === "skipped"
                            ? "#fefce8"
                            : "#fff",
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "monospace",
                        fontSize: "13px",
                        color: "#475569",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {item.url}
                      </div>
                      {item.message && (
                        <div style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: item.status === "error"
                            ? "#dc2626"
                            : item.status === "done"
                              ? "#15803d"
                              : item.status === "duplicate"
                                ? "#7c3aed"
                                : "#64748b",
                        }}>
                          {item.message}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {item.status === "duplicate" && !isProcessing && (
                        <button
                          onClick={() => includeDuplicateForProcessing(item.id)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#7c3aed",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Refresh
                        </button>
                      )}
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor:
                          item.status === "pending" ? "#f1f5f9" :
                          item.status === "analyzing" ? "#dbeafe" :
                          item.status === "building" ? "#dbeafe" :
                          item.status === "done" ? "#dcfce7" :
                          item.status === "error" ? "#fee2e2" :
                          item.status === "duplicate" ? "#ede9fe" :
                          "#fef3c7",
                        color:
                          item.status === "pending" ? "#64748b" :
                          item.status === "analyzing" ? "#1e40af" :
                          item.status === "building" ? "#1e40af" :
                          item.status === "done" ? "#166534" :
                          item.status === "error" ? "#dc2626" :
                          item.status === "duplicate" ? "#7c3aed" :
                          "#92400e",
                      }}>
                        {item.status === "analyzing" && "Analyzing..."}
                        {item.status === "building" && "Building..."}
                        {item.status === "pending" && "Pending"}
                        {item.status === "done" && (item.analysis?.action === "update_existing" ? "Updated" : "Created")}
                        {item.status === "error" && "Error"}
                        {item.status === "duplicate" && "Already Used"}
                        {item.status === "skipped" && "Skipped"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isProcessing && (
            <LoadingSpinner
              title="Processing URLs..."
              subtitle={`Analyzing and building skills from ${pendingCount} URLs. This may take a few minutes.`}
            />
          )}
        </>
      )}

      {/* Current Skills Info */}
      <div style={{
        ...styles.card,
        backgroundColor: "#f8fafc",
        borderColor: "#e2e8f0",
      }}>
        <h3 style={{ marginTop: 0 }}>Current Skill Library</h3>
        <p style={{ color: "#64748b", marginBottom: "12px" }}>
          You have <strong>{skills.length}</strong> skills. URLs will be matched against these
          to determine if content should update an existing skill or create a new one.
        </p>
        {skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {skills.slice(0, 15).map((skill) => (
              <span
                key={skill.id}
                style={{
                  padding: "4px 10px",
                  backgroundColor: skill.isActive ? "#dbeafe" : "#f1f5f9",
                  color: skill.isActive ? "#1e40af" : "#94a3b8",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                {skill.title}
              </span>
            ))}
            {skills.length > 15 && (
              <span style={{ color: "#94a3b8", fontSize: "13px", padding: "4px" }}>
                +{skills.length - 15} more
              </span>
            )}
          </div>
        )}
        {skills.length === 0 && (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            No skills yet. All URLs will create new skills.
          </p>
        )}
      </div>

      {/* How it works */}
      <div style={{
        ...styles.card,
        backgroundColor: "#eff6ff",
        borderColor: "#bfdbfe",
      }}>
        <h3 style={{ marginTop: 0, color: "#1e40af" }}>How Bulk Import Works</h3>
        <ol style={{ margin: 0, paddingLeft: "20px", color: "#1e40af" }}>
          <li style={{ marginBottom: "8px" }}>
            <strong>Duplicate Detection:</strong> URLs already used in existing skills are flagged.
            You can click &quot;Refresh&quot; to re-fetch and update that skill with latest content.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong>Smart Routing:</strong> Each URL is analyzed to determine if it should update
            an existing skill (based on topic similarity) or create a new one.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong>Accuracy First:</strong> The system errs on the side of creating new skills
            rather than incorrectly merging unrelated content. You can manually merge later.
          </li>
          <li>
            <strong>Incremental Updates:</strong> When updating existing skills, only genuinely
            new information is added - redundant content is skipped.
          </li>
        </ol>
      </div>
    </div>
  );
}
