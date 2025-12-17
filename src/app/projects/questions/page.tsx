"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
import { parseAnswerSections, selectRelevantSkills } from "@/lib/questionHelpers";
import LoadingSpinner from "@/components/LoadingSpinner";
import DomainSelector, { Domain } from "@/components/DomainSelector";
import { useFlagReview } from "@/components/FlagReviewModal";
import { SpeedToggle } from "@/components/speed-toggle";

import {
  QuestionHistoryPanel,
  ResponseSection,
  styles,
  QuestionHistoryItem,
} from "./components";

export default function QuestionsPage() {
  return (
    <Suspense fallback={<LoadingSpinner title="Loading..." />}>
      <QuestionsPageContent />
    </Suspense>
  );
}

function QuestionsPageContent() {
  const searchParams = useSearchParams();
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
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [currentFlagged, setCurrentFlagged] = useState(false);
  const [currentFlagNote, setCurrentFlagNote] = useState<string | null>(null);
  const [currentReviewStatus, setCurrentReviewStatus] = useState<string | null>(null);
  const [currentReviewedBy, setCurrentReviewedBy] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResponse, setEditedResponse] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  const [quickMode, setQuickMode] = useState(false);

  const { data: session } = useSession();
  const { openFlagReview, FlagReviewDialog } = useFlagReview();

  // Fetch question history
  const fetchHistory = useCallback(async () => {
    if (!session?.user) return;
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/question-history?limit=20");
      if (response.ok) {
        const json = await response.json();
        const data = json.data ?? json;
        setQuestionHistory(data.history || []);
      }
    } catch {
      // Silent failure - history is not critical
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
  ): Promise<string | null> => {
    if (!session?.user) return null;
    try {
      const res = await fetch("/api/question-history", {
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
      const json = await res.json();
      const data = json.data ?? json;
      // Refresh history after saving
      fetchHistory();
      return data.entry?.id || data.id || null;
    } catch {
      // Silent failure - saving history is not critical
      return null;
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
    } catch {
      toast.error("Failed to delete history item");
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
    setCurrentHistoryId(item.id);
    setCurrentFlagged(item.flaggedForReview || false);
    setCurrentFlagNote(item.flagNote || null);
    setCurrentReviewStatus(item.reviewStatus || null);
    setCurrentReviewedBy(item.reviewedBy || null);
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

  // Load a specific question by ID
  const loadQuestionById = useCallback(async (id: string, startEditing: boolean = false) => {
    try {
      const response = await fetch(`/api/question-history/${id}`);
      if (response.ok) {
        const json = await response.json();
        const data = json.data ?? json;
        if (data.question) {
          const item = data.question;
          setQuestionText(item.question);
          setQuestionResponse(item.response);
          setQuestionConfidence(item.confidence || "");
          setQuestionSources(item.sources || "");
          setQuestionRemarks(item.remarks || "");
          setQuestionReasoning(item.reasoning || "");
          setQuestionInference(item.inference || "");
          setCurrentHistoryId(item.id);
          setCurrentFlagged(item.flaggedForReview || false);
          setCurrentFlagNote(item.flagNote || null);
          setCurrentReviewStatus(item.reviewStatus || null);
          setCurrentReviewedBy(item.reviewedBy || null);
          setCurrentUsedSkills(
            (item.skillsUsed || []).map((s: { id: string; title: string }) => ({
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
          if (startEditing) {
            setEditedResponse(item.response);
            setIsEditing(true);
          }
        }
      }
    } catch {
      toast.error("Failed to load question");
    }
  }, []);

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

  // Handle URL params for deep linking
  useEffect(() => {
    const questionId = searchParams.get("id");
    const shouldEdit = searchParams.get("edit") === "true";
    if (questionId) {
      loadQuestionById(questionId, shouldEdit);
    }
  }, [searchParams, loadQuestionById]);

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
          quickMode,
        }),
      });
      const json = await response.json().catch(() => null);
      const data = json?.data ?? json;
      if (!response.ok || !data?.answer) {
        throw new Error(json?.error || data?.error || "Failed to generate response.");
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

      // Save to history and capture ID
      const historyId = await saveToHistory(
        question,
        parsed.response,
        parsed.confidence,
        parsed.sources,
        parsed.reasoning,
        parsed.inference,
        parsed.remarks,
        relevantSkills.map((s) => ({ id: s.id, title: s.title }))
      );
      setCurrentHistoryId(historyId);
      setCurrentFlagged(false);
      setCurrentFlagNote(null);
      setCurrentReviewStatus(null);
      setCurrentReviewedBy(null);
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

  // Handle Flag or Need Help action for the current answer
  const handleFlagOrReview = async (initialAction: "flag" | "need-help" = "need-help") => {
    if (!currentHistoryId) {
      toast.error("No answer to review. Ask a question first.");
      return;
    }

    // Open the unified modal (no queueing for quick questions - always send now)
    const data = await openFlagReview(initialAction);
    if (!data) return; // Cancelled

    try {
      if (data.action === "flag") {
        // Just flag
        const response = await fetch(`/api/question-history/${currentHistoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flaggedForReview: true,
            flagNote: data.note || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to flag answer");
        }

        setCurrentFlagged(true);
        setCurrentFlagNote(data.note || null);
        toast.success("Answer flagged!");
      } else {
        // Need help - send for review
        const response = await fetch(`/api/question-history/${currentHistoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewStatus: "REQUESTED",
            reviewNote: data.note || null,
            reviewRequestedBy: session?.user?.name || session?.user?.email || "Unknown User",
            assignedReviewerId: data.reviewerId || null,
            assignedReviewerName: data.reviewerName || null,
            flaggedForReview: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to request review");
        }

        setCurrentReviewStatus("REQUESTED");
        setCurrentFlagged(true);
        const reviewerMsg = data.reviewerName ? ` to ${data.reviewerName}` : "";
        toast.success(`Review requested${reviewerMsg}!`);
      }
      fetchHistory();
    } catch {
      toast.error("Failed to process. Please try again.");
    }
  };

  // Save edited response (mark as corrected)
  const handleSaveCorrection = async () => {
    if (!currentHistoryId || !editedResponse.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/question-history/${currentHistoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEditedAnswer: editedResponse,
          response: editedResponse, // Also update the main response
          reviewStatus: "CORRECTED",
          reviewedAt: new Date().toISOString(),
          reviewedBy: session?.user?.name || session?.user?.email || "Unknown User",
          flaggedForReview: false, // Clear flagged status
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save correction");
      }

      const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";
      setQuestionResponse(editedResponse);
      setCurrentReviewStatus("CORRECTED");
      setCurrentReviewedBy(reviewerName);
      setCurrentFlagged(false);
      setIsEditing(false);
      toast.success("Correction saved!");
      fetchHistory();
    } catch {
      toast.error("Failed to save correction");
    } finally {
      setIsSaving(false);
    }
  };

  // Approve the answer as-is (no correction needed)
  const handleApprove = async () => {
    if (!currentHistoryId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/question-history/${currentHistoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "APPROVED",
          reviewedAt: new Date().toISOString(),
          reviewedBy: session?.user?.name || session?.user?.email || "Unknown User",
          flaggedForReview: false, // Clear flagged status
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve");
      }

      const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";
      setCurrentReviewStatus("APPROVED");
      setCurrentReviewedBy(reviewerName);
      setCurrentFlagged(false);
      setIsEditing(false);
      toast.success("Answer verified!");
      fetchHistory();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setIsSaving(false);
    }
  };

  // Unflag the current answer
  const handleUnflag = async () => {
    if (!currentHistoryId) return;

    try {
      const response = await fetch(`/api/question-history/${currentHistoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flaggedForReview: false,
          flagNote: null,
          reviewStatus: "NONE",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to unflag");
      }

      setCurrentFlagged(false);
      setCurrentFlagNote(null);
      setCurrentReviewStatus("NONE");
      toast.success("Flag removed");
      fetchHistory();
    } catch {
      toast.error("Failed to remove flag");
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
      <QuestionHistoryPanel
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        questionHistory={questionHistory}
        isLoggedIn={!!session?.user}
        loadingHistory={loadingHistory}
        onLoadHistoryItem={loadHistoryItem}
        onDeleteHistoryItem={deleteHistoryItem}
      />

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

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", gap: "16px" }}>
          <DomainSelector
            selectedDomains={selectedDomains}
            onChange={setSelectedDomains}
            disabled={isAnswering}
          />
          <SpeedToggle
            quickMode={quickMode}
            onChange={setQuickMode}
            disabled={isAnswering}
          />
        </div>

        {isAnswering && (
          <div style={{ marginTop: "16px" }}>
            <LoadingSpinner
              title="Generating response..."
              subtitle={quickMode
                ? "Using fast mode. This typically takes 2-5 seconds."
                : "Analyzing your question and searching knowledge base. This may take 10-20 seconds."
              }
            />
          </div>
        )}

        {/* Response Section */}
        {questionResponse && (
          <ResponseSection
            questionResponse={questionResponse}
            questionConfidence={questionConfidence}
            questionSources={questionSources}
            questionRemarks={questionRemarks}
            questionReasoning={questionReasoning}
            questionInference={questionInference}
            currentUsedSkills={currentUsedSkills}
            currentHistoryId={currentHistoryId}
            currentFlagged={currentFlagged}
            currentFlagNote={currentFlagNote}
            currentReviewStatus={currentReviewStatus}
            currentReviewedBy={currentReviewedBy}
            isEditing={isEditing}
            editedResponse={editedResponse}
            isSaving={isSaving}
            isLoggedIn={!!session?.user}
            detailsExpanded={detailsExpanded}
            conversationOpen={conversationOpen}
            onSetEditedResponse={setEditedResponse}
            onSetIsEditing={setIsEditing}
            onSetDetailsExpanded={setDetailsExpanded}
            onSetConversationOpen={setConversationOpen}
            onSaveCorrection={handleSaveCorrection}
            onApprove={handleApprove}
            onFlagOrReview={handleFlagOrReview}
            onUnflag={handleUnflag}
          />
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

      {/* Flag/Review Modal */}
      <FlagReviewDialog />
    </div>
  );
}
