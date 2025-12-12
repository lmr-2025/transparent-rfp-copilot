"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import {
  QUESTION_PROMPT_SECTIONS_KEY,
  QUESTION_PROMPT_STORAGE_KEY,
  CHAT_PROMPT_SECTIONS_KEY,
  SKILL_PROMPT_SECTIONS_KEY,
  LIBRARY_ANALYSIS_SECTIONS_KEY,
} from "@/lib/promptStorage";
import {
  defaultQuestionSections,
  defaultChatSections,
  defaultSkillSections,
  defaultLibraryAnalysisSections,
  PromptSectionConfig,
  buildChatPromptFromSections,
  buildSkillPromptFromSections,
  buildLibraryAnalysisPromptFromSections,
  EditableChatSection,
  EditableSkillSection,
  EditableLibraryAnalysisSection,
} from "@/lib/promptSections";

type EditableSection = PromptSectionConfig & {
  enabled: boolean;
  text: string;
};

const styles = {
  container: {
    maxWidth: "900px",
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
    marginBottom: "8px",
  },
  textarea: {
    width: "100%",
    minHeight: "240px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #cbd5f5",
    fontFamily: "monospace",
    resize: "vertical" as const,
    backgroundColor: "#f8fafc",
  },
  buttonRow: {
    marginTop: "12px",
    display: "flex",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  button: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  collapsibleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    padding: "12px 16px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    marginBottom: "8px",
    userSelect: "none" as const,
  },
  collapsibleContent: {
    overflow: "hidden",
    transition: "max-height 0.3s ease-out",
  },
  chevron: {
    transition: "transform 0.2s ease",
    fontSize: "12px",
    color: "#64748b",
  },
};

const createDefaultSections = (configs: PromptSectionConfig[]): EditableSection[] =>
  configs.map((section) => ({
    ...section,
    text: section.defaultText,
    enabled: true,
  }));

const loadSections = (
  storageKey: string,
  defaults: PromptSectionConfig[],
): EditableSection[] => {
  if (typeof window === "undefined") {
    return createDefaultSections(defaults);
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createDefaultSections(defaults);
    }
    const parsed = JSON.parse(raw) as EditableSection[];
    if (!Array.isArray(parsed)) {
      return createDefaultSections(defaults);
    }
    return parsed.map((section) => ({
      ...section,
      enabled: section.enabled ?? true,
      text: section.text ?? section.defaultText ?? "",
    }));
  } catch {
    return createDefaultSections(defaults);
  }
};

const assemblePrompt = (sections: EditableSection[]) =>
  sections
    .filter((section) => section.enabled && section.text.trim().length > 0)
    .map((section) => [`## ${section.title}`, section.text.trim()].join("\n"))
    .join("\n\n");

const createDefaultChatSections = (configs: PromptSectionConfig[]): EditableChatSection[] =>
  configs.map((section) => ({
    ...section,
    text: section.defaultText,
    enabled: true,
  }));

const loadChatSections = (
  storageKey: string,
  defaults: PromptSectionConfig[],
): EditableChatSection[] => {
  if (typeof window === "undefined") {
    return createDefaultChatSections(defaults);
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createDefaultChatSections(defaults);
    }
    const parsed = JSON.parse(raw) as EditableChatSection[];
    if (!Array.isArray(parsed)) {
      return createDefaultChatSections(defaults);
    }
    return parsed.map((section) => ({
      ...section,
      enabled: section.enabled ?? true,
      text: section.text ?? section.defaultText ?? "",
    }));
  } catch {
    return createDefaultChatSections(defaults);
  }
};

