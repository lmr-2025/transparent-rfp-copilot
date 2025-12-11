"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { QUESTION_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import { BulkProject, BulkRow } from "@/types/bulkProject";
import { fetchProject, updateProject, deleteProject as deleteProjectApi } from "@/lib/projectApi";
import ConversationalRefinement from "@/components/ConversationalRefinement";
import { loadSkillsFromStorage } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import { parseAnswerSections, selectRelevantSkills } from "@/lib/questionHelpers";
import SkillRecommendation from "@/components/SkillRecommendation";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginTop: "12px",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5f5",
    marginTop: "4px",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  statusPill: {
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
};

export default function BulkResponsesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<BulkProject | null>(null);
  const [promptText, setPromptText] = useStoredPrompt(
    QUESTION_PROMPT_STORAGE_KEY,
    defaultQuestionPrompt,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "high" | "medium" | "low" | "error">("all");
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 });

  // Load project by ID on mount
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        const loaded = await fetchProject(projectId);
        if (!loaded) {
          router.push("/questions/bulk/projects");
          return;
        }
        setProject(loaded);
      } catch (error) {
        console.error("Failed to load project:", error);
        setErrorMessage("Failed to load project. Redirecting...");
        setTimeout(() => router.push("/questions/bulk/projects"), 2000);
      }
    };
    loadProjectData();
  }, [projectId, router]);

  // Auto-save project changes with debouncing
  useEffect(() => {
    if (!project) return;

    const saveTimeout = setTimeout(async () => {
      try {
        await updateProject(project);
      } catch (error) {
        console.error("Failed to auto-save project:", error);
        // Silent failure for auto-save to avoid annoying the user
      }
    }, 500); // Debounce by 500ms

    return () => clearTimeout(saveTimeout);
  }, [project]);

  // Load skills on mount
  useEffect(() => {
    setAvailableSkills(loadSkillsFromStorage());
  }, []);

  const stats = useMemo(() => {
    if (!project) {
      return { total: 0, high: 0, medium: 0, low: 0, errors: 0 };
    }
    const total = project.rows.length;
    const high = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('high')).length;
    const medium = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('medium')).length;
    const low = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('low')).length;
    const errors = project.rows.filter((row) => row.status === "error").length;
    return { total, high, medium, low, errors };
  }, [project]);

  const filteredRows = useMemo(() => {
    if (!project) return [];
    if (statusFilter === "all") return project.rows;
    if (statusFilter === "error") {
      return project.rows.filter((row) => row.status === "error");
    }
    // Filter by confidence level
    return project.rows.filter((row) => {
      if (!row.confidence) return false;
      const confidenceLower = row.confidence.toLowerCase();
      return confidenceLower.includes(statusFilter);
    });
  }, [project, statusFilter]);

  const updateRow = (rowId: string, updates: Partial<BulkRow>) => {
    setProject((prev) => {
      if (!prev) return prev;
      const updatedRows = prev.rows.map((row) =>
        row.id === rowId ? { ...row, ...updates } : row,
      );
      return { ...prev, rows: updatedRows };
    });
  };

  const handleQuestionEdit = (rowId: string, value: string) => {
    updateRow(rowId, {
      question: value,
      status: "pending",
      response: "",
      error: undefined,
      challengeResponse: undefined,
      challengeStatus: "idle",
      challengeError: undefined,
    });
  };

  const handleGenerateResponse = async (rowId: string) => {
    if (!project) return;
    const row = project.rows.find((item) => item.id === rowId);
    if (!row) return;
    if (!row.question.trim()) {
      updateRow(rowId, { status: "error", error: "Question text is empty." });
      return;
    }
    updateRow(rowId, { status: "generating", error: undefined });
    setErrorMessage(null);

    try {
      // Select relevant skills for this question
      const relevantSkills = selectRelevantSkills(row.question.trim(), availableSkills);
      const skillsPayload = relevantSkills.map((skill) => ({
        title: skill.title,
        content: skill.content,
        tags: skill.tags,
      }));

      const response = await fetch("/api/questions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: row.question.trim(),
          prompt: promptText,
          skills: skillsPayload
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) {
        throw new Error(data?.error || "Failed to generate response.");
      }

      // Parse response into sections
      const parsed = parseAnswerSections(data.answer);

      updateRow(rowId, {
        response: parsed.response,
        confidence: parsed.confidence,
        sources: parsed.sources,
        remarks: parsed.remarks,
        usedSkills: relevantSkills,
        showRecommendation: true,
        status: "completed",
        error: undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error while contacting GRC Minion.";
      updateRow(rowId, { status: "error", error: message });
    }
  };

  const handleGenerateAll = async () => {
    if (!project || project.rows.length === 0) {
      setErrorMessage("No project rows available. Upload a file first.");
      return;
    }

    setIsGeneratingAll(true);
    setErrorMessage(null);

    const total = project.rows.length;
    setGenerateProgress({ current: 0, total });

    // Process in batches with concurrency limit of 5
    const CONCURRENCY = 5;
    const batches = [];

    for (let i = 0; i < project.rows.length; i += CONCURRENCY) {
      batches.push(project.rows.slice(i, i + CONCURRENCY));
    }

    let completed = 0;

    for (const batch of batches) {
      // Process this batch in parallel (all at once)
      await Promise.all(
        batch.map(async (row) => {
          await handleGenerateResponse(row.id);
          completed++;
          setGenerateProgress({ current: completed, total });
        })
      );
    }

    setIsGeneratingAll(false);
    setGenerateProgress({ current: 0, total: 0 });
  };

  const handleChallenge = async (rowId: string) => {
    if (!project) return;
    const row = project.rows.find((item) => item.id === rowId);
    if (!row) return;
    if (!row.response.trim()) {
      updateRow(rowId, {
        challengeStatus: "error",
        challengeError: "Generate a response before sending a challenge.",
      });
      return;
    }
    updateRow(rowId, { challengeStatus: "generating", challengeError: undefined });
    setErrorMessage(null);

    const compositePrompt = [
      `Original question: ${row.question}`,
      `GRC Minion's answer:\n${row.response}`,
      "",
      "Challenge:",
      row.challengePrompt,
      "",
      "Respond with analysis of weaknesses, accuracy gaps, and recommended prompt or skill updates.",
    ].join("\n");

    try {
      const response = await fetch("/api/questions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: compositePrompt, prompt: promptText }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) {
        throw new Error(data?.error || "Failed to generate challenge response.");
      }
      updateRow(rowId, {
        challengeResponse: data.answer,
        challengeStatus: "completed",
        challengeError: undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error while challenging the response.";
      updateRow(rowId, { challengeStatus: "error", challengeError: message });
    }
  };

  const clearProject = async () => {
    if (!project) return;
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      try {
        await deleteProjectApi(project.id);
        router.push("/questions/bulk/projects");
      } catch (error) {
        console.error("Failed to delete project:", error);
        alert("Failed to delete project. Please try again.");
      }
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "pending":
        return <span style={{ ...styles.statusPill, backgroundColor: "#f1f5f9", color: "#0f172a" }}>Pending</span>;
      case "generating":
        return <span style={{ ...styles.statusPill, backgroundColor: "#fde68a", color: "#78350f" }}>Generating</span>;
      case "completed":
        return <span style={{ ...styles.statusPill, backgroundColor: "#dcfce7", color: "#166534" }}>Completed</span>;
      case "error":
        return <span style={{ ...styles.statusPill, backgroundColor: "#fee2e2", color: "#b91c1c" }}>Error</span>;
      default:
        return null;
    }
  };

  if (!project) {
    return (
      <div style={styles.container}>
        <h1>Loading project...</h1>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ marginBottom: "16px" }}>
        <a href="/questions/bulk/projects" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
          ← Back to Projects
        </a>
      </div>
      <h1>GRC Minion – Bulk Response Workspace</h1>
      <p style={{ color: "#475569" }}>
        Generate answers, review them, and challenge questionable responses to improve future skills.
      </p>

      {errorMessage && <div style={{ ...styles.card, backgroundColor: "#fee2e2" }}>{errorMessage}</div>}

      <SkillUpdateBanner skills={availableSkills} />

      <div style={{ ...styles.card, display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
        <div>
          <strong>Project:</strong> {project.name}
          <br />
          <strong>Worksheet:</strong> {project.sheetName}
          <br />
          <strong>Created:</strong> {new Date(project.createdAt).toLocaleString()}
        </div>
        <div>
          <strong>Total:</strong> {stats.total} · <strong>High:</strong> {stats.high} ·{" "}
          <strong>Medium:</strong> {stats.medium} · <strong>Low:</strong> {stats.low} ·{" "}
          <strong>Errors:</strong> {stats.errors}
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => router.push("/questions/bulk/upload")}
            style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#0f172a" }}
          >
            Upload new file
          </button>
          <button
            type="button"
            onClick={clearProject}
            style={{ ...styles.button, backgroundColor: "#fee2e2", color: "#b91c1c" }}
          >
            Clear project
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <strong>Filter:</strong>
          {(["all", "high", "medium", "low", "error"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                ...styles.button,
                padding: "6px 12px",
                backgroundColor: statusFilter === filter ? "#0ea5e9" : "#f1f5f9",
                color: statusFilter === filter ? "#fff" : "#0f172a",
                textTransform: "capitalize",
              }}
            >
              {filter === "all" ? `All (${stats.total})` :
               filter === "high" ? `High (${stats.high})` :
               filter === "medium" ? `Medium (${stats.medium})` :
               filter === "low" ? `Low (${stats.low})` :
               `Error (${stats.errors})`}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={isGeneratingAll}
            style={{
              ...styles.button,
              backgroundColor: isGeneratingAll ? "#94a3b8" : "#0ea5e9",
              color: "#fff",
              cursor: isGeneratingAll ? "not-allowed" : "pointer",
            }}
          >
            {isGeneratingAll ? "Generating..." : "Generate all responses"}
          </button>

          {isGeneratingAll && generateProgress.total > 0 && (
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{
                backgroundColor: "#e2e8f0",
                borderRadius: "4px",
                overflow: "hidden",
                height: "8px"
              }}>
                <div style={{
                  backgroundColor: "#0ea5e9",
                  height: "100%",
                  width: `${(generateProgress.current / generateProgress.total) * 100}%`,
                  transition: "width 0.3s ease"
                }} />
              </div>
              <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: "4px" }}>
                {generateProgress.current} of {generateProgress.total} completed
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: "8px" }}>
          <a href="/prompts" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
            Need to edit the prompt? Visit Prompt Home →
          </a>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: promptCollapsed ? "0" : "12px" }}>
          <label style={{ ...styles.label, marginTop: 0 }} htmlFor="promptText">
            Prompt sent to GRC Minion
          </label>
          <button
            type="button"
            onClick={() => setPromptCollapsed(!promptCollapsed)}
            style={{
              ...styles.button,
              backgroundColor: "#f1f5f9",
              color: "#0f172a",
              padding: "6px 12px",
            }}
          >
            {promptCollapsed ? "Show Prompt" : "Hide Prompt"}
          </button>
        </div>

        {!promptCollapsed && (
          <>
            <textarea
              id="promptText"
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              style={{
                ...styles.input,
                minHeight: "200px",
                fontFamily: "monospace",
                backgroundColor: "#f8fafc",
                resize: "vertical",
              }}
            />
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "8px" }}>
              All bulk responses and challenges share this prompt. Editing it here keeps everything in sync.
            </p>
          </>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <div style={styles.card}>
          <p style={{ color: "#94a3b8" }}>
            {statusFilter === "all"
              ? "No questions detected for this project."
              : `No ${statusFilter} questions found.`}
          </p>
        </div>
      ) : (
        <div style={{ ...styles.card, maxHeight: "600px", overflowY: "auto" }}>
          {filteredRows.map((row) => (
            <div key={row.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "12px" }}>
              {/* Header with status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "0.9rem", color: "#475569" }}>
                  Row {row.rowNumber} • {renderStatus(row.status)}
                </div>
              </div>

              {/* Question - Compact */}
              <label style={{ ...styles.label, fontSize: "0.9rem", marginTop: "4px" }}>Question</label>
              <textarea
                value={row.question}
                onChange={(event) => handleQuestionEdit(row.id, event.target.value)}
                style={{ ...styles.input, minHeight: "60px", resize: "vertical", fontSize: "0.9rem" }}
              />

              {/* Response Section - Only show if completed */}
              {row.response && (
                <div style={{
                  marginTop: "8px",
                  padding: "12px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0"
                }}>
                  <label style={{
                    ...styles.label,
                    fontSize: "0.9rem",
                    marginTop: "0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>Response</span>
                    {row.confidence && (
                      <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#475569" }}>
                        Confidence: {row.confidence}
                      </span>
                    )}
                  </label>
                  <textarea
                    value={row.response}
                    onChange={(event) => updateRow(row.id, { response: event.target.value })}
                    style={{
                      ...styles.input,
                      minHeight: "100px",
                      fontSize: "0.9rem",
                      resize: "vertical",
                      backgroundColor: "#fff",
                      marginTop: "6px"
                    }}
                  />

                  {/* Structured sections - Compact display */}
                  {(row.sources || row.remarks) && (
                    <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                      {row.sources && (
                        <div>
                          <strong style={{ fontSize: "0.85rem", color: "#475569" }}>Sources:</strong>
                          <div style={{
                            fontSize: "0.85rem",
                            color: "#64748b",
                            marginTop: "2px",
                            whiteSpace: "pre-wrap"
                          }}>
                            {row.sources}
                          </div>
                        </div>
                      )}
                      {row.remarks && (
                        <div>
                          <strong style={{ fontSize: "0.85rem", color: "#475569" }}>Remarks:</strong>
                          <div style={{
                            fontSize: "0.85rem",
                            color: "#64748b",
                            marginTop: "2px",
                            whiteSpace: "pre-wrap"
                          }}>
                            {row.remarks}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {row.error && (
                <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "8px" }}>{row.error}</p>
              )}

              {/* Skill Recommendations */}
              {row.showRecommendation && row.usedSkills && (
                <SkillRecommendation
                  usedSkills={row.usedSkills}
                  question={row.question}
                  allSkills={availableSkills}
                  onDismiss={() => updateRow(row.id, { showRecommendation: false })}
                />
              )}

              {/* Ask GRC Conversational Interface */}
              {row.response && (
                <div style={{ marginTop: "12px" }}>
                  {!row.conversationOpen ? (
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { conversationOpen: true })}
                      style={{
                        ...styles.button,
                        backgroundColor: "#0ea5e9",
                        color: "#fff",
                        padding: "6px 12px",
                        fontSize: "0.9rem",
                      }}
                    >
                      💬 Ask GRC about this response
                    </button>
                  ) : (
                    <ConversationalRefinement
                      originalQuestion={row.question}
                      currentResponse={`${row.response}\n\nConfidence: ${row.confidence || 'N/A'}\nSources: ${row.sources || 'N/A'}\nRemarks: ${row.remarks || 'N/A'}`}
                      onResponseUpdate={(newResponse) => {
                        const parsed = parseAnswerSections(newResponse);
                        updateRow(row.id, {
                          response: parsed.response,
                          confidence: parsed.confidence,
                          sources: parsed.sources,
                          remarks: parsed.remarks
                        });
                      }}
                      onClose={() => updateRow(row.id, { conversationOpen: false })}
                      promptText={promptText}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
