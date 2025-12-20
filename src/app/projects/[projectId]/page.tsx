"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmModal";
import { useFlagReview, FlagReviewData } from "@/components/FlagReviewModal";
import { defaultQuestionPrompt } from "@/lib/questionPrompt";
import { useStoredPrompt } from "@/hooks/useStoredPrompt";
import { QUESTION_PROMPT_STORAGE_KEY } from "@/lib/promptStorage";
import { BulkProject, BulkRow } from "@/types/bulkProject";
import { fetchProject, updateProject } from "@/lib/projectApi";
import { useDeleteProject } from "@/hooks/use-project-data";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import { selectRelevantSkillsForBatch } from "@/lib/questionHelpers";
import { ReferenceUrl } from "@/types/referenceUrl";
import { fetchMultipleUrls } from "@/lib/urlFetcher";
import SkillUpdateBanner from "@/components/SkillUpdateBanner";
import DomainSelector, { Domain } from "@/components/DomainSelector";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
import { CustomerProfile } from "@/types/customerProfile";
import { features } from "@/lib/featureFlags";
import UserSelector, { SelectableUser } from "@/components/UserSelector";
import { SpeedToggle } from "@/components/speed-toggle";
import { parseApiData } from "@/lib/apiClient";
import { InlineError } from "@/components/ui/status-display";

import {
  RowCard,
  ProjectHeader,
  FilterBar,
  StatusFilter,
  QueueIndicator,
  CustomerProfileSelector,
} from "./components";