export default function PromptHomePage() {
  const [questionPrompt, setQuestionPrompt] = useStoredPrompt(
    QUESTION_PROMPT_STORAGE_KEY,
    defaultQuestionPrompt,
  );
  const [copiedPrompt, setCopiedPrompt] = useState<"question" | "chat" | "skill" | "analysis" | null>(null);
  const [questionSections, setQuestionSections] = useState<EditableSection[]>(
    () => loadSections(QUESTION_PROMPT_SECTIONS_KEY, defaultQuestionSections),
  );
  const [chatSections, setChatSections] = useState<EditableChatSection[]>(
    () => loadChatSections(CHAT_PROMPT_SECTIONS_KEY, defaultChatSections),
  );
  const [skillSections, setSkillSections] = useState<EditableSkillSection[]>(
    () => loadSections(SKILL_PROMPT_SECTIONS_KEY, defaultSkillSections) as EditableSkillSection[],
  );
  const [analysisSections, setAnalysisSections] = useState<EditableLibraryAnalysisSection[]>(
    () => loadSections(LIBRARY_ANALYSIS_SECTIONS_KEY, defaultLibraryAnalysisSections) as EditableLibraryAnalysisSection[],
  );
  const [activeTab, setActiveTab] = useState<"questions" | "chat" | "skills" | "analysis">("questions");
  const [expandedQuestionSections, setExpandedQuestionSections] = useState<Set<string>>(new Set());
  const [expandedChatSections, setExpandedChatSections] = useState<Set<string>>(new Set());
  const [expandedSkillSections, setExpandedSkillSections] = useState<Set<string>>(new Set());
  const [expandedAnalysisSections, setExpandedAnalysisSections] = useState<Set<string>>(new Set());

  const toggleQuestionSection = (id: string) => {
    setExpandedQuestionSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleChatSection = (id: string) => {
    setExpandedChatSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSkillSection = (id: string) => {
    setExpandedSkillSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAnalysisSection = (id: string) => {
    setExpandedAnalysisSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const composedQuestionPrompt = useMemo(
    () => assemblePrompt(questionSections),
    [questionSections],
  );

  const composedChatPrompt = useMemo(
    () => buildChatPromptFromSections(chatSections, "[Your selected skills will appear here]"),
    [chatSections],
  );

  const composedSkillPrompt = useMemo(
    () => buildSkillPromptFromSections(skillSections),
    [skillSections],
  );

  const composedAnalysisPrompt = useMemo(
    () => buildLibraryAnalysisPromptFromSections(analysisSections),
    [analysisSections],
  );

  const updateQuestionSection = (id: string, updates: Partial<EditableSection>) => {
    setQuestionSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? {
              ...section,
              ...updates,
            }
          : section,
      ),
    );
  };

  const resetQuestionSections = () => {
    setQuestionSections(createDefaultSections(defaultQuestionSections));
  };

  const updateChatSection = (id: string, updates: Partial<EditableChatSection>) => {
    setChatSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? {
              ...section,
              ...updates,
            }
          : section,
      ),
    );
  };

  const resetChatSections = () => {
    setChatSections(createDefaultChatSections(defaultChatSections));
  };

  const updateSkillSection = (id: string, updates: Partial<EditableSkillSection>) => {
    setSkillSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? {
              ...section,
              ...updates,
            }
          : section,
      ),
    );
  };

  const resetSkillSections = () => {
    setSkillSections(createDefaultSections(defaultSkillSections) as EditableSkillSection[]);
  };

  const updateAnalysisSection = (id: string, updates: Partial<EditableLibraryAnalysisSection>) => {
    setAnalysisSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? {
              ...section,
              ...updates,
            }
          : section,
      ),
    );
  };

  const resetAnalysisSections = () => {
    setAnalysisSections(createDefaultSections(defaultLibraryAnalysisSections) as EditableLibraryAnalysisSection[]);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      QUESTION_PROMPT_SECTIONS_KEY,
      JSON.stringify(questionSections),
    );
  }, [questionSections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      CHAT_PROMPT_SECTIONS_KEY,
      JSON.stringify(chatSections),
    );
  }, [chatSections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SKILL_PROMPT_SECTIONS_KEY,
      JSON.stringify(skillSections),
    );
  }, [skillSections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      LIBRARY_ANALYSIS_SECTIONS_KEY,
      JSON.stringify(analysisSections),
    );
  }, [analysisSections]);

  useEffect(() => {
    setQuestionPrompt(composedQuestionPrompt.length ? composedQuestionPrompt : defaultQuestionPrompt);
  }, [composedQuestionPrompt, setQuestionPrompt]);

  const copyPrompt = async (text: string, type: "question" | "chat" | "skill" | "analysis") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(type);
      setTimeout(() => setCopiedPrompt(null), 1500);
    } catch {
      // ignore
    }
  };

  const tabStyle = (isActive: boolean) => ({
    padding: "12px 24px",
    border: "none",
    borderBottom: isActive ? "3px solid #3b82f6" : "3px solid transparent",
    backgroundColor: "transparent",
    fontWeight: isActive ? 600 : 400,
    color: isActive ? "#1e293b" : "#64748b",
    cursor: "pointer",
    fontSize: "15px",
  });

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "8px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px 0" }}>TruthTeller <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(System Prompts)</span></h1>
          <p style={{ color: "#475569", margin: 0 }}>
            Configure the system prompts that power the app. Changes here automatically flow to the
            relevant features. Toggle sections on/off to customize behavior.
          </p>
        </div>
        <Link
          href="/prompts/library"
          style={{
            padding: "10px 16px",
            backgroundColor: "#2563eb",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          Prompt Library →
        </Link>
      </div>

      {/* Tab Navigation */}
      <div style={{ borderBottom: "1px solid #e2e8f0", marginBottom: "24px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          style={tabStyle(activeTab === "questions")}
        >
          Question Response Prompt
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          style={tabStyle(activeTab === "chat")}
        >
          Chat with Knowledge Prompt
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("skills")}
          style={tabStyle(activeTab === "skills")}
        >
          Skill Builder Prompt
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analysis")}
          style={tabStyle(activeTab === "analysis")}
        >
          Library Analysis Prompt
        </button>
      </div>

      {activeTab === "questions" && (
        <>
          {/* Full System Prompt Preview at Top */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Full System Prompt</h2>
                <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "13px" }}>
                  This is the complete prompt sent to the AI. Edit individual sections below.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => copyPrompt(composedQuestionPrompt || questionPrompt, "question")}
                  style={{ ...styles.button, backgroundColor: "#0ea5e9", color: "#fff" }}
                >
                  {copiedPrompt === "question" ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={resetQuestionSections}
                  style={{ ...styles.button, backgroundColor: "#e2e8f0" }}
                >
                  Reset All
                </button>
              </div>
            </div>
            <textarea
              id="questionPromptPreview"
              value={composedQuestionPrompt || questionPrompt}
              readOnly
              style={{ ...styles.textarea, minHeight: "280px", fontSize: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "12px" }}>
                Used by <Link href="/questions" style={{ color: "#0ea5e9" }}>Question Workspace</Link> and{" "}
                <Link href="/projects" style={{ color: "#0ea5e9" }}>Projects</Link>.
              </p>
              <span style={{
                fontSize: "11px",
                color: (composedQuestionPrompt || questionPrompt).length > 90000 ? "#dc2626" : "#64748b",
                fontWeight: 500,
              }}>
                {(composedQuestionPrompt || questionPrompt).length.toLocaleString()} characters
              </span>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Edit Sections
            </h3>
            {questionSections.map((section) => {
              const isExpanded = expandedQuestionSections.has(section.id);
              return (
                <div key={section.id} style={{ marginBottom: "8px" }}>
                  <div
                    style={styles.collapsibleHeader}
                    onClick={() => toggleQuestionSection(section.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => {
                          event.stopPropagation();
                          updateQuestionSection(section.id, { enabled: event.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "16px", height: "16px" }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, color: section.enabled ? "#1e293b" : "#94a3b8" }}>
                          {section.title}
                        </span>
                        {!section.enabled && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#94a3b8" }}>
                            (disabled)
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ ...styles.chevron, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: "12px 16px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", marginTop: "-8px", marginBottom: "8px" }}>
                      <p style={{ color: "#64748b", margin: "0 0 12px 0", fontSize: "13px" }}>{section.description}</p>
                      <textarea
                        value={section.text}
                        onChange={(event) => updateQuestionSection(section.id, { text: event.target.value.slice(0, 20000) })}
                        disabled={!section.enabled}
                        maxLength={20000}
                        style={{
                          ...styles.textarea,
                          minHeight: "140px",
                          backgroundColor: section.enabled ? "#f8fafc" : "#e2e8f0",
                          cursor: section.enabled ? "text" : "not-allowed",
                          fontSize: "12px",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <span style={{
                          fontSize: "11px",
                          color: section.text.length > 18000 ? "#dc2626" : "#94a3b8",
                        }}>
                          {section.text.length.toLocaleString()} / 20,000
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestionSection(section.id, { text: section.defaultText, enabled: true })
                          }
                          style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "12px", padding: "6px 12px" }}
                        >
                          Restore default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "chat" && (
        <>
          {/* Full System Prompt Preview at Top */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Full System Prompt</h2>
                <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "13px" }}>
                  This is the complete prompt sent to the AI. Edit individual sections below.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => copyPrompt(composedChatPrompt, "chat")}
                  style={{ ...styles.button, backgroundColor: "#0ea5e9", color: "#fff" }}
                >
                  {copiedPrompt === "chat" ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={resetChatSections}
                  style={{ ...styles.button, backgroundColor: "#e2e8f0" }}
                >
                  Reset All
                </button>
              </div>
            </div>
            <div style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: "6px",
              padding: "10px 12px",
              marginBottom: "12px",
              fontSize: "12px",
              color: "#92400e",
            }}>
              The <code style={{ backgroundColor: "#fde68a", padding: "2px 4px", borderRadius: "3px" }}>KNOWLEDGE BASE</code> section
              is a placeholder. At runtime, it contains your selected skills.
            </div>
            <textarea
              id="chatPromptPreview"
              value={composedChatPrompt}
              readOnly
              style={{ ...styles.textarea, minHeight: "240px", fontSize: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "12px" }}>
                Used by <Link href="/chat" style={{ color: "#0ea5e9" }}>Chat with Knowledge</Link>.
              </p>
              <span style={{
                fontSize: "11px",
                color: composedChatPrompt.length > 90000 ? "#dc2626" : "#64748b",
                fontWeight: 500,
              }}>
                {composedChatPrompt.length.toLocaleString()} characters
              </span>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Edit Sections
            </h3>
            {chatSections.map((section) => {
              const isExpanded = expandedChatSections.has(section.id);
              return (
                <div key={section.id} style={{ marginBottom: "8px" }}>
                  <div
                    style={styles.collapsibleHeader}
                    onClick={() => toggleChatSection(section.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => {
                          event.stopPropagation();
                          updateChatSection(section.id, { enabled: event.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "16px", height: "16px" }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, color: section.enabled ? "#1e293b" : "#94a3b8" }}>
                          {section.title}
                        </span>
                        {!section.enabled && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#94a3b8" }}>
                            (disabled)
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ ...styles.chevron, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: "12px 16px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", marginTop: "-8px", marginBottom: "8px" }}>
                      <p style={{ color: "#64748b", margin: "0 0 12px 0", fontSize: "13px" }}>{section.description}</p>
                      <textarea
                        value={section.text}
                        onChange={(event) => updateChatSection(section.id, { text: event.target.value.slice(0, 20000) })}
                        disabled={!section.enabled}
                        maxLength={20000}
                        style={{
                          ...styles.textarea,
                          minHeight: "100px",
                          backgroundColor: section.enabled ? "#f8fafc" : "#e2e8f0",
                          cursor: section.enabled ? "text" : "not-allowed",
                          fontSize: "12px",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <span style={{
                          fontSize: "11px",
                          color: section.text.length > 18000 ? "#dc2626" : "#94a3b8",
                        }}>
                          {section.text.length.toLocaleString()} / 20,000
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateChatSection(section.id, { text: section.defaultText, enabled: true })
                          }
                          style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "12px", padding: "6px 12px" }}
                        >
                          Restore default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "skills" && (
        <>
          {/* Full System Prompt Preview at Top */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Full System Prompt</h2>
                <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "13px" }}>
                  This prompt guides the AI when creating skills from source documentation.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => copyPrompt(composedSkillPrompt, "skill")}
                  style={{ ...styles.button, backgroundColor: "#0ea5e9", color: "#fff" }}
                >
                  {copiedPrompt === "skill" ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={resetSkillSections}
                  style={{ ...styles.button, backgroundColor: "#e2e8f0" }}
                >
                  Reset All
                </button>
              </div>
            </div>
            <textarea
              id="skillPromptPreview"
              value={composedSkillPrompt}
              readOnly
              style={{ ...styles.textarea, minHeight: "280px", fontSize: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "12px" }}>
                Used by <Link href="/knowledge" style={{ color: "#0ea5e9" }}>Build Skills</Link> when generating skills from URLs.
              </p>
              <span style={{
                fontSize: "11px",
                color: composedSkillPrompt.length > 90000 ? "#dc2626" : "#64748b",
                fontWeight: 500,
              }}>
                {composedSkillPrompt.length.toLocaleString()} characters
              </span>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Edit Sections
            </h3>
            {skillSections.map((section) => {
              const isExpanded = expandedSkillSections.has(section.id);
              return (
                <div key={section.id} style={{ marginBottom: "8px" }}>
                  <div
                    style={styles.collapsibleHeader}
                    onClick={() => toggleSkillSection(section.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => {
                          event.stopPropagation();
                          updateSkillSection(section.id, { enabled: event.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "16px", height: "16px" }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, color: section.enabled ? "#1e293b" : "#94a3b8" }}>
                          {section.title}
                        </span>
                        {!section.enabled && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#94a3b8" }}>
                            (disabled)
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ ...styles.chevron, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: "12px 16px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", marginTop: "-8px", marginBottom: "8px" }}>
                      <p style={{ color: "#64748b", margin: "0 0 12px 0", fontSize: "13px" }}>{section.description}</p>
                      <textarea
                        value={section.text}
                        onChange={(event) => updateSkillSection(section.id, { text: event.target.value.slice(0, 20000) })}
                        disabled={!section.enabled}
                        maxLength={20000}
                        style={{
                          ...styles.textarea,
                          minHeight: "140px",
                          backgroundColor: section.enabled ? "#f8fafc" : "#e2e8f0",
                          cursor: section.enabled ? "text" : "not-allowed",
                          fontSize: "12px",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <span style={{
                          fontSize: "11px",
                          color: section.text.length > 18000 ? "#dc2626" : "#94a3b8",
                        }}>
                          {section.text.length.toLocaleString()} / 20,000
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSkillSection(section.id, { text: section.defaultText, enabled: true })
                          }
                          style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "12px", padding: "6px 12px" }}
                        >
                          Restore default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "analysis" && (
        <>
          {/* Full System Prompt Preview at Top */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Full System Prompt</h2>
                <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "13px" }}>
                  This prompt guides the AI when analyzing your knowledge library for redundancy and organization issues.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => copyPrompt(composedAnalysisPrompt, "analysis")}
                  style={{ ...styles.button, backgroundColor: "#8b5cf6", color: "#fff" }}
                >
                  {copiedPrompt === "analysis" ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={resetAnalysisSections}
                  style={{ ...styles.button, backgroundColor: "#e2e8f0" }}
                >
                  Reset All
                </button>
              </div>
            </div>
            <textarea
              id="analysisPromptPreview"
              value={composedAnalysisPrompt}
              readOnly
              style={{ ...styles.textarea, minHeight: "280px", fontSize: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "12px" }}>
                Used by <Link href="/knowledge/library" style={{ color: "#8b5cf6" }}>Knowledge Library</Link> when running the &quot;Review Library&quot; analysis.
              </p>
              <span style={{
                fontSize: "11px",
                color: composedAnalysisPrompt.length > 90000 ? "#dc2626" : "#64748b",
                fontWeight: 500,
              }}>
                {composedAnalysisPrompt.length.toLocaleString()} characters
              </span>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Edit Sections
            </h3>
            {analysisSections.map((section) => {
              const isExpanded = expandedAnalysisSections.has(section.id);
              return (
                <div key={section.id} style={{ marginBottom: "8px" }}>
                  <div
                    style={styles.collapsibleHeader}
                    onClick={() => toggleAnalysisSection(section.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => {
                          event.stopPropagation();
                          updateAnalysisSection(section.id, { enabled: event.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "16px", height: "16px" }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, color: section.enabled ? "#1e293b" : "#94a3b8" }}>
                          {section.title}
                        </span>
                        {!section.enabled && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#94a3b8" }}>
                            (disabled)
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ ...styles.chevron, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: "12px 16px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", marginTop: "-8px", marginBottom: "8px" }}>
                      <p style={{ color: "#64748b", margin: "0 0 12px 0", fontSize: "13px" }}>{section.description}</p>
                      <textarea
                        value={section.text}
                        onChange={(event) => updateAnalysisSection(section.id, { text: event.target.value.slice(0, 20000) })}
                        disabled={!section.enabled}
                        maxLength={20000}
                        style={{
                          ...styles.textarea,
                          minHeight: "140px",
                          backgroundColor: section.enabled ? "#f8fafc" : "#e2e8f0",
                          cursor: section.enabled ? "text" : "not-allowed",
                          fontSize: "12px",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <span style={{
                          fontSize: "11px",
                          color: section.text.length > 18000 ? "#dc2626" : "#94a3b8",
                        }}>
                          {section.text.length.toLocaleString()} / 20,000
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateAnalysisSection(section.id, { text: section.defaultText, enabled: true })
                          }
                          style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "12px", padding: "6px 12px" }}
                        >
                          Restore default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
