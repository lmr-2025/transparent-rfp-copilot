"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { QUESTION_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import { BulkProject, BulkRow, ProjectCustomerProfileRef } from "@/types/bulkProject";
import { fetchProject, updateProject, deleteProject as deleteProjectApi } from "@/lib/projectApi";
import ConversationalRefinement from "@/components/ConversationalRefinement";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import { parseAnswerSections, selectRelevantSkills } from "@/lib/questionHelpers";
import { ReferenceUrl } from "@/types/referenceUrl";
import { fetchMultipleUrls } from "@/lib/urlFetcher";
import SkillRecommendation from "@/components/SkillRecommendation";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";
import TransparencyDetails from "@/components/TransparencyDetails";
import {
  exportProjectToExcel,
  exportCompletedOnly,
  exportHighConfidenceOnly,
  exportLowConfidenceOnly,
} from "@/lib/excelExport";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
import { CustomerProfile } from "@/types/customerProfile";

// Helper to render text with clickable URLs
function renderTextWithLinks(text: string): React.ReactNode {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s,\n)>\]]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex since we're using it multiple times
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
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "0.85rem",
    fontWeight: 600,
    display: "inline-block",
  },
};

const getStatusColor = (status: BulkProject["status"]) => {
  switch (status) {
    case "draft":
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
    case "in_progress":
      return { backgroundColor: "#dbeafe", color: "#1e40af" };
    case "needs_review":
      return { backgroundColor: "#fef3c7", color: "#92400e" };
    case "approved":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    default:
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
  }
};

const getStatusLabel = (status: BulkProject["status"]) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_progress":
      return "In Progress";
    case "needs_review":
      return "Needs Review";
    case "approved":
      return "Approved";
    default:
      return status;
  }
};