const styles = {
  container: {
    maxWidth: "1400px",
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 });
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [allCustomerProfiles, setAllCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [savingCustomers, setSavingCustomers] = useState(false);
  const [showOwnerSelector, setShowOwnerSelector] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);

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
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  const [quickMode, setQuickMode] = useState(false);

  // Track processing state for beforeunload warning
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = isGeneratingAll;
  }, [isGeneratingAll]);

  // Warn user if they try to leave while generating
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessingRef.current) {
        e.preventDefault();
        e.returnValue = "Generation is in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Compute queued items from project rows
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
        // Silent failure for auto-save
      }
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [project]);

  // Load skills, reference URLs, and customer profiles on mount
  useEffect(() => {
    loadSkillsFromApi().then(setAvailableSkills).catch(() => toast.error("Failed to load skills"));
    fetch("/api/reference-urls")
      .then(res => res.json())
      .then(json => {
        const data = parseApiData<ReferenceUrl[]>(json);
        setReferenceUrls(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error("Failed to load reference URLs"));
    if (features.customerProfiles) {
      fetchActiveProfiles()
        .then(profiles => setAllCustomerProfiles(profiles))
        .catch(() => toast.error("Failed to load customer profiles"));
    }
  }, []);

  // Handle filter query param from URL
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
    if (statusFilter === "error") return project.rows.filter((row) => row.status === "error");
    if (statusFilter === "flagged") return project.rows.filter((row) => row.flaggedForReview);
    if (statusFilter === "pending-review") return project.rows.filter((row) => row.reviewStatus === "REQUESTED");
    if (statusFilter === "reviewed") return project.rows.filter((row) => row.reviewStatus === "APPROVED" || row.reviewStatus === "CORRECTED");
    if (statusFilter === "queued") return project.rows.filter((row) => row.queuedForReview);
    return project.rows.filter((row) => row.confidence?.toLowerCase().includes(statusFilter));
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

  const handleGenerateAll = async () => {
    if (!project || project.rows.length === 0) {
      setErrorMessage("No project rows available. Upload a file first.");
      return;
    }

    setIsGeneratingAll(true);
    setErrorMessage(null);

    // Fetch rate limit settings
    let rateLimitSettings = {
      batchSize: 5,
      batchDelayMs: 15000,
      rateLimitRetryWaitMs: 60000,
      rateLimitMaxRetries: 3,
    };
    try {
      const settingsRes = await fetch("/api/app-settings/rate-limits");
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const settings = parseApiData<typeof rateLimitSettings>(settingsJson, "settings");
        rateLimitSettings = {
          batchSize: settings.batchSize || 5,
          batchDelayMs: settings.batchDelayMs || 15000,
          rateLimitRetryWaitMs: settings.rateLimitRetryWaitMs || 60000,
          rateLimitMaxRetries: settings.rateLimitMaxRetries || 3,
        };
      }
    } catch {
      // Use defaults on failure
    }

    const total = project.rows.length;
    setGenerateProgress({ current: 0, total });

    // Prepare fallback content if no skills available
    let fallbackContent: { title: string; url: string; content: string }[] | undefined;
    if (availableSkills.length === 0) {
      const fallbackItems: { title: string; url: string; content: string }[] = [];
      if (referenceUrls.length > 0) {
        try {
          const fetched = await fetchMultipleUrls(referenceUrls);
          fetched
            .filter((f) => !f.error && f.content.trim().length > 0)
            .forEach((f) => fallbackItems.push({ title: f.title, url: f.url, content: f.content }));
        } catch {
          // Continue without reference URLs
        }
      }
      try {
        const docsResponse = await fetch("/api/documents/content");
        if (docsResponse.ok) {
          const docsJson = await docsResponse.json();
          const docsData = parseApiData<{ documents: { title: string; filename: string; content: string }[] }>(docsJson);
          if (docsData.documents && Array.isArray(docsData.documents)) {
            docsData.documents.forEach((doc) => {
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
      } catch {
        // Continue without documents
      }
      if (fallbackItems.length > 0) {
        fallbackContent = fallbackItems;
      }
    }

    // Process in batches
    const batches: typeof project.rows[] = [];
    for (let i = 0; i < project.rows.length; i += rateLimitSettings.batchSize) {
      batches.push(project.rows.slice(i, i + rateLimitSettings.batchSize));
    }

    let completed = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      if (batchIndex > 0) {
        await new Promise((resolve) => setTimeout(resolve, rateLimitSettings.batchDelayMs));
      }

      for (const row of batch) {
        if (row.id) updateRow(row.id, { status: "generating", error: undefined });
      }

      const questions = batch
        .filter((row) => row.id && row.question.trim())
        .map((row) => ({ index: row.rowNumber, question: row.question.trim() }));

      if (questions.length === 0) {
        completed += batch.length;
        setGenerateProgress({ current: completed, total });
        continue;
      }

      const batchQuestionTexts = questions.map((q) => q.question);
      const relevantSkills = selectRelevantSkillsForBatch(batchQuestionTexts, availableSkills, 10);
      const skillsPayload = relevantSkills.map((skill) => ({ title: skill.title, content: skill.content }));

      try {
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
              quickMode,
            }),
          });

          const json = await response.json().catch(() => null);
          data = json ? parseApiData<{ answers?: BatchAnswer[]; usedFallback?: boolean; error?: string }>(json) : null;

          if (response.status === 429 || (data?.error && data.error.includes("rate_limit"))) {
            retries++;
            if (retries <= rateLimitSettings.rateLimitMaxRetries) {
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
          break;
        }

        if (!response || !response.ok || !data?.answers) {
          const errorMsg = data?.error || "Failed to generate responses.";
          for (const row of batch) {
            if (row.id) updateRow(row.id, { status: "error", error: errorMsg });
          }
        } else {
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
                usedSkills: relevantSkills,
                usedFallback: data.usedFallback || false,
                showRecommendation: true,
                status: "completed",
                error: undefined,
              });
            }
          }
          for (const row of batch) {
            if (!row.id) continue;
            const hasAnswer = data.answers.some((a) => a.questionIndex === row.rowNumber);
            if (!hasAnswer) {
              updateRow(row.id, { status: "error", error: "No answer returned for this question." });
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";
        for (const row of batch) {
          if (row.id) updateRow(row.id, { status: "error", error: message });
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
    const requesterName = session?.user?.name || session?.user?.email || "Unknown User";

    setIsRequestingReview(true);
    try {
      if (queuedItems.length > 0) {
        for (const item of queuedItems) {
          try {
            await processFlagReview(item.id, item.data);
          } catch {
            // Individual failures handled in processFlagReview
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
          toast.success("Review requested!");
          // Slack notification failed silently - review was still saved
        }
      } catch {
        toast.success("Review requested!");
        // Slack notification failed silently - review was still saved
      }
    } catch {
      toast.error("Failed to request review. Please try again.");
    } finally {
      setIsRequestingReview(false);
    }
  };

  const handleApprove = async () => {
    if (!project) return;
    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";

    setIsApproving(true);
    try {
      const updatedProject = {
        ...project,
        status: "finalized" as const,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName,
      };
      await updateProject(updatedProject);
      setProject(updatedProject);
      toast.success("Project finalized!");
    } catch {
      toast.error("Failed to approve project. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleFlagOrReview = async (rowId: string, initialAction: "flag" | "need-help" = "need-help") => {
    if (!project) return;
    const row = project.rows.find((r) => r.id === rowId);
    if (!row) return;

    const data = await openFlagReview(initialAction);
    if (!data) return;

    if (data.sendTiming === "later") {
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

        if (!response.ok) throw new Error("Failed to queue for review");

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

    await processFlagReview(rowId, data);
  };

  const processFlagReview = async (rowId: string, data: FlagReviewData) => {
    if (!project) return;
    const userName = session?.user?.name || session?.user?.email || "Unknown User";

    setSendingReviewRowId(rowId);
    try {
      if (data.action === "flag") {
        const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flaggedForReview: true,
            flagNote: data.note || null,
          }),
        });

        if (!response.ok) throw new Error("Failed to flag answer");

        updateRow(rowId, {
          flaggedForReview: true,
          flaggedAt: new Date().toISOString(),
          flaggedBy: userName,
          flagNote: data.note || undefined,
        });

        toast.success("Answer flagged!");
      } else {
        const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewNote: data.note || undefined,
            assignedReviewerId: data.reviewerId,
            assignedReviewerName: data.reviewerName,
          }),
        });

        if (!response.ok) throw new Error("Failed to send for review");

        const responseData = await response.json();

        updateRow(rowId, {
          reviewStatus: "REQUESTED",
          flaggedForReview: true,
          flaggedAt: new Date().toISOString(),
          flaggedBy: userName,
          flagNote: data.note || undefined,
          assignedReviewerId: data.reviewerId,
          assignedReviewerName: data.reviewerName,
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

  const handleSendAllQueued = async () => {
    if (queuedItems.length === 0) return;

    setIsSendingQueued(true);
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

  const handleClearQueue = async () => {
    if (queuedItems.length === 0) return;

    for (const item of queuedItems) {
      try {
        await fetch(`/api/projects/${project?.id}/rows/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queuedForReview: false }),
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
        // Silent failure for queue clearing
      }
    }

    toast.success("Queue cleared");
  };

  const handleResolveFlag = async (rowId: string, resolutionNote?: string) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagResolved: true,
          flagResolutionNote: resolutionNote || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to resolve flag");

      const data = await response.json();
      const row = data.data?.row || data.row;

      updateRow(rowId, {
        flagResolved: true,
        flagResolvedAt: row?.flagResolvedAt,
        flagResolvedBy: row?.flagResolvedBy,
        flagResolutionNote: resolutionNote || undefined,
      });

      toast.success("Flag resolved");
    } catch {
      toast.error("Failed to resolve flag");
    }
  };

  const handleReopenFlag = async (rowId: string) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${project.id}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagResolved: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to reopen flag");

      updateRow(rowId, {
        flagResolved: false,
        flagResolvedAt: undefined,
        flagResolvedBy: undefined,
        flagResolutionNote: undefined,
      });

      toast.success("Flag reopened");
    } catch {
      toast.error("Failed to reopen flag");
    }
  };

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

      if (!response.ok) throw new Error("Failed to approve row");

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
          userEditedAnswer: row.response,
        }),
      });

      if (!response.ok) throw new Error("Failed to mark as corrected");

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
      // Use the first selected ID as the primary customer (single select)
      const customerId = selectedIds.length > 0 ? selectedIds[0] : null;

      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });

      if (!response.ok) throw new Error("Failed to save customer");

      const json = await response.json();
      const data = parseApiData<{ project: BulkProject }>(json);
      setProject(data.project);
      setShowCustomerSelector(false);
      toast.success("Customer updated!");
    } catch {
      toast.error("Failed to save customer. Please try again.");
    } finally {
      setSavingCustomers(false);
    }
  };

  const handleSaveOwner = async (user: SelectableUser) => {
    if (!project) return;

    setSavingOwner(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: user.id,
          ownerName: user.name || user.email || "Unknown",
        }),
      });

      if (!response.ok) throw new Error("Failed to update owner");

      const json = await response.json();
      const data = parseApiData<{ project: BulkProject }>(json);
      setProject(data.project);
      setShowOwnerSelector(false);
      toast.success(`Owner changed to ${user.name || user.email}`);
    } catch {
      toast.error("Failed to update owner. Please try again.");
    } finally {
      setSavingOwner(false);
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
        <Link href="/projects" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
          ← Back to Projects
        </Link>
      </div>
      <h1>Answer Goblin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Bulk Workspace)</span></h1>
      <p style={{ color: "#475569" }}>
        Generate answers, review them, and challenge questionable responses to improve future skills.
      </p>

      {errorMessage && <InlineError message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

      <SkillUpdateBanner skills={availableSkills} />

      <ProjectHeader
        project={project}
        stats={stats}
        queuedCount={queuedItems.length}
        isRequestingReview={isRequestingReview}
        isApproving={isApproving}
        isSendingQueued={isSendingQueued}
        onRequestReview={handleRequestReview}
        onApprove={handleApprove}
        onSendAllQueued={handleSendAllQueued}
        onDeleteProject={clearProject}
        onEditCustomers={() => setShowCustomerSelector(true)}
        onEditOwner={() => setShowOwnerSelector(true)}
      />

      {/* Customer Profile Info Section */}
      {project.customer && (
        <div style={{
          ...styles.card,
          backgroundColor: "#fafaf9",
          borderColor: "#e7e5e4",
          marginBottom: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{
              backgroundColor: "#e0e7ff",
              color: "#4338ca",
              padding: "8px",
              borderRadius: "6px",
              fontSize: "1.2rem",
            }}>
              🏢
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                  {project.customer.name}
                </h3>
                {project.customer.industry && (
                  <span style={{
                    fontSize: "0.75rem",
                    padding: "2px 6px",
                    backgroundColor: "#dbeafe",
                    color: "#1e40af",
                    borderRadius: "3px",
                  }}>
                    {project.customer.industry}
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Customer profile linked to this RFP • Profile content available for reference
              </p>
            </div>
            <a
              href={`/customers/${project.customer.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 12px",
                fontSize: "0.85rem",
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                color: "#475569",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              View Profile →
            </a>
          </div>
        </div>
      )}

      <FilterBar
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        stats={stats}
        queuedCount={queuedItems.length}
      />

      {/* Finalized notice */}
      {project.status === "finalized" && (
        <div style={{
          ...styles.card,
          backgroundColor: "#f0fdf4",
          borderColor: "#86efac",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <span style={{ fontSize: "1.5rem" }}>🔒</span>
          <div>
            <div style={{ fontWeight: 600, color: "#166534" }}>Project Finalized</div>
            <div style={{ color: "#15803d", fontSize: "0.9rem" }}>
              This project has been finalized and is now read-only. Export the results using the dropdown above.
            </div>
          </div>
        </div>
      )}

      {/* Generate section - only show when not finalized */}
      {project.status !== "finalized" && stats.needsGeneration > 0 && (
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

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", gap: "16px" }}>
            <DomainSelector
              selectedDomains={selectedDomains}
              onChange={setSelectedDomains}
              disabled={isGeneratingAll}
            />
            <SpeedToggle
              quickMode={quickMode}
              onChange={setQuickMode}
              disabled={isGeneratingAll}
            />
          </div>
        </div>
      )}

      {/* Prompt section - hide when finalized */}
      {project.status !== "finalized" && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: promptCollapsed ? "0" : "12px" }}>
            <div>
              <label style={{ ...styles.label, marginTop: 0, marginBottom: "4px" }} htmlFor="promptText">
                System Prompt
              </label>
              <a href="/admin/prompt-library" style={{ color: "#2563eb", fontSize: "0.85rem" }}>
                Need to edit the prompt? Visit Prompt Library →
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
      )}

      {/* Rows */}
      {filteredRows.length === 0 ? (
        <div style={styles.card}>
          <p style={{ color: "#94a3b8" }}>
            {statusFilter === "all"
              ? "No questions detected for this project."
              : `No ${statusFilter} questions found.`}
          </p>
        </div>
      ) : (
        <div style={styles.card}>
          {filteredRows.map((row) => (
            <RowCard
              key={row.id}
              row={row}
              projectId={project.id}
              projectStatus={project.status}
              projectReviewedBy={project.reviewedBy}
              promptText={promptText}
              sendingReviewRowId={sendingReviewRowId}
              onUpdateRow={updateRow}
              onQuestionEdit={handleQuestionEdit}
              onFlagOrReview={handleFlagOrReview}
              onResolveFlag={handleResolveFlag}
              onReopenFlag={handleReopenFlag}
              onApproveRow={handleApproveRow}
              onCorrectRow={handleCorrectRow}
            />
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
            <h3 style={{ margin: "0 0 8px 0" }}>Select Customer Profile</h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px 0" }}>
              Choose the primary customer profile for this RFP project.
            </p>
            <CustomerProfileSelector
              profiles={allCustomerProfiles}
              selectedIds={project.customer ? [project.customer.id] : []}
              onSave={handleSaveCustomerProfiles}
              onCancel={() => setShowCustomerSelector(false)}
              saving={savingCustomers}
            />
          </div>
        </div>
      )}

      {/* Owner Selector Modal */}
      {showOwnerSelector && (
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
          onClick={() => setShowOwnerSelector(false)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>Change Project Owner</h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px 0" }}>
              The owner can edit this project and receives review notifications.
            </p>
            <UserSelector
              onSelect={handleSaveOwner}
              onCancel={() => setShowOwnerSelector(false)}
              disabled={savingOwner}
              placeholder="Search for a user..."
            />
          </div>
        </div>
      )}

      <QueueIndicator
        queuedCount={queuedItems.length}
        isSending={isSendingQueued}
        onSendAll={handleSendAllQueued}
        onClear={handleClearQueue}
      />
    </div>
  );
}
