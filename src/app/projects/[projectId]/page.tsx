"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmModal";
import { useFlagReview, FlagReviewData, FlagReviewQueueItem } from "@/components/FlagReviewModal";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { QUESTION_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import { BulkProject, BulkRow } from "@/types/bulkProject";
import { fetchProject, updateProject } from "@/lib/projectApi";
import { useDeleteProject } from "@/hooks/use-project-data";
import ConversationalRefinement from "@/components/ConversationalRefinement";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import { parseAnswerSections, selectRelevantSkills, selectRelevantSkillsForBatch } from "@/lib/questionHelpers";
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
import DomainSelector, { Domain } from "@/components/DomainSelector";
import { features } from "@/lib/featureFlags";
import ReviewStatusBanner, { getEffectiveReviewStatus, getReviewerName } from "@/components/ReviewStatusBanner";

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
  const [statusFilter, setStatusFilter] = useState<"all" | "high" | "medium" | "low" | "error" | "flagged" | "pending-review" | "reviewed" | "queued">("all");
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 });
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [allCustomerProfiles, setAllCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [savingCustomers, setSavingCustomers] = useState(false);

  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Project",
    message: "This cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });

  const deleteProjectMutation = useDeleteProject();
  const { openFlagReview, FlagReviewDialog } = useFlagReview();
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [sendingReviewRowId, setSendingReviewRowId] = useState<string | null>(null);
  const [isSendingQueued, setIsSendingQueued] = useState(false);

  // Compute queued items from project rows (database-backed queue)
  const queuedItems = useMemo(() => {
    if (!project) return [];
    return project.rows
      .filter((row) => row.queuedForReview)
      .map((row) => ({
        id: row.id,
        data: {
          action: "need-help" as const,
          sendTiming: "later" as const,
          reviewerId: row.queuedReviewerId,
          reviewerName: row.queuedReviewerName,
          note: row.queuedNote || "",
        },
      }));
  }, [project]);

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
        const message = error instanceof Error ? error.message : "Failed to load project";
        toast.error(message);
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
      } catch {
        // Silent failure for auto-save to avoid annoying the user
      }
    }, 500); // Debounce by 500ms

    return () => clearTimeout(saveTimeout);
  }, [project]);

  // Load skills, reference URLs, and customer profiles on mount
  useEffect(() => {
    loadSkillsFromApi().then(setAvailableSkills).catch(() => toast.error("Failed to load skills"));
    // Load reference URLs from database API
    fetch("/api/reference-urls")
      .then(res => res.json())
      .then(json => {
        // API returns { data: [...] } format
        const data = json.data ?? json.urls ?? json;
        setReferenceUrls(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error("Failed to load reference URLs"));
    // Only load customer profiles if feature is enabled
    if (features.customerProfiles) {
      fetchActiveProfiles()
        .then(profiles => setAllCustomerProfiles(profiles))
        .catch(() => toast.error("Failed to load customer profiles"));
    }
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
      return { total: 0, high: 0, medium: 0, low: 0, errors: 0, flagged: 0, pendingReview: 0, approved: 0, needsGeneration: 0 };
    }
    const total = project.rows.length;
    const high = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('high')).length;
    const medium = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('medium')).length;
    const low = project.rows.filter((row) => row.confidence && row.confidence.toLowerCase().includes('low')).length;
    const errors = project.rows.filter((row) => row.status === "error").length;
    const flagged = project.rows.filter((row) => row.flaggedForReview).length;
    const pendingReview = project.rows.filter((row) => row.reviewStatus === "REQUESTED").length;
    const approved = project.rows.filter((row) => row.reviewStatus === "APPROVED" || row.reviewStatus === "CORRECTED").length;
    const needsGeneration = project.rows.filter((row) => !row.response || row.response.trim() === "").length;
    return { total, high, medium, low, errors, flagged, pendingReview, approved, needsGeneration };
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
    if (statusFilter === "pending-review") {
      return project.rows.filter((row) => row.reviewStatus === "REQUESTED");
    }
    if (statusFilter === "reviewed") {
      return project.rows.filter((row) => row.reviewStatus === "APPROVED" || row.reviewStatus === "CORRECTED");
    }
    if (statusFilter === "queued") {
      return project.rows.filter((row) => row.queuedForReview);
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
          mode: "bulk",
          domains: selectedDomains.length > 0 ? selectedDomains : undefined,
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

    // Fetch rate limit settings from database
    let rateLimitSettings = {
      batchSize: 5,
      batchDelayMs: 15000,
      rateLimitRetryWaitMs: 60000,
      rateLimitMaxRetries: 3,
    };
    try {
      const settingsRes = await fetch("/api/app-settings/rate-limits");
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        rateLimitSettings = {
          batchSize: settings.batchSize || 5,
          batchDelayMs: settings.batchDelayMs || 15000,
          rateLimitRetryWaitMs: settings.rateLimitRetryWaitMs || 60000,
          rateLimitMaxRetries: settings.rateLimitMaxRetries || 3,
        };
      }
    } catch {
      console.warn("Failed to load rate limit settings, using defaults");
    }

    const total = project.rows.length;
    setGenerateProgress({ current: 0, total });

    // Prepare fallback content if no skills available
    let fallbackContent: { title: string; url: string; content: string }[] | undefined;
    if (availableSkills.length === 0) {
      const fallbackItems: { title: string; url: string; content: string }[] = [];

      // Fetch reference URLs
      if (referenceUrls.length > 0) {
        try {
          const fetched = await fetchMultipleUrls(referenceUrls);
          fetched
            .filter((f) => !f.error && f.content.trim().length > 0)
            .forEach((f) => fallbackItems.push({ title: f.title, url: f.url, content: f.content }));
        } catch (e) {
          console.warn("Failed to fetch reference URLs:", e);
        }
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

    // Process in batches - size and delay configurable via Admin > Settings > Rate Limits
    const batches: typeof project.rows[] = [];

    for (let i = 0; i < project.rows.length; i += rateLimitSettings.batchSize) {
      batches.push(project.rows.slice(i, i + rateLimitSettings.batchSize));
    }

    let completed = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Add delay between batches to respect rate limits (skip first batch)
      if (batchIndex > 0) {
        await new Promise((resolve) => setTimeout(resolve, rateLimitSettings.batchDelayMs));
      }
      // Mark all rows in batch as generating
      for (const row of batch) {
        if (row.id) {
          updateRow(row.id, { status: "generating", error: undefined });
        }
      }

      // Format questions for batch API
      const questions = batch
        .filter((row) => row.id && row.question.trim())
        .map((row) => ({
          index: row.rowNumber,
          question: row.question.trim(),
        }));

      if (questions.length === 0) {
        completed += batch.length;
        setGenerateProgress({ current: completed, total });
        continue;
      }

      // Select only relevant skills for this batch (reduces token usage significantly)
      const batchQuestionTexts = questions.map((q) => q.question);
      const relevantSkills = selectRelevantSkillsForBatch(batchQuestionTexts, availableSkills, 10);
      const skillsPayload = relevantSkills.map((skill) => ({
        title: skill.title,
        content: skill.content,
      }));

      try {
        // Single API call for entire batch with retry logic for rate limits
        type BatchAnswer = {
          questionIndex: number;
          response: string;
          confidence: string;
          sources: string;
          reasoning: string;
          inference: string;
          remarks: string;
        };
        let response: Response | null = null;
        let data: { answers?: BatchAnswer[]; usedFallback?: boolean; error?: string } | null = null;
        let retries = 0;

        while (retries <= rateLimitSettings.rateLimitMaxRetries) {
          response = await fetch("/api/questions/answer-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questions,
              skills: skillsPayload.length > 0 ? skillsPayload : undefined,
              fallbackContent,
              prompt: promptText,
              mode: "bulk",
              domains: selectedDomains.length > 0 ? selectedDomains : undefined,
            }),
          });

          data = await response.json().catch(() => null);

          // Check for rate limit error
          if (response.status === 429 || (data?.error && data.error.includes("rate_limit"))) {
            retries++;
            if (retries <= rateLimitSettings.rateLimitMaxRetries) {
              // Show user we're waiting
              const waitSecs = Math.round(rateLimitSettings.rateLimitRetryWaitMs / 1000);
              for (const row of batch) {
                if (row.id) {
                  updateRow(row.id, { status: "generating", error: `Rate limited. Waiting ${waitSecs}s... (retry ${retries}/${rateLimitSettings.rateLimitMaxRetries})` });
                }
              }
              await new Promise((resolve) => setTimeout(resolve, rateLimitSettings.rateLimitRetryWaitMs));
              continue;
            }
          }
          break; // Success or non-rate-limit error
        }

        if (!response || !response.ok || !data?.answers) {
          // Mark all rows in batch as error
          const errorMsg = data?.error || "Failed to generate responses.";
          for (const row of batch) {
            if (row.id) {
              updateRow(row.id, { status: "error", error: errorMsg });
            }
          }
        } else {
          // Update each row with its corresponding answer
          for (const answer of data.answers) {
            const row = batch.find((r) => r.rowNumber === answer.questionIndex);
            if (row?.id) {
              updateRow(row.id, {
                response: answer.response,
                confidence: answer.confidence,
                sources: answer.sources,
                reasoning: answer.reasoning,
                inference: answer.inference,
                remarks: answer.remarks,
                usedSkills: relevantSkills, // Only the skills actually sent with this batch
                usedFallback: data.usedFallback || false,
                showRecommendation: true,
                status: "completed",
                error: undefined,
              });
            }
          }

          // Mark any rows that didn't get an answer as error
          for (const row of batch) {
            if (!row.id) continue;
            const hasAnswer = data.answers.some((a) => a.questionIndex === row.rowNumber);
            if (!hasAnswer) {
              updateRow(row.id, { status: "error", error: "No answer returned for this question." });
            }
          }
        }
      } catch (error) {
        // Mark all rows in batch as error
        const message = error instanceof Error ? error.message : "Unexpected error.";
        for (const row of batch) {
          if (row.id) {
            updateRow(row.id, { status: "error", error: message });
          }
        }
      }

      completed += batch.length;
      setGenerateProgress({ current: completed, total });
    }

    setIsGeneratingAll(false);
    setGenerateProgress({ current: 0, total: 0 });
  };

  const clearProject = async () => {
    if (!project) return;
    const confirmed = await confirmDelete({
      message: `Delete "${project.name}"? This cannot be undone.`,
    });
    if (!confirmed) return;

    try {
      await deleteProjectMutation.mutateAsync(project.id);
      router.push("/projects");
    } catch {
      toast.error("Failed to delete project. Please try again.");
    }
  };

  const handleRequestReview = async () => {
    if (!project) return;

    // Use session user's name or email for attribution
    const requesterName = session?.user?.name || session?.user?.email || "Unknown User";

    setIsRequestingReview(true);
    try {
      // First, send any queued review requests (from database-backed queue)
      if (queuedItems.length > 0) {
        const itemsToProcess = [...queuedItems];
        for (const item of itemsToProcess) {
          try {
            await processFlagReview(item.id, item.data);
          } catch {
            // Individual item failures are handled in processFlagReview
          }
        }
      }

      const updatedProject = {
        ...project,
        status: "needs_review" as const,
        reviewRequestedAt: new Date().toISOString(),
        reviewRequestedBy: requesterName,
      };
      await updateProject(updatedProject);
      setProject(updatedProject);

      // Send Slack notification with proper error handling
      const projectUrl = `${window.location.origin}/projects/${project.id}`;
      try {
        const slackResponse = await fetch("/api/slack/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName: project.name,
            projectUrl,
            customerName: project.customerName,
            requesterName,
          }),
        });

        if (slackResponse.ok) {
          toast.success("Review requested! A notification has been sent.");
        } else {
          // Slack failed but project was updated
          toast.success("Review requested!");
          console.warn("Slack notification failed:", await slackResponse.text());
        }
      } catch (slackError) {
        // Slack failed but project was updated - don't fail the whole operation
        toast.success("Review requested!");
        console.warn("Slack notification failed:", slackError);
      }
    } catch {
      toast.error("Failed to request review. Please try again.");
    } finally {
      setIsRequestingReview(false);
    }
  };

  const handleApprove = async () => {
    if (!project) return;

    // Use session user's name or email for attribution
    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";

    setIsApproving(true);
    try {
      const updatedProject = {
        ...project,
        status: "approved" as const,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName,
      };
      await updateProject(updatedProject);
      setProject(updatedProject);
      toast.success("Project approved!");
    } catch {
      toast.error("Failed to approve project. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Flag or Need Help action for a row
  const handleFlagOrReview = async (rowId: string, initialAction: "flag" | "need-help" = "need-help") => {
    if (!project) return;
    const row = project.rows.find((r) => r.id === rowId);
    if (!row) return;

    // Open the unified modal
    const data = await openFlagReview(initialAction);
    if (!data) return; // Cancelled

    if (data.sendTiming === "later") {
      // Queue for later - save to database for persistence across sessions
      try {
        const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queuedForReview: true,
            queuedNote: data.note || null,
            queuedReviewerId: data.reviewerId || null,
            queuedReviewerName: data.reviewerName || null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to queue for review");
        }

        // Update local state to show it's queued
        updateRow(rowId, {
          queuedForReview: true,
          queuedAt: new Date().toISOString(),
          queuedBy: session?.user?.name || session?.user?.email || "Unknown User",
          queuedNote: data.note || undefined,
          queuedReviewerId: data.reviewerId,
          queuedReviewerName: data.reviewerName,
        });

        toast.success(`Queued for review (${queuedItems.length + 1} in queue)`);
      } catch {
        toast.error("Failed to queue. Please try again.");
      }
      return;
    }

    // Send now
    await processFlagReview(rowId, data);
  };

  // Process a single flag/review request
  const processFlagReview = async (rowId: string, data: FlagReviewData) => {
    if (!project) return;
    const userName = session?.user?.name || session?.user?.email || "Unknown User";

    setSendingReviewRowId(rowId);
    try {
      if (data.action === "flag") {
        // Just flag locally (no API call needed for simple flag)
        const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flaggedForReview: true,
            flagNote: data.note || null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to flag answer");
        }

        updateRow(rowId, {
          flaggedForReview: true,
          flaggedAt: new Date().toISOString(),
          flaggedBy: userName,
          flagNote: data.note || undefined,
        });

        toast.success("Answer flagged!");
      } else {
        // Need help - send for review
        const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewNote: data.note || undefined,
            assignedReviewerId: data.reviewerId,
            assignedReviewerName: data.reviewerName,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send for review");
        }

        const responseData = await response.json();

        updateRow(rowId, {
          reviewStatus: "REQUESTED",
          flaggedForReview: true,
          flaggedAt: new Date().toISOString(),
          flaggedBy: userName,
          flagNote: data.note || undefined,
          assignedReviewerId: data.reviewerId,
          assignedReviewerName: data.reviewerName,
          // Clear queue status since it's now sent
          queuedForReview: false,
          queuedAt: undefined,
          queuedBy: undefined,
          queuedNote: undefined,
          queuedReviewerId: undefined,
          queuedReviewerName: undefined,
        });

        const reviewerMsg = data.reviewerName ? ` to ${data.reviewerName}` : "";
        if (responseData.slackSent) {
          toast.success(`Review requested${reviewerMsg}! Slack notification sent.`);
        } else {
          toast.success(`Review requested${reviewerMsg}!`);
        }
      }
    } catch {
      toast.error("Failed to process. Please try again.");
    } finally {
      setSendingReviewRowId(null);
    }
  };

  // Send all queued items (from database-backed queue)
  const handleSendAllQueued = async () => {
    if (queuedItems.length === 0) return;

    setIsSendingQueued(true);
    // Take a snapshot of items to process
    const itemsToProcess = [...queuedItems];
    let successCount = 0;
    let failCount = 0;

    for (const item of itemsToProcess) {
      try {
        await processFlagReview(item.id, item.data);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsSendingQueued(false);

    if (failCount === 0) {
      toast.success(`Sent ${successCount} review requests!`);
    } else {
      toast.error(`Sent ${successCount}, failed ${failCount}`);
    }
  };

  // Clear all queued items (remove from queue without sending)
  const handleClearQueue = async () => {
    if (queuedItems.length === 0) return;

    // Clear each item's queue status in the database
    for (const item of queuedItems) {
      try {
        await fetch(`/api/projects/${project?.id}/rows/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queuedForReview: false,
          }),
        });

        updateRow(item.id, {
          queuedForReview: false,
          queuedAt: undefined,
          queuedBy: undefined,
          queuedNote: undefined,
          queuedReviewerId: undefined,
          queuedReviewerName: undefined,
        });
      } catch {
        // Silent failure for queue clearing - not critical
      }
    }

    toast.success("Queue cleared");
  };

  // Unflag a row
  const handleUnflag = async (rowId: string) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
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

      updateRow(rowId, {
        flaggedForReview: false,
        flaggedAt: undefined,
        flaggedBy: undefined,
        flagNote: undefined,
        reviewStatus: "NONE",
      });

      toast.success("Flag removed");
    } catch {
      toast.error("Failed to remove flag");
    }
  };

  // Mark a row as approved
  const handleApproveRow = async (rowId: string) => {
    if (!project) return;

    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";

    try {
      const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "APPROVED",
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve row");
      }

      updateRow(rowId, {
        reviewStatus: "APPROVED",
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName,
      });

      toast.success("Answer approved!");
    } catch {
      toast.error("Failed to approve. Please try again.");
    }
  };

  // Mark a row as corrected (with the current edited response)
  const handleCorrectRow = async (rowId: string) => {
    if (!project) return;
    const row = project.rows.find((r) => r.id === rowId);
    if (!row) return;

    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";

    try {
      const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "CORRECTED",
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
          userEditedAnswer: row.response, // Save the current (edited) response
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark as corrected");
      }

      updateRow(rowId, {
        reviewStatus: "CORRECTED",
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName,
        userEditedAnswer: row.response,
      });

      toast.success("Answer marked as corrected!");
    } catch {
      toast.error("Failed to save correction. Please try again.");
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
    } catch {
      toast.error("Failed to save customer profiles. Please try again.");
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
      <ConfirmDialog />
      <FlagReviewDialog />
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
                {project.customerProfiles.map((cp) => (
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
          {/* Send All Queued - show only if there are queued items */}
          {queuedItems.length > 0 && (
            <button
              type="button"
              onClick={handleSendAllQueued}
              disabled={isSendingQueued}
              style={{
                ...styles.button,
                backgroundColor: isSendingQueued ? "#94a3b8" : "#8b5cf6",
                color: "#fff",
                cursor: isSendingQueued ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isSendingQueued ? "Sending..." : `📤 Send All Queued (${queuedItems.length})`}
            </button>
          )}
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
              {isRequestingReview
                ? "Submitting..."
                : queuedItems.length > 0
                  ? `✅ Finish & Submit (${queuedItems.length} queued)`
                  : "✅ Finish & Submit"}
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
            🗑️ Delete Project
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <strong>Filter:</strong>
          {(["all", "high", "medium", "low", "error", "flagged", "pending-review", "reviewed", "queued"] as const).map((filter) => {
            const getFilterStyle = () => {
              if (statusFilter === filter) return { backgroundColor: "#0ea5e9", color: "#fff" };
              if (filter === "pending-review" && stats.pendingReview > 0) return { backgroundColor: "#fef3c7", color: "#92400e" };
              if (filter === "reviewed" && stats.approved > 0) return { backgroundColor: "#dcfce7", color: "#166534" };
              if (filter === "flagged" && stats.flagged > 0) return { backgroundColor: "#fef3c7", color: "#92400e" };
              if (filter === "queued" && queuedItems.length > 0) return { backgroundColor: "#ede9fe", color: "#6d28d9" };
              return { backgroundColor: "#f1f5f9", color: "#0f172a" };
            };
            const getFilterLabel = () => {
              switch (filter) {
                case "all": return `All (${stats.total})`;
                case "high": return `High (${stats.high})`;
                case "medium": return `Medium (${stats.medium})`;
                case "low": return `Low (${stats.low})`;
                case "error": return `Error (${stats.errors})`;
                case "flagged": return `🚩 Flagged (${stats.flagged})`;
                case "pending-review": return `📝 Pending Review (${stats.pendingReview})`;
                case "reviewed": return `✓ Reviewed (${stats.approved})`;
                case "queued": return `📋 Queued (${queuedItems.length})`;
              }
            };
            // Hide queued filter if no items are queued
            if (filter === "queued" && queuedItems.length === 0) return null;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  ...styles.button,
                  padding: "6px 12px",
                  ...getFilterStyle(),
                }}
              >
                {getFilterLabel()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Only show generate section if there are rows that need responses */}
      {stats.needsGeneration > 0 && (
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
              {isGeneratingAll ? "Generating..." : `Generate all responses (${stats.needsGeneration})`}
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

          <DomainSelector
            selectedDomains={selectedDomains}
            onChange={setSelectedDomains}
            disabled={isGeneratingAll}
            style={{ marginTop: "12px" }}
          />
        </div>
      )}

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: promptCollapsed ? "0" : "12px" }}>
          <div>
            <label style={{ ...styles.label, marginTop: 0, marginBottom: "4px" }} htmlFor="promptText">
              System Prompt
            </label>
            <a href="/admin/prompt-blocks" style={{ color: "#2563eb", fontSize: "0.85rem" }}>
              Need to edit the prompt? Visit Prompt Builder →
            </a>
          </div>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px" }}>
                <div style={{ fontSize: "0.9rem", color: "#475569", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  Row {row.rowNumber} • {renderStatus(row.status)}
                  {/* Queued Badge - show if this row is in the queue */}
                  {row.queuedForReview && (
                    <span style={{
                      ...styles.statusPill,
                      backgroundColor: "#8b5cf6",
                      color: "#fff",
                    }}>
                      📋 Queued
                    </span>
                  )}
                  {/* Review Status Badge */}
                  {row.reviewStatus === "REQUESTED" && (
                    <span style={{
                      ...styles.statusPill,
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                    }}>
                      📝 Review Requested
                    </span>
                  )}
                  {row.reviewStatus === "APPROVED" && (
                    <span style={{
                      ...styles.statusPill,
                      backgroundColor: "#dcfce7",
                      color: "#166534",
                    }}>
                      ✓ Approved
                    </span>
                  )}
                  {row.reviewStatus === "CORRECTED" && (
                    <span style={{
                      ...styles.statusPill,
                      backgroundColor: "#dbeafe",
                      color: "#1e40af",
                    }}>
                      ✎ Corrected
                    </span>
                  )}
                  {/* Show reviewer info if reviewed */}
                  {row.reviewedBy && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      by {row.reviewedBy}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {/* Flag / Need Help buttons - only show if response exists and not already reviewed */}
                  {row.response && (!row.reviewStatus || row.reviewStatus === "NONE") && !row.flaggedForReview && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFlagOrReview(row.id, "flag")}
                        disabled={sendingReviewRowId === row.id}
                        style={{
                          ...styles.button,
                          padding: "4px 10px",
                          fontSize: "0.8rem",
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          cursor: sendingReviewRowId === row.id ? "not-allowed" : "pointer",
                        }}
                      >
                        🚩 Flag
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlagOrReview(row.id, "need-help")}
                        disabled={sendingReviewRowId === row.id}
                        style={{
                          ...styles.button,
                          padding: "4px 10px",
                          fontSize: "0.8rem",
                          backgroundColor: sendingReviewRowId === row.id ? "#94a3b8" : "#0ea5e9",
                          color: "#fff",
                          cursor: sendingReviewRowId === row.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {sendingReviewRowId === row.id ? "Sending..." : "🤚 Need Help?"}
                      </button>
                    </>
                  )}
                  {/* Unflag button - show if flagged but not in review */}
                  {row.flaggedForReview && row.reviewStatus !== "REQUESTED" && (
                    <button
                      type="button"
                      onClick={() => handleUnflag(row.id)}
                      style={{
                        ...styles.button,
                        padding: "4px 10px",
                        fontSize: "0.8rem",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                      }}
                    >
                      ✕ Unflag
                    </button>
                  )}
                  {/* Approve/Correct buttons - only show if review requested */}
                  {row.reviewStatus === "REQUESTED" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApproveRow(row.id)}
                        style={{
                          ...styles.button,
                          padding: "4px 10px",
                          fontSize: "0.8rem",
                          backgroundColor: "#22c55e",
                          color: "#fff",
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCorrectRow(row.id)}
                        style={{
                          ...styles.button,
                          padding: "4px 10px",
                          fontSize: "0.8rem",
                          backgroundColor: "#3b82f6",
                          color: "#fff",
                        }}
                        title="Mark current answer as corrected (save your edits)"
                      >
                        ✎ Mark Corrected
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Review Note - show if present */}
              {row.flagNote && (
                <div style={{
                  fontSize: "0.85rem",
                  color: "#64748b",
                  backgroundColor: "#fefce8",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  marginBottom: "8px",
                  border: "1px solid #fef08a",
                }}>
                  <strong>Review note:</strong> {row.flagNote}
                </div>
              )}

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
                  {/* Review Status Banner - Row-level or Project-level */}
                  <ReviewStatusBanner
                    status={getEffectiveReviewStatus(row.reviewStatus, project.status)}
                    reviewedBy={getReviewerName(row.reviewStatus, row.reviewedBy, project.reviewedBy)}
                  />
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

      {/* Floating Queue Indicator */}
      {queuedItems.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#8b5cf6",
            color: "#fff",
            borderRadius: "12px",
            padding: "16px 20px",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            zIndex: 1000,
            animation: "pulse 2s infinite",
          }}
        >
          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.02); }
            }
          `}</style>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
              📋 {queuedItems.length} review{queuedItems.length === 1 ? "" : "s"} queued
            </div>
            <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>
              Send when ready or finish your review first
            </div>
          </div>
          <button
            type="button"
            onClick={handleSendAllQueued}
            disabled={isSendingQueued}
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              color: "#8b5cf6",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: isSendingQueued ? "not-allowed" : "pointer",
              opacity: isSendingQueued ? 0.7 : 1,
            }}
          >
            {isSendingQueued ? "Sending..." : "Send All"}
          </button>
          <button
            type="button"
            onClick={handleClearQueue}
            style={{
              padding: "4px 8px",
              backgroundColor: "transparent",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              opacity: 0.7,
              fontSize: "1.2rem",
            }}
            title="Clear queue"
          >
            ✕
          </button>
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