export default function BulkResponsesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const { data: session } = useSession();

  const [project, setProject] = useState<BulkProject | null>(null);
  const [promptText, setPromptText] = useStoredPrompt(
    QUESTION_PROMPT_STORAGE_KEY,
    defaultQuestionPrompt,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<ReferenceUrl[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "high" | "medium" | "low" | "error" | "flagged">("all");
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 });
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [allCustomerProfiles, setAllCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [savingCustomers, setSavingCustomers] = useState(false);

  // Load project by ID on mount
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        const loaded = await fetchProject(projectId);
        if (!loaded) {
          router.push("/projects");
          return;
        }
        setProject(loaded);
      } catch (error) {
        console.error("Failed to load project:", error);
        setErrorMessage("Failed to load project. Redirecting...");
        setTimeout(() => router.push("/projects"), 2000);
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

  // Load skills, reference URLs, and customer profiles on mount
  useEffect(() => {
    loadSkillsFromApi().then(setAvailableSkills).catch(console.error);
    // Load reference URLs from database API
    fetch("/api/reference-urls")
      .then(res => res.json())
      .then(data => setReferenceUrls(data.urls || []))
      .catch(err => console.error("Failed to load reference URLs:", err));
    fetchActiveProfiles()
      .then(profiles => setAllCustomerProfiles(profiles))
      .catch(err => console.error("Failed to load customer profiles:", err));
  }, []);

  // Handle filter query param from URL (e.g., ?filter=flagged)
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "flagged") {
      setStatusFilter("flagged");
    }
  }, [searchParams]);

  const stats = useMemo(() => {
    if (!project) {
      return { total: 0, high: 0, medium: 0, low: 0, errors: 0, flagged: 0 };
    }
    const total = project.rows.length;
    const high = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('high')).length;
    const medium = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('medium')).length;
    const low = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('low')).length;
    const errors = project.rows.filter((row) => row.status === "error").length;
    const flagged = project.rows.filter((row) => row.flaggedForReview).length;
    return { total, high, medium, low, errors, flagged };
  }, [project]);

  const filteredRows = useMemo(() => {
    if (!project) return [];
    if (statusFilter === "all") return project.rows;
    if (statusFilter === "error") {
      return project.rows.filter((row) => row.status === "error");
    }
    if (statusFilter === "flagged") {
      return project.rows.filter((row) => row.flaggedForReview);
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

      // If no skills match, fetch reference URLs and documents as fallback
      let fallbackContent: { title: string; url: string; content: string }[] | undefined;
      if (relevantSkills.length === 0) {
        const fallbackItems: { title: string; url: string; content: string }[] = [];

        // Fetch reference URLs
        if (referenceUrls.length > 0) {
          const fetched = await fetchMultipleUrls(referenceUrls);
          fetched
            .filter((f) => !f.error && f.content.trim().length > 0)
            .forEach((f) => fallbackItems.push({ title: f.title, url: f.url, content: f.content }));
        }

        // Fetch documents from database
        try {
          const docsResponse = await fetch("/api/documents/content");
          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            if (docsData.documents && Array.isArray(docsData.documents)) {
              docsData.documents.forEach((doc: { title: string; filename: string; content: string }) => {
                if (doc.content?.trim()) {
                  fallbackItems.push({
                    title: doc.title,
                    url: `document://${doc.filename}`,
                    content: doc.content,
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn("Failed to fetch documents for fallback:", e);
        }

        if (fallbackItems.length > 0) {
          fallbackContent = fallbackItems;
        }
      }

      const response = await fetch("/api/questions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: row.question.trim(),
          prompt: promptText,
          skills: skillsPayload,
          fallbackContent,
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
        reasoning: parsed.reasoning,
        inference: parsed.inference,
        remarks: parsed.remarks,
        usedSkills: relevantSkills,
        usedFallback: data.usedFallback || false,
        showRecommendation: true,
        status: "completed",
        error: undefined,
        conversationHistory: data.conversationHistory,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error while generating response.";
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
          if (!row.id) return;
          await handleGenerateResponse(row.id);
          completed++;
          setGenerateProgress({ current: completed, total });
        })
      );
    }

    setIsGeneratingAll(false);
    setGenerateProgress({ current: 0, total: 0 });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      `Generated answer:\n${row.response}`,
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
        router.push("/projects");
      } catch (error) {
        console.error("Failed to delete project:", error);
        alert("Failed to delete project. Please try again.");
      }
    }
  };

  const handleRequestReview = async () => {
    if (!project) return;

    // Use session user name, or prompt if not signed in
    const requesterName = session?.user?.name || prompt("Your name (requesting review):");
    if (!requesterName?.trim()) return;

    setIsRequestingReview(true);
    try {
      const updatedProject = {
        ...project,
        status: "needs_review" as const,
        reviewRequestedAt: new Date().toISOString(),
        reviewRequestedBy: requesterName.trim(),
      };
      await updateProject(updatedProject);
      setProject(updatedProject);

      // Send Slack notification
      const projectUrl = `${window.location.origin}/projects/${project.id}`;
      await fetch("/api/slack/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          projectUrl,
          customerName: project.customerName,
          requesterName: requesterName.trim(),
        }),
      });

      alert("Review requested! A notification has been sent.");
    } catch (error) {
      console.error("Failed to request review:", error);
      alert("Failed to request review. Please try again.");
    } finally {
      setIsRequestingReview(false);
    }
  };

  const handleApprove = async () => {
    if (!project) return;

    // Use session user name, or prompt if not signed in
    const reviewerName = session?.user?.name || prompt("Your name (reviewer):");
    if (!reviewerName?.trim()) return;

    setIsApproving(true);
    try {
      const updatedProject = {
        ...project,
        status: "approved" as const,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName.trim(),
      };
      await updateProject(updatedProject);
      setProject(updatedProject);
      alert("Project approved!");
    } catch (error) {
      console.error("Failed to approve project:", error);
      alert("Failed to approve project. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveCustomerProfiles = async (selectedIds: string[]) => {
    if (!project) return;

    setSavingCustomers(true);
    try {
      // Call API to update customer profile associations
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerProfileIds: selectedIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to save customer profiles");
      }

      const data = await response.json();
      // Update local state with returned project (which includes customerProfiles)
      setProject(data.project);
      setShowCustomerSelector(false);
    } catch (error) {
      console.error("Failed to save customer profiles:", error);
      alert("Failed to save customer profiles. Please try again.");
    } finally {
      setSavingCustomers(false);
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
        <Link href="/projects/" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
          ← Back to Projects
        </Link>
      </div>
      <h1>Answer Goblin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Bulk Workspace)</span></h1>
      <p style={{ color: "#475569" }}>
        Generate answers, review them, and challenge questionable responses to improve future skills.
      </p>

      {errorMessage && <div style={{ ...styles.card, backgroundColor: "#fee2e2" }}>{errorMessage}</div>}

      <SkillUpdateBanner skills={availableSkills} />

      <div style={{ ...styles.card, display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
        <div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ ...styles.statusBadge, ...getStatusColor(project.status) }}>
              {getStatusLabel(project.status)}
            </span>
          </div>
          <strong>Project:</strong> {project.name}
          <br />
          <strong>Worksheet:</strong> {project.sheetName}
          <br />
          <strong>Created:</strong> {new Date(project.createdAt).toLocaleString()}
          {project.reviewRequestedBy && (
            <>
              <br />
              <strong>Review requested by:</strong> {project.reviewRequestedBy}
            </>
          )}
          {project.reviewedBy && (
            <>
              <br />
              <strong>Approved by:</strong> {project.reviewedBy}
            </>
          )}
          <div style={{ marginTop: "8px" }}>
            <strong>Customers:</strong>{" "}
            {project.customerProfiles && project.customerProfiles.length > 0 ? (
              <span>
                {project.customerProfiles.map((cp, idx) => (
                  <span key={cp.id}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      backgroundColor: "#e0e7ff",
                      color: "#4338ca",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      marginRight: "4px",
                    }}>
                      {cp.name}
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <span style={{ color: "#94a3b8" }}>None linked</span>
            )}
            <button
              type="button"
              onClick={() => setShowCustomerSelector(true)}
              style={{
                marginLeft: "8px",
                padding: "2px 8px",
                fontSize: "0.8rem",
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          </div>
        </div>
        <div>
          <strong>Total:</strong> {stats.total} · <strong>High:</strong> {stats.high} ·{" "}
          <strong>Medium:</strong> {stats.medium} · <strong>Low:</strong> {stats.low} ·{" "}
          <strong>Errors:</strong> {stats.errors}
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {(project.status === "draft" || project.status === "in_progress") && (
            <button
              type="button"
              onClick={handleRequestReview}
              disabled={isRequestingReview}
              style={{
                ...styles.button,
                backgroundColor: isRequestingReview ? "#94a3b8" : "#f59e0b",
                color: "#fff",
                cursor: isRequestingReview ? "not-allowed" : "pointer",
              }}
            >
              {isRequestingReview ? "Requesting..." : "Request Review"}
            </button>
          )}
          {project.status === "needs_review" && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              style={{
                ...styles.button,
                backgroundColor: isApproving ? "#94a3b8" : "#22c55e",
                color: "#fff",
                cursor: isApproving ? "not-allowed" : "pointer",
              }}
            >
              {isApproving ? "Approving..." : "Approve"}
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ ...styles.button, backgroundColor: "#10b981", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}
            >
              Export to Excel
              <span style={{ fontSize: "10px" }}>▼</span>
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "4px",
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 100,
                  minWidth: "200px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    exportProjectToExcel(project);
                    setShowExportMenu(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <strong>Full Export</strong>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>All questions with summary</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportCompletedOnly(project);
                    setShowExportMenu(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <strong>Completed Only</strong>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Questions with responses</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportHighConfidenceOnly(project);
                    setShowExportMenu(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <strong>High Confidence</strong>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>High confidence responses only</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportLowConfidenceOnly(project);
                    setShowExportMenu(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <strong>Needs Review</strong>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Low confidence for manual review</div>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/projects/upload")}
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
          {(["all", "high", "medium", "low", "error", "flagged"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                ...styles.button,
                padding: "6px 12px",
                backgroundColor: statusFilter === filter ? "#0ea5e9" : filter === "flagged" && stats.flagged > 0 ? "#fef3c7" : "#f1f5f9",
                color: statusFilter === filter ? "#fff" : filter === "flagged" && stats.flagged > 0 ? "#92400e" : "#0f172a",
                textTransform: "capitalize",
              }}
            >
              {filter === "all" ? `All (${stats.total})` :
               filter === "high" ? `High (${stats.high})` :
               filter === "medium" ? `Medium (${stats.medium})` :
               filter === "low" ? `Low (${stats.low})` :
               filter === "error" ? `Error (${stats.errors})` :
               `🚩 Flagged (${stats.flagged})`}
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
                <div style={{ fontSize: "0.9rem", color: "#475569", display: "flex", alignItems: "center", gap: "8px" }}>
                  Row {row.rowNumber} • {renderStatus(row.status)}
                  {row.flaggedForReview && (
                    <span style={{
                      ...styles.statusPill,
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      🚩 Flagged
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (row.flaggedForReview) {
                      // Unflag the question
                      updateRow(row.id, {
                        flaggedForReview: false,
                        flaggedAt: undefined,
                        flaggedBy: undefined,
                        flagNote: undefined,
                      });
                    } else {
                      // Flag for review
                      const note = prompt("Add a note for the reviewer (optional):");
                      const userName = session?.user?.name || "Anonymous";
                      updateRow(row.id, {
                        flaggedForReview: true,
                        flaggedAt: new Date().toISOString(),
                        flaggedBy: userName,
                        flagNote: note || undefined,
                      });
                    }
                  }}
                  style={{
                    ...styles.button,
                    padding: "4px 10px",
                    fontSize: "0.8rem",
                    backgroundColor: row.flaggedForReview ? "#fee2e2" : "#fef3c7",
                    color: row.flaggedForReview ? "#b91c1c" : "#92400e",
                  }}
                >
                  {row.flaggedForReview ? "Remove Flag" : "🚩 Flag for Review"}
                </button>
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
                  }}>
                    Response
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

                  {/* Transparency section - Collapsible with confidence always visible */}
                  <TransparencyDetails
                    data={{
                      confidence: row.confidence,
                      reasoning: row.reasoning,
                      inference: row.inference,
                      remarks: row.remarks,
                      sources: row.sources,
                    }}
                    defaultExpanded={row.detailsExpanded}
                    onToggle={(expanded) => updateRow(row.id, { detailsExpanded: expanded })}
                    knowledgeReferences={(row.usedSkills || [])
                      .filter((s): s is { id: string; title: string } => typeof s === "object" && s !== null)
                      .map(s => ({ id: s.id, title: s.title, type: "skill" as const }))
                    }
                    renderClarifyButton={!row.conversationOpen ? () => (
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { conversationOpen: true })}
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

              {row.error && (
                <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "8px" }}>{row.error}</p>
              )}

              {/* Skill Recommendations */}
              {row.showRecommendation && row.usedSkills && (
                <SkillRecommendation
                  usedSkills={row.usedSkills}
                  question={row.question}
                  onDismiss={() => updateRow(row.id, { showRecommendation: false })}
                />
              )}

              {/* Clarify - Conversational Interface */}
              {row.response && row.conversationOpen && (
                <div style={{ marginTop: "8px" }}>
                  <ConversationalRefinement
                    originalQuestion={row.question}
                    currentResponse={`${row.response}\n\nConfidence: ${row.confidence || 'N/A'}\nSources: ${row.sources || 'N/A'}\nReasoning: ${row.reasoning || 'N/A'}\nInference: ${row.inference || 'None'}\nRemarks: ${row.remarks || 'N/A'}`}
                    onResponseUpdate={(newResponse) => {
                      const parsed = parseAnswerSections(newResponse);
                      updateRow(row.id, {
                        response: parsed.response,
                        confidence: parsed.confidence,
                        sources: parsed.sources,
                        reasoning: parsed.reasoning,
                        inference: parsed.inference,
                        remarks: parsed.remarks
                      });
                    }}
                    onClose={() => updateRow(row.id, { conversationOpen: false })}
                    promptText={promptText}
                    originalConversationHistory={row.conversationHistory}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Customer Profile Selector Modal */}
      {showCustomerSelector && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCustomerSelector(false)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>Link Customer Profiles</h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px 0" }}>
              Select which customer profiles are associated with this project.
            </p>

            {allCustomerProfiles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                <p>No customer profiles available.</p>
                <Link href="/customers" style={{ color: "#2563eb" }}>
                  Build your first profile →
                </Link>
              </div>
            ) : (
              <CustomerProfileSelector
                profiles={allCustomerProfiles}
                selectedIds={(project.customerProfiles || []).map((cp) => cp.id)}
                onSave={handleSaveCustomerProfiles}
                onCancel={() => setShowCustomerSelector(false)}
                saving={savingCustomers}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Customer Profile Selector Component
function CustomerProfileSelector({
  profiles,
  selectedIds,
  onSave,
  onCancel,
  saving,
}: {
  profiles: CustomerProfile[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  return (
    <div>
      <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
        {profiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => toggle(profile.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              marginBottom: "8px",
              backgroundColor: selected.has(profile.id) ? "#eff6ff" : "#f8fafc",
              borderRadius: "8px",
              border: selected.has(profile.id) ? "1px solid #3b82f6" : "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(profile.id)}
              onChange={() => toggle(profile.id)}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{profile.name}</div>
              {profile.industry && (
                <span style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  backgroundColor: "#f0fdf4",
                  color: "#166534",
                  borderRadius: "4px",
                  fontSize: "11px",
                  marginTop: "4px",
                }}>
                  {profile.industry}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#fff",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(Array.from(selected))}
          disabled={saving}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: saving ? "#94a3b8" : "#3b82f6",
            color: "#fff",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
