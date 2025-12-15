"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { QUESTION_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import Link from "next/link";
import ConversationalRefinement from "@/components/ConversationalRefinement";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";
import SkillRecommendation from "@/components/SkillRecommendation";
import TransparencyDetails from "@/components/TransparencyDetails";
import { parseAnswerSections, selectRelevantSkills } from "@/lib/questionHelpers";
import LoadingSpinner from "@/components/LoadingSpinner";
import DomainSelector, { Domain } from "@/components/DomainSelector";

type QuestionHistoryItem = {
  id: string;
  question: string;
  response: string;
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  skillsUsed?: { id: string; title: string }[];
  createdAt: string;
};

const formatHistoryDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    marginTop: "4px",
    fontSize: "0.95rem",
  },
  button: {
    padding: "12px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "8px",
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
  const [questionReasoning, setQuestionReasoning] = useState("");
  const [questionInference, setQuestionInference] = useState("");
  const [promptText] = useStoredPrompt(
    QUESTION_PROMPT_STORAGE_KEY,
    defaultQuestionPrompt,
  );
  const [isAnswering, setIsAnswering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [currentUsedSkills, setCurrentUsedSkills] = useState<Skill[]>([]);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [questionHistory, setQuestionHistory] = useState<QuestionHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);

  const { data: session } = useSession();

  // Fetch question history
  const fetchHistory = useCallback(async () => {
    if (!session?.user) return;
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/question-history?limit=20");
      if (response.ok) {
        const data = await response.json();
        setQuestionHistory(data.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch question history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [session?.user]);

  // Save question to history
  const saveToHistory = async (
    question: string,
    response: string,
    confidence: string,
    sources: string,
    reasoning: string,
    inference: string,
    remarks: string,
    skillsUsed: { id: string; title: string }[]
  ) => {
    if (!session?.user) return;
    try {
      await fetch("/api/question-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          response,
          confidence,
          sources,
          reasoning,
          inference,
          remarks,
          skillsUsed,
        }),
      });
      // Refresh history after saving
      fetchHistory();
    } catch (error) {
      console.error("Failed to save to history:", error);
    }
  };

  // Delete a history item
  const deleteHistoryItem = async (id: string) => {
    try {
      const response = await fetch(`/api/question-history/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setQuestionHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete history item:", error);
    }
  };

  // Load a history item into the current view
  const loadHistoryItem = (item: QuestionHistoryItem) => {
    setQuestionText(item.question);
    setQuestionResponse(item.response);
    setQuestionConfidence(item.confidence || "");
    setQuestionSources(item.sources || "");
    setQuestionRemarks(item.remarks || "");
    setQuestionReasoning(item.reasoning || "");
    setQuestionInference(item.inference || "");
    // For history items, create minimal skill objects for display purposes
    setCurrentUsedSkills(
      (item.skillsUsed || []).map((s) => ({
        id: s.id,
        title: s.title,
        content: "",
        tags: [],
        isActive: true,
        createdAt: "",
        updatedAt: "",
        quickFacts: [],
        edgeCases: [],
        sourceUrls: [],
      }))
    );
    setShowHistory(false);
  };

  // Load skills on mount
  useEffect(() => {
    loadSkillsFromApi().then(setAvailableSkills).catch(() => toast.error("Failed to load skills"));
  }, []);

  // Load history when session is available
  useEffect(() => {
    if (session?.user) {
      fetchHistory();
    }
  }, [session?.user, fetchHistory]);

  const handleQuestionInput = (value: string) => {
    setQuestionText(value);
    if (questionResponse) {
      setQuestionResponse("");
      setQuestionConfidence("");
      setQuestionSources("");
      setQuestionRemarks("");
      setQuestionReasoning("");
      setQuestionInference("");
    }
  };

  const askQuestion = async () => {
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
    setQuestionReasoning("");
    setQuestionInference("");
    setDetailsExpanded(false);

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
        body: JSON.stringify({
          question,
          prompt: promptText,
          skills: skillsPayload,
          mode: "single",
          domains: selectedDomains.length > 0 ? selectedDomains : undefined,
        }),
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
      setQuestionReasoning(parsed.reasoning);
      setQuestionInference(parsed.inference);

      // Track which skills were used and show recommendation
      setCurrentUsedSkills(relevantSkills);
      setShowRecommendation(true);

      // Save to history (async, don't await)
      saveToHistory(
        question,
        parsed.response,
        parsed.confidence,
        parsed.sources,
        parsed.reasoning,
        parsed.inference,
        parsed.remarks,
        relevantSkills.map((s) => ({ id: s.id, title: s.title }))
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error while generating response.",
      );
    } finally {
      setIsAnswering(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isAnswering) {
      e.preventDefault();
      askQuestion();
    }
  };

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>
          RFP Quick Questions
        </h1>
        <p style={{ fontSize: "1rem", color: "#475569", maxWidth: "700px", lineHeight: 1.6 }}>
          Answer individual RFP and security questionnaire questions with AI-powered responses grounded in your knowledge base.
          For bulk processing, use <Link href="/projects" style={{ color: "#0369a1" }}>Projects</Link>.
        </p>
      </div>

      <SkillUpdateBanner skills={availableSkills} />

      {/* Question History Panel */}
      <div style={{ marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: showHistory ? "#dbeafe" : "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "0.9rem",
            color: "#475569",
            fontWeight: 500,
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <span>📜 Question History {session?.user ? `(${questionHistory.length})` : ""}</span>
          <span style={{ fontSize: "0.8rem" }}>{showHistory ? "▲" : "▼"}</span>
        </button>

        {showHistory && (
          <div
            style={{
              marginTop: "8px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              backgroundColor: "#fff",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            {!session?.user ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                <Link href="/auth/signin" style={{ color: "#0ea5e9", fontWeight: 500 }}>Sign in</Link> to save and view your question history.
              </div>
            ) : loadingHistory ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                Loading history...
              </div>
            ) : questionHistory.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                No question history yet. Ask a question to get started!
              </div>
            ) : (
                questionHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div
                        style={{ flex: 1, cursor: "pointer" }}
                        onClick={() => loadHistoryItem(item)}
                      >
                        <div
                          style={{
                            fontWeight: 500,
                            color: "#1e293b",
                            marginBottom: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "calc(100% - 100px)",
                          }}
                        >
                          {item.question}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "calc(100% - 100px)",
                          }}
                        >
                          {item.response.slice(0, 100)}...
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                          {formatHistoryDate(item.createdAt)}
                          {item.confidence && (
                            <span style={{ marginLeft: "8px" }}>• {item.confidence}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          borderRadius: "4px",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        title="Delete from history"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}

      {/* Quick Question Section */}
      <div style={styles.card}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "1.25rem" }}>Ask a Quick Question</h2>
        <p style={{ color: "#64748b", margin: "0 0 16px 0", fontSize: "0.9rem" }}>
          Try it out - ask any compliance, security, or policy question. We&apos;ll search your knowledge base and show you exactly how we found the answer.
        </p>

        <div style={{ position: "relative" }}>
          <textarea
            id="questionText"
            value={questionText}
            onChange={(event) => handleQuestionInput(event.target.value.slice(0, 5000))}
            onKeyDown={handleKeyDown}
            style={{
              ...styles.input,
              minHeight: "80px",
              resize: "vertical",
              paddingRight: "100px",
            }}
            placeholder="Ask any question... (Press Enter to submit)"
            maxLength={5000}
          />
          <button
            type="button"
            onClick={askQuestion}
            disabled={isAnswering || !questionText.trim()}
            style={{
              position: "absolute",
              right: "8px",
              bottom: "12px",
              ...styles.button,
              backgroundColor: isAnswering || !questionText.trim() ? "#94a3b8" : "#0ea5e9",
              color: "#fff",
              cursor: isAnswering || !questionText.trim() ? "not-allowed" : "pointer",
              padding: "8px 16px",
            }}
          >
            {isAnswering ? "..." : "Ask"}
          </button>
        </div>

        <DomainSelector
          selectedDomains={selectedDomains}
          onChange={setSelectedDomains}
          disabled={isAnswering}
          style={{ marginTop: "12px" }}
        />

        {isAnswering && (
          <div style={{ marginTop: "16px" }}>
            <LoadingSpinner
              title="Generating response..."
              subtitle="Analyzing your question and searching knowledge base. This may take 10-20 seconds."
            />
          </div>
        )}

        {/* Response Section */}
        {questionResponse && (
          <div style={{
            marginTop: "20px",
            padding: "16px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "#0f172a" }}>Response</h3>
            <div style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              color: "#1e293b",
              fontSize: "0.95rem",
            }}>
              {questionResponse}
            </div>

            {/* Transparency Details using component */}
            <TransparencyDetails
              data={{
                confidence: questionConfidence,
                reasoning: questionReasoning,
                inference: questionInference,
                remarks: questionRemarks,
                sources: questionSources,
              }}
              defaultExpanded={detailsExpanded}
              onToggle={setDetailsExpanded}
              knowledgeReferences={currentUsedSkills.map(skill => ({
                id: skill.id,
                title: skill.title,
                type: "skill" as const,
              }))}
              renderClarifyButton={!conversationOpen ? () => (
                <button
                  type="button"
                  onClick={() => setConversationOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    backgroundColor: "#0ea5e9",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Clarify
                </button>
              ) : undefined}
            />
          </div>
        )}

        {/* Skill Recommendations */}
        {showRecommendation && questionResponse && (
          <SkillRecommendation
            usedSkills={currentUsedSkills}
            question={questionText}
            onDismiss={() => setShowRecommendation(false)}
          />
        )}

        {/* Conversational Refinement */}
        {questionResponse && conversationOpen && (
          <div style={{ marginTop: "16px" }}>
            <ConversationalRefinement
              originalQuestion={questionText}
              currentResponse={`${questionResponse}\n\nConfidence: ${questionConfidence}\nSources: ${questionSources}\nReasoning: ${questionReasoning}\nInference: ${questionInference}\nRemarks: ${questionRemarks}`}
              onResponseUpdate={(newResponse) => {
                const parsed = parseAnswerSections(newResponse);
                setQuestionResponse(parsed.response);
                setQuestionConfidence(parsed.confidence);
                setQuestionSources(parsed.sources);
                setQuestionRemarks(parsed.remarks);
                setQuestionReasoning(parsed.reasoning);
                setQuestionInference(parsed.inference);
              }}
              onClose={() => setConversationOpen(false)}
              promptText={promptText}
            />
          </div>
        )}
      </div>

      {/* Skills Count */}
      {availableSkills.length > 0 && (
        <div style={{
          textAlign: "center",
          padding: "16px",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          color: "#64748b",
          fontSize: "0.9rem",
        }}>
          Your knowledge base contains <strong style={{ color: "#0ea5e9" }}>{availableSkills.length} skills</strong>.{" "}
          <Link href="/knowledge" style={{ color: "#0ea5e9" }}>Manage your library</Link>
        </div>
      )}
    </div>
  );
}
