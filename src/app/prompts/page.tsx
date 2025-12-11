"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import {
  QUESTION_PROMPT_SECTIONS_KEY,
  QUESTION_PROMPT_STORAGE_KEY,
} from "@/lib/promptStorage";
import { defaultQuestionSections, PromptSectionConfig } from "@/lib/promptSections";

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

export default function PromptHomePage() {
  const [questionPrompt, setQuestionPrompt] = useStoredPrompt(
    QUESTION_PROMPT_STORAGE_KEY,
    defaultQuestionPrompt,
  );
  const [copiedPrompt, setCopiedPrompt] = useState<"question" | null>(null);
  const [questionSections, setQuestionSections] = useState<EditableSection[]>(
    () => loadSections(QUESTION_PROMPT_SECTIONS_KEY, defaultQuestionSections),
  );

  const composedQuestionPrompt = useMemo(
    () => assemblePrompt(questionSections),
    [questionSections],
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
    setQuestionPrompt(composedQuestionPrompt.length ? composedQuestionPrompt : defaultQuestionPrompt);
  }, [composedQuestionPrompt, setQuestionPrompt]);

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt("question");
      setTimeout(() => setCopiedPrompt(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div style={styles.container}>
      <h1>GRC Minion – Prompt Configuration</h1>
      <p style={{ color: "#475569" }}>
        Configure the system prompt that powers question answering. Changes here automatically flow to the
        Question Workspace and Bulk Upload workflows. Toggle sections on/off to customize behavior.
      </p>

      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Question Response Prompt Builder</h2>
        <p style={{ color: "#475569" }}>
          Use the Security Questionnaire Workflow as structured building blocks. Toggle
          sections on/off, edit the wording, and the prompt will update automatically
          for the Question Workspace and Bulk tools.
        </p>
        <button
          type="button"
          onClick={resetQuestionSections}
          style={{ ...styles.button, backgroundColor: "#e2e8f0" }}
        >
          Reset to workflow defaults
        </button>
      </div>

      {questionSections.map((section) => (
        <div key={section.id} style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={(event) =>
                  updateQuestionSection(section.id, { enabled: event.target.checked })
                }
                style={{ marginRight: "8px" }}
              />
              {section.title}
            </label>
            <button
              type="button"
              onClick={() =>
                updateQuestionSection(section.id, { text: section.defaultText, enabled: true })
              }
              style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#0f172a" }}
            >
              Restore summary guidance
            </button>
          </div>
          <p style={{ color: "#64748b", marginTop: "4px" }}>{section.description}</p>
          <textarea
            value={section.text}
            onChange={(event) => updateQuestionSection(section.id, { text: event.target.value })}
            disabled={!section.enabled}
            style={{
              ...styles.textarea,
              minHeight: "180px",
              backgroundColor: section.enabled ? "#f8fafc" : "#e2e8f0",
              cursor: section.enabled ? "text" : "not-allowed",
            }}
          />
        </div>
      ))}

      <div style={styles.card}>
        <label style={styles.label} htmlFor="questionPromptPreview">
          Combined prompt preview
        </label>
        <textarea
          id="questionPromptPreview"
          value={composedQuestionPrompt || questionPrompt}
          readOnly
          style={{ ...styles.textarea, minHeight: "320px" }}
        />
        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={() => copyPrompt(composedQuestionPrompt || questionPrompt)}
            style={{ ...styles.button, backgroundColor: "#0ea5e9", color: "#fff" }}
          >
            {copiedPrompt === "question" ? "Copied!" : "Copy prompt"}
          </button>
        </div>
        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          This prompt feeds the <Link href="/questions" style={{ color: "#0ea5e9" }}>Question Workspace</Link> and{" "}
          <Link href="/questions/bulk/" style={{ color: "#0ea5e9" }}>Bulk Response</Link> pages.
        </p>
      </div>
    </div>
  );
}
