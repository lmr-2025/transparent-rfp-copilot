"use client";

import { useEffect, useState } from "react";
import { loadSkillsFromStorage, saveSkillsToStorage } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import { defaultSkillPrompt } from "@/lib/skillPrompt";

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
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<SkillDraft | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    saveSkillsToStorage(skills);
  }, [skills]);

  const updateQueueItem = (id: string, patch: Partial<UploadStatus>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleBuildFromUrls = async () => {
    setBuildError(null);
    const urls = urlInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setBuildError("Please enter at least one URL");
      return;
    }

    setIsBuilding(true);
    try {
      const response = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrls: urls }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to build skill");
      }

      const data = await response.json();
      setGeneratedDraft(data.draft);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Failed to build skill");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleSaveDraft = () => {
    if (!generatedDraft) return;

    const newSkill: Skill = {
      id: crypto.randomUUID(),
      title: generatedDraft.title,
      tags: generatedDraft.tags,
      content: generatedDraft.content,
      quickFacts: [],
      edgeCases: [],
      information: generatedDraft.sourceMapping
        ? {
            sources: generatedDraft.sourceMapping,
          }
        : undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    setSkills((prev) => [newSkill, ...prev]);
    setGeneratedDraft(null);
    setUrlInput("");
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
        const newSkill: Skill = {
          id: crypto.randomUUID(),
          title: deriveTitleFromFilename(file.name),
          tags: [],
          content: text,
          quickFacts: [],
          edgeCases: [],
          information: undefined,
          isActive: true,
          createdAt: new Date().toISOString(),
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
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={styles.container}>
        <h1>GRC Minion – Knowledge Builder</h1>
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
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://example.com/docs/security&#10;https://example.com/docs/compliance&#10;https://example.com/docs/privacy"
          disabled={isBuilding || generatedDraft !== null}
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
        <button
          onClick={handleBuildFromUrls}
          disabled={isBuilding || !urlInput.trim() || generatedDraft !== null}
          style={{
            marginTop: "12px",
            padding: "10px 20px",
            backgroundColor: isBuilding || !urlInput.trim() || generatedDraft !== null ? "#cbd5e1" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: isBuilding || !urlInput.trim() || generatedDraft !== null ? "not-allowed" : "pointer",
          }}
        >
          {isBuilding ? "Building Skill..." : "Build Skill from URLs"}
        </button>
        {buildError && <div style={styles.error}>{buildError}</div>}
        {isBuilding && (
          <div style={{
            marginTop: "16px",
            padding: "16px",
            backgroundColor: "#eff6ff",
            border: "2px solid #60a5fa",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            <div style={{
              width: "24px",
              height: "24px",
              border: "3px solid #e0e7ff",
              borderTop: "3px solid #2563eb",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <div>
              <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: "4px" }}>
                Building skill from documentation...
              </div>
              <div style={{ fontSize: "14px", color: "#60a5fa" }}>
                Fetching URLs and generating structured knowledge. This may take 20-30 seconds.
              </div>
            </div>
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
            value={defaultSkillPrompt}
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
    </>
  );
}
