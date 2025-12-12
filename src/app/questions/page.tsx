"use client";

import { useEffect, useState } from "react";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { QUESTION_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import Link from "next/link";
import ConversationalRefinement from "@/components/ConversationalRefinement";
import { loadSkillsFromStorage } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";
import SkillRecommendation from "@/components/SkillRecommendation";
import { parseAnswerSections, selectRelevantSkills } from "@/lib/questionHelpers";
import LoadingSpinner from "@/components/LoadingSpinner";

// Helper to render text with clickable URLs
function renderTextWithLinks(text: string): React.ReactNode {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s,\n)>\]]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            wordBreak: "break-all"
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

const styles = {
  container: {
    maxWidth: "860px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
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
    borderRadius: "4px",
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
  subBox: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "12px",
    backgroundColor: "#f8fafc",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
};

export default function QuestionsPage() {
  const [questionText, setQuestionText] = useState("");
  const [questionResponse, setQuestionResponse] = useState("");
  const [questionConfidence, setQuestionConfidence] = useState("");
  const [questionSources, setQuestionSources] = useState("");
  const [questionRemarks, setQuestionRemarks] = useState("");
  const [promptText, setPromptText] = useStoredPrompt(
    QUESTION_PROMPT_STORAGE_KEY,
    defaultQuestionPrompt,
  );
  const [isAnswering, setIsAnswering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [currentUsedSkills, setCurrentUsedSkills] = useState<Skill[]>([]);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(true);

  // Load skills on mount
  useEffect(() => {
    setAvailableSkills(loadSkillsFromStorage());
  }, []);

  const handleQuestionInput = (value: string) => {
    setQuestionText(value);
    if (questionResponse) {
      setQuestionResponse("");
      setQuestionConfidence("");
      setQuestionSources("");
      setQuestionRemarks("");
    }
  };

  const askGrcMinion = async () => {
    const question = questionText.trim();
    if (!question) {
      setErrorMessage("Enter a question first.");
      return;
    }

    setIsAnswering(true);
    setErrorMessage(null);
    setQuestionResponse("");
    setQuestionConfidence("");
    setQuestionSources("");
    setQuestionRemarks("");

    try {
      // Select relevant skills for this question
      const relevantSkills = selectRelevantSkills(question, availableSkills);
      const skillsPayload = relevantSkills.map((skill) => ({
        title: skill.title,
        content: skill.content,
        tags: skill.tags,
      }));

      const response = await fetch("/api/questions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, prompt: promptText, skills: skillsPayload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) {
        throw new Error(data?.error || "Failed to generate response.");
      }
      const parsed = parseAnswerSections(data.answer);
      setQuestionResponse(parsed.response);
      setQuestionConfidence(parsed.confidence);
      setQuestionSources(parsed.sources);
      setQuestionRemarks(parsed.remarks);

      // Track which skills were used and show recommendation
      setCurrentUsedSkills(relevantSkills);
      setShowRecommendation(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error while generating response.",
      );
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>GRC Minion <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Question Workspace)</span></h1>
      <p style={{ color: "#475569" }}>
        Ask questions and get concise responses with structured answers including confidence levels, sources, and remarks.
      </p>

      {/* Quick Navigation to Projects */}
      <div style={{
        ...styles.card,
        backgroundColor: "#f0f9ff",
        borderColor: "#bae6fd",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <strong style={{ color: "#0369a1" }}>Working on a questionnaire?</strong>
          <p style={{ margin: "4px 0 0 0", color: "#475569", fontSize: "0.9rem" }}>
            Upload a spreadsheet and process multiple questions at once in the Projects workspace.
          </p>
        </div>
        <Link
          href="/projects"
          style={{
            padding: "10px 16px",
            backgroundColor: "#0ea5e9",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap"
          }}
        >
          Go to Projects
        </Link>
      </div>

      <SkillUpdateBanner skills={availableSkills} />

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}

      <div style={styles.card}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ ...styles.subBox, backgroundColor: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0 }}>Enter a question</h3>
              <span style={{
                fontSize: "11px",
                color: questionText.length > 4500 ? "#dc2626" : "#94a3b8",
              }}>
                {questionText.length.toLocaleString()} / 5,000
              </span>
            </div>
            <textarea
              id="questionText"
              value={questionText}
              onChange={(event) => handleQuestionInput(event.target.value.slice(0, 5000))}
              style={{ ...styles.input, minHeight: "120px", resize: "vertical" }}
              placeholder="Ask any question..."
              maxLength={5000}
            />
          </div>
          <div style={styles.subBox}>
            <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Response</h3>
            <textarea
              id="questionResponse"
              value={questionResponse}
              readOnly
              style={{ ...styles.input, minHeight: "140px", resize: "vertical" }}
              placeholder="Response will appear here..."
            />
            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              <div>
                <label style={styles.label} htmlFor="questionConfidence">
                  Confidence
                </label>
                <input
                  id="questionConfidence"
                  type="text"
                  value={questionConfidence}
                  readOnly
                  placeholder="Will appear after response..."
                  style={{ ...styles.input }}
                />
              </div>
              <div>
                <label style={styles.label} htmlFor="questionSources">
                  Sources
                </label>
                <div
                  id="questionSources"
                  style={{
                    ...styles.input,
                    minHeight: "90px",
                    backgroundColor: "#fff",
                    whiteSpace: "pre-wrap",
                    overflowY: "auto",
                    color: questionSources ? "#0f172a" : "#9ca3af"
                  }}
                >
                  {questionSources ? renderTextWithLinks(questionSources) : "Source links or citations will appear here..."}
                </div>
              </div>
              <div>
                <label style={styles.label} htmlFor="questionRemarks">
                  Remarks
                </label>
                <textarea
                  id="questionRemarks"
                  value={questionRemarks}
                  readOnly
                  style={{ ...styles.input, minHeight: "70px", resize: "vertical" }}
                  placeholder="Follow-ups or assumptions appear here..."
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={askGrcMinion}
            disabled={isAnswering}
            style={{
              ...styles.button,
              backgroundColor: isAnswering ? "#94a3b8" : "#0ea5e9",
              color: "#fff",
              cursor: isAnswering ? "not-allowed" : "pointer",
            }}
          >
            {isAnswering ? "Generating..." : "Ask"}
          </button>
          {isAnswering && (
            <LoadingSpinner
              title="Generating response..."
              subtitle="Analyzing your question and searching knowledge base. This may take 10-20 seconds."
            />
          )}
        </div>

        {/* Skill Recommendations */}
        {showRecommendation && questionResponse && (
          <SkillRecommendation
            usedSkills={currentUsedSkills}
            question={questionText}
            allSkills={availableSkills}
            onDismiss={() => setShowRecommendation(false)}
          />
        )}

        {/* Conversational Refinement */}
        {questionResponse && (
          <div style={{ marginTop: "16px" }}>
            {!conversationOpen ? (
              <button
                type="button"
                onClick={() => setConversationOpen(true)}
                style={{
                  ...styles.button,
                  backgroundColor: "#0ea5e9",
                  color: "#fff",
                }}
              >
                💬 Ask GRC about this response
              </button>
            ) : (
              <ConversationalRefinement
                originalQuestion={questionText}
                currentResponse={`${questionResponse}\n\nConfidence: ${questionConfidence}\nSources: ${questionSources}\nRemarks: ${questionRemarks}`}
                onResponseUpdate={(newResponse) => {
                  const parsed = parseAnswerSections(newResponse);
                  setQuestionResponse(parsed.response);
                  setQuestionConfidence(parsed.confidence);
                  setQuestionSources(parsed.sources);
                  setQuestionRemarks(parsed.remarks);
                }}
                onClose={() => setConversationOpen(false)}
                promptText={promptText}
              />
            )}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: promptCollapsed ? "0" : "12px" }}>
          <label style={{ ...styles.label, marginTop: 0 }} htmlFor="promptText">
            System Prompt
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
              onChange={(event) => setPromptText(event.target.value.slice(0, 50000))}
              style={{
                ...styles.input,
                minHeight: "220px",
                resize: "vertical",
                fontFamily: "monospace",
                backgroundColor: "#f8fafc",
              }}
              maxLength={50000}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>
                Responses will follow this exact instruction set. Edit it to tune tone,
                structure, or sourcing rules—no hidden prompts.
              </p>
              <span style={{
                fontSize: "11px",
                color: promptText.length > 45000 ? "#dc2626" : "#94a3b8",
                whiteSpace: "nowrap",
                marginLeft: "12px",
              }}>
                {promptText.length.toLocaleString()} / 50,000
              </span>
            </div>
          </>
        )}

        {promptCollapsed && (
          <div style={{ marginTop: "8px" }}>
            <a href="/prompts" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
              Need to edit the prompt? Visit Prompt Home →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
