"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadSkillsFromStorage, loadSkillsFromApi, createSkillViaApi, updateSkillViaApi } from "@/lib/skillStorage";
import { getApiErrorMessage } from "@/lib/utils";
import { Skill, SourceUrl, SkillHistoryEntry } from "@/types/skill";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Check, ChevronDown, ChevronUp, Eye, Edit3, ArrowLeft, Upload, X, FileText, Link as LinkIcon, Loader2 } from "lucide-react";
import { diffLines, Change } from "diff";
import { usePrompt, useTextareaPrompt } from "@/components/ConfirmModal";
import {
  useBulkImportStore,
  useBulkImportCounts,
  type SkillGroup,
  type WorkflowStep,
  type DocumentSource,
} from "@/stores/bulk-import-store";

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
};

// Input mode for the add page
type InputMode = "urls" | "documents";

function AddKnowledgeContent() {
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");

  // Local state for skills (fetched from API)
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());

  // Input mode toggle
  const [inputMode, setInputMode] = useState<InputMode>("urls");

  // Document upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zustand store for workflow state
  const {
    urlInput,
    setUrlInput,
    uploadedDocuments,
    addUploadedDocument,
    removeUploadedDocument,
    clearUploadedDocuments,
    skillGroups,
    setSkillGroups,
    updateSkillGroup,
    workflowStep,
    setWorkflowStep,
    processedResult,
    setProcessedResult,
    errorMessage,
    setErrorMessage,
    expandedGroups,
    toggleGroupExpanded,
    previewGroup,
    setPreviewGroup,
    editingDraft,
    setEditingDraft,
    toggleGroupApproval,
    rejectGroup,
    approveAll,
    approveDraft,
    approveAllDrafts,
    rejectDraft,
    updateDraftField,
    moveUrl,
    createNewGroupFromUrl,
    reset,
  } = useBulkImportStore();

  const { pendingCount, approvedCount, readyForReviewCount, reviewedCount } =
    useBulkImportCounts();

  const { prompt: promptForSkillName, PromptDialog } = usePrompt({
    title: "New Skill Name",
    message: "Enter a name for the new skill",
    placeholder: "e.g., Security Compliance Overview",
    submitLabel: "Create",
  });

  const { prompt: promptForContent, TextareaPromptDialog } = useTextareaPrompt({
    title: "Edit Content",
    message: "For complex edits, approve and edit in the library",
    submitLabel: "Save",
  });

  const isProcessingRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = ["analyzing", "generating", "saving"].includes(workflowStep);
  }, [workflowStep]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessingRef.current) {
        e.preventDefault();
        e.returnValue = "Processing is in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    loadSkillsFromApi().then(setSkills).catch(() => toast.error("Failed to load skills"));
  }, []);

  // Load document if docId is provided (coming from document action dialog)
  useEffect(() => {
    if (!docIdParam) return;

    const loadDocument = async () => {
      setInputMode("documents");
      try {
        const response = await fetch(`/api/documents/${docIdParam}`);
        if (!response.ok) {
          throw new Error("Failed to load document");
        }
        const json = await response.json();
        const doc = json.data?.document ?? json.document;
        if (!doc) {
          throw new Error("Document not found");
        }

        // Add document to the upload list
        const docSource: DocumentSource = {
          id: doc.id,
          title: doc.title,
          filename: doc.filename,
          content: doc.content,
        };

        // Check if document is already in the list
        if (!uploadedDocuments.some(d => d.id === doc.id)) {
          addUploadedDocument(docSource);
        }
      } catch {
        toast.error("Failed to load document. Please try again.");
      }
    };

    loadDocument();
  }, [docIdParam, addUploadedDocument, uploadedDocuments]);

  const parseUrls = (input: string): string[] => {
    return input
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => {
        if (!url) return false;
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        // Auto-generate title from filename
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        formData.append("title", nameWithoutExt);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(getApiErrorMessage(data, `Failed to upload ${file.name}`));
        }

        // Add the uploaded document to our list
        const doc = data.document;
        addUploadedDocument({
          id: doc.id,
          title: doc.title,
          filename: doc.filename,
          content: doc.content,
        });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : `Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Step 1: Analyze and group sources (URLs and/or documents)
  const analyzeAndGroupSources = async (urls: string[], documents: DocumentSource[]) => {
    setWorkflowStep("analyzing");
    setErrorMessage(null);

    try {
      const existingSkillsInfo = skills.map(s => ({
        id: s.id,
        title: s.title,
        contentPreview: s.content.substring(0, 500),
        sourceUrls: s.sourceUrls?.map(u => u.url) || [],
      }));

      const response = await fetch("/api/skills/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: urls.length > 0 ? urls : undefined,
          sourceDocuments: documents.length > 0 ? documents.map(d => ({
            id: d.id,
            filename: d.filename,
            content: d.content,
          })) : undefined,
          existingSkills: existingSkillsInfo,
          groupUrls: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(getApiErrorMessage(errorData, "Analysis failed"));
      }

      const data = await response.json();

      if (data.skillGroups && Array.isArray(data.skillGroups)) {
        const groups: SkillGroup[] = data.skillGroups.map((group: {
          action: string;
          skillTitle: string;
          existingSkillId?: string;
          urls?: string[];
          documentIds?: string[];
          reason?: string;
        }, index: number) => {
          const existingSkill = group.existingSkillId
            ? skills.find(s => s.id === group.existingSkillId)
            : null;

          // Map document IDs back to full document data
          const groupDocs = (group.documentIds || [])
            .map(id => documents.find(d => d.id === id))
            .filter((d): d is DocumentSource => d !== undefined);

          return {
            id: `group-${index}`,
            type: group.action === "update_existing" ? "update" : "create",
            skillTitle: group.skillTitle,
            existingSkillId: group.existingSkillId,
            urls: group.urls || [],
            documentIds: group.documentIds,
            documents: groupDocs,
            status: "pending" as const,
            reason: group.reason,
            // Store original for diff comparison
            originalContent: existingSkill?.content,
            originalTitle: existingSkill?.title,
          };
        });
        setSkillGroups(groups);
      }

      setWorkflowStep("review_groups");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed");
      setWorkflowStep("input");
    }
  };

  const handleStartAnalysis = () => {
    setErrorMessage(null);
    setProcessedResult(null);

    const urls = parseUrls(urlInput);
    const documents = uploadedDocuments;

    if (urls.length === 0 && documents.length === 0) {
      setErrorMessage("Please enter at least one URL or upload a document");
      return;
    }

    setUrlInput("");
    clearUploadedDocuments();
    analyzeAndGroupSources(urls, documents);
  };

  // Step 2: Generate drafts for approved groups
  const generateDrafts = async () => {
    setWorkflowStep("generating");
    const approvedGroups = skillGroups.filter(g => g.status === "approved");

    for (const group of approvedGroups) {
      updateSkillGroup(group.id, { status: "generating" });

      try {
        // Combine document content if present
        const documentContent = group.documents && group.documents.length > 0
          ? group.documents.map(d => d.content).join("\n\n---\n\n")
          : undefined;

        if (group.type === "update" && group.existingSkillId) {
          const existingSkill = skills.find(s => s.id === group.existingSkillId);
          if (!existingSkill) throw new Error("Existing skill not found");

          const response = await fetch("/api/skills/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceUrls: group.urls.length > 0 ? group.urls : undefined,
              sourceText: documentContent,
              existingSkill: {
                title: existingSkill.title,
                content: existingSkill.content,
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(getApiErrorMessage(errorData, "Generation failed"));
          }

          const data = await response.json();

          if (data.draftMode && data.draft) {
            updateSkillGroup(group.id, {
              status: "ready_for_review",
              draft: {
                title: data.draft.title || existingSkill.title,
                content: data.draft.content,
                hasChanges: data.draft.hasChanges,
                changeHighlights: data.draft.changeHighlights,
              },
              originalContent: existingSkill.content,
              originalTitle: existingSkill.title,
            });
          } else {
            // No changes needed
            updateSkillGroup(group.id, {
              status: "ready_for_review",
              draft: {
                title: existingSkill.title,
                content: existingSkill.content,
                hasChanges: false,
              },
            });
          }
        } else {
          // Create new skill
          const response = await fetch("/api/skills/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceUrls: group.urls.length > 0 ? group.urls : undefined,
              sourceText: documentContent,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(getApiErrorMessage(errorData, "Generation failed"));
          }

          const data = await response.json();
          const draft = data.draft;

          updateSkillGroup(group.id, {
            status: "ready_for_review",
            draft: {
              title: draft.title || group.skillTitle,
              content: draft.content,
              hasChanges: true,
            },
          });
        }
      } catch (error) {
        updateSkillGroup(group.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setWorkflowStep("review_drafts");
  };

  // Step 3: Save reviewed drafts
  const saveReviewedDrafts = async () => {
    setWorkflowStep("saving");
    const reviewedGroups = skillGroups.filter(g => g.status === "reviewed" && g.draft);

    let created = 0, updated = 0, errors = 0;

    for (const group of reviewedGroups) {
      updateSkillGroup(group.id, { status: "saving" });

      try {
        const now = new Date().toISOString();
        const hasUrls = group.urls.length > 0;
        const hasDocs = group.documents && group.documents.length > 0;

        // Build source summary for history
        const sourceSummary = [
          hasUrls ? `${group.urls.length} URL(s)` : null,
          hasDocs ? `${group.documents!.length} document(s)` : null,
        ].filter(Boolean).join(" and ");

        if (group.type === "update" && group.existingSkillId) {
          const existingSkill = skills.find(s => s.id === group.existingSkillId);
          if (!existingSkill) throw new Error("Existing skill not found");

          const existingUrls = existingSkill.sourceUrls || [];
          const existingUrlStrings = new Set(existingUrls.map(u => u.url.toLowerCase().replace(/\/+$/, "")));

          const newSourceUrls: SourceUrl[] = group.urls
            .filter(url => !existingUrlStrings.has(url.toLowerCase().replace(/\/+$/, "")))
            .map(url => ({ url, addedAt: now, lastFetchedAt: now }));

          const updatedExistingUrls = existingUrls.map(u => {
            const normalizedExisting = u.url.toLowerCase().replace(/\/+$/, "");
            const wasRefetched = group.urls.some(url =>
              url.toLowerCase().replace(/\/+$/, "") === normalizedExisting
            );
            return wasRefetched ? { ...u, lastFetchedAt: now } : u;
          });

          // Build sourceDocuments for the skill
          const existingDocs = existingSkill.sourceDocuments || [];
          const existingDocIds = new Set(existingDocs.map(d => d.id));
          const newSourceDocs = (group.documents || [])
            .filter(d => !existingDocIds.has(d.id))
            .map(d => ({
              id: d.id,
              filename: d.filename,
              uploadedAt: now,
            }));

          const updates = {
            title: group.draft!.title,
            content: group.draft!.content,
            sourceUrls: [...updatedExistingUrls, ...newSourceUrls],
            sourceDocuments: [...existingDocs, ...newSourceDocs],
            lastRefreshedAt: now,
            history: [
              ...(existingSkill.history || []),
              {
                date: now,
                action: "updated" as const,
                summary: `Updated from bulk import with ${sourceSummary}`,
              },
            ],
          };

          const updatedSkill = await updateSkillViaApi(existingSkill.id, updates);

          // Link documents to the skill
          for (const doc of (group.documents || [])) {
            await fetch(`/api/documents/${doc.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ skillId: updatedSkill.id }),
            });
          }

          // Create/link ReferenceUrl records for URLs
          for (const url of group.urls) {
            await fetch("/api/reference-urls/link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url, skillId: updatedSkill.id, title: group.skillTitle }),
            });
          }

          setSkills(prev => prev.map(s => s.id === existingSkill.id ? updatedSkill : s));
          updated++;
        } else {
          // Create new skill
          const sourceUrls: SourceUrl[] = group.urls.map(url => ({
            url,
            addedAt: now,
            lastFetchedAt: now,
          }));

          const sourceDocuments = (group.documents || []).map(d => ({
            id: d.id,
            filename: d.filename,
            uploadedAt: now,
          }));

          const history: SkillHistoryEntry[] = [{
            date: now,
            action: "created" as const,
            summary: `Created from bulk import with ${sourceSummary}`,
          }];

          const skillData = {
            title: group.draft!.title,
            content: group.draft!.content,
            quickFacts: [] as { question: string; answer: string }[],
            edgeCases: [] as string[],
            sourceUrls,
            sourceDocuments: sourceDocuments.length > 0 ? sourceDocuments : undefined,
            isActive: true,
            history,
          };

          const newSkill = await createSkillViaApi(skillData);

          // Link documents to the skill
          for (const doc of (group.documents || [])) {
            await fetch(`/api/documents/${doc.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ skillId: newSkill.id }),
            });
          }

          // Create/link ReferenceUrl records for URLs
          for (const url of group.urls) {
            await fetch("/api/reference-urls/link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url, skillId: newSkill.id, title: group.skillTitle }),
            });
          }

          setSkills(prev => [newSkill, ...prev]);
          created++;
        }

        updateSkillGroup(group.id, { status: "done" });
      } catch (error) {
        updateSkillGroup(group.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        errors++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const skipped = skillGroups.filter(g => g.status === "rejected" || (g.status === "ready_for_review" && !g.draft?.hasChanges)).length;

    setProcessedResult({ created, updated, skipped, errors });
    setWorkflowStep("done");
  };

  // handleReset now uses store's reset action
  const handleReset = () => {
    reset();
  };

  const getGroupStatusStyle = (status: SkillGroup["status"]) => {
    switch (status) {
      case "approved": case "reviewed": case "done":
        return { backgroundColor: "#f0fdf4", borderColor: "#86efac" };
      case "rejected":
        return { backgroundColor: "#fef2f2", borderColor: "#fecaca" };
      case "generating": case "saving":
        return { backgroundColor: "#eff6ff", borderColor: "#93c5fd" };
      case "ready_for_review":
        return { backgroundColor: "#fefce8", borderColor: "#fde047" };
      case "error":
        return { backgroundColor: "#fef2f2", borderColor: "#fecaca" };
      default:
        return { backgroundColor: "#fff", borderColor: "#e2e8f0" };
    }
  };

  const parsedUrls = parseUrls(urlInput);

  // Simple diff visualization
  const renderDiff = (original: string | undefined, updated: string) => {
    if (!original) {
      return (
        <div style={{ backgroundColor: "#f0fdf4", padding: "12px", borderRadius: "6px", fontSize: "13px", whiteSpace: "pre-wrap" }}>
          <span style={{ color: "#166534" }}>{updated}</span>
        </div>
      );
    }

    // Compute proper line-by-line diff
    const diff = diffLines(original, updated);

    return (
      <div style={{ fontSize: "12px", fontFamily: "monospace", lineHeight: "1.5", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", overflow: "auto", maxHeight: "400px" }}>
        {diff.map((part: Change, index: number) => {
          if (part.added) {
            return (
              <div key={index} style={{ backgroundColor: "#dcfce7", borderLeft: "3px solid #22c55e", paddingLeft: "8px", whiteSpace: "pre-wrap" }}>
                {part.value}
              </div>
            );
          } else if (part.removed) {
            return (
              <div key={index} style={{ backgroundColor: "#fee2e2", borderLeft: "3px solid #ef4444", paddingLeft: "8px", whiteSpace: "pre-wrap", textDecoration: "line-through", opacity: 0.7 }}>
                {part.value}
              </div>
            );
          } else {
            // Unchanged lines - show collapsed if too long
            const lines = part.value.split("\n");
            if (lines.length > 6) {
              return (
                <div key={index} style={{ color: "#64748b", whiteSpace: "pre-wrap" }}>
                  {lines.slice(0, 3).join("\n")}
                  {"\n"}
                  <div style={{ color: "#94a3b8", fontStyle: "italic", padding: "4px 0" }}>... {lines.length - 6} unchanged lines ...</div>
                  {lines.slice(-3).join("\n")}
                </div>
              );
            }
            return (
              <div key={index} style={{ color: "#64748b", whiteSpace: "pre-wrap" }}>
                {part.value}
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <PromptDialog />
      <TextareaPromptDialog />
      <h1 style={{ marginBottom: "8px" }}>Add Knowledge</h1>
      <p style={{ color: "#475569", marginBottom: "24px" }}>
        Add documentation URLs or upload files. The AI will analyze your sources and suggest skills to create or update.
      </p>

      {/* Progress Steps */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", alignItems: "center" }}>
        {["Add Sources", "Group Sources", "Generate Content", "Review & Approve", "Done"].map((step, idx) => {
          const stepMap: Record<WorkflowStep, number> = { input: 0, analyzing: 1, review_groups: 1, generating: 2, review_drafts: 3, saving: 3, done: 4 };
          const currentIdx = stepMap[workflowStep];
          const isActive = idx === currentIdx;
          const isComplete = idx < currentIdx;

          return (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: isComplete ? "#22c55e" : isActive ? "#2563eb" : "#e2e8f0",
                color: isComplete || isActive ? "#fff" : "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 600,
              }}>
                {isComplete ? <Check size={14} /> : idx + 1}
              </div>
              <span style={{ fontSize: "13px", color: isActive ? "#2563eb" : "#64748b", fontWeight: isActive ? 600 : 400 }}>
                {step}
              </span>
              {idx < 4 && <div style={{ width: "24px", height: "2px", backgroundColor: isComplete ? "#22c55e" : "#e2e8f0" }} />}
            </div>
          );
        })}
      </div>

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}

      {processedResult && (
        <div style={styles.success}>
          <strong>Import complete!</strong>
          <div style={{ marginTop: "8px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {processedResult.created > 0 && <span style={{ color: "#15803d" }}>{processedResult.created} created</span>}
            {processedResult.updated > 0 && <span style={{ color: "#0369a1" }}>{processedResult.updated} updated</span>}
            {processedResult.skipped > 0 && <span style={{ color: "#ca8a04" }}>{processedResult.skipped} skipped</span>}
            {processedResult.errors > 0 && <span style={{ color: "#dc2626" }}>{processedResult.errors} failed</span>}
          </div>
        </div>
      )}

      {/* Step 1: Source Input (URLs or Documents) */}
      {workflowStep === "input" && (
        <div style={styles.card}>
          {/* Input Mode Tabs */}
          <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
            <button
              onClick={() => setInputMode("urls")}
              style={{
                padding: "12px 20px",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: inputMode === "urls" ? "2px solid #2563eb" : "2px solid transparent",
                color: inputMode === "urls" ? "#2563eb" : "#64748b",
                fontWeight: inputMode === "urls" ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <LinkIcon size={16} />
              URLs
            </button>
            <button
              onClick={() => setInputMode("documents")}
              style={{
                padding: "12px 20px",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: inputMode === "documents" ? "2px solid #2563eb" : "2px solid transparent",
                color: inputMode === "documents" ? "#2563eb" : "#64748b",
                fontWeight: inputMode === "documents" ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FileText size={16} />
              Documents
              {uploadedDocuments.length > 0 && (
                <span style={{
                  padding: "2px 8px",
                  backgroundColor: "#dbeafe",
                  color: "#1e40af",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}>{uploadedDocuments.length}</span>
              )}
            </button>
          </div>

          {/* URL Input */}
          {inputMode === "urls" && (
            <>
              <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
                Paste one or more URLs (one per line). The AI will analyze them, group related content, and suggest skills to create or update.
              </p>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://docs.example.com/security&#10;https://docs.example.com/compliance&#10;https://docs.example.com/api/authentication&#10;..."
                style={{
                  width: "100%",
                  minHeight: "200px",
                  padding: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  resize: "vertical",
                }}
              />
              <div style={{ marginTop: "8px", color: "#94a3b8", fontSize: "13px" }}>
                {parsedUrls.length} valid URL{parsedUrls.length !== 1 ? "s" : ""}
              </div>
            </>
          )}

          {/* Document Upload */}
          {inputMode === "documents" && (
            <>
              <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
                Upload PDF, Word, or text documents. The AI will extract content, analyze it, and suggest skills to create or update.
              </p>

              {uploadError && (
                <div style={{ ...styles.error, marginBottom: "16px" }}>{uploadError}</div>
              )}

              {/* Upload Area */}
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: "8px",
                  padding: "32px",
                  textAlign: "center",
                  backgroundColor: "#f8fafc",
                  marginBottom: "16px",
                  cursor: isUploading ? "not-allowed" : "pointer",
                }}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.pptx"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                {isUploading ? (
                  <>
                    <Loader2 size={32} style={{ color: "#64748b", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
                    <div style={{ color: "#64748b", fontWeight: 500 }}>Uploading...</div>
                  </>
                ) : (
                  <>
                    <Upload size={32} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
                    <div style={{ color: "#475569", fontWeight: 500 }}>
                      Click to upload or drag and drop
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
                      PDF, DOC, DOCX, PPTX, TXT (max 20MB each)
                    </div>
                  </>
                )}
              </div>

              {/* Uploaded Documents List */}
              {uploadedDocuments.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "8px" }}>
                    {uploadedDocuments.length} document{uploadedDocuments.length !== 1 ? "s" : ""} ready to analyze:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {uploadedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: "6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <FileText size={16} style={{ color: "#15803d" }} />
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#166534" }}>
                            {doc.filename}
                          </span>
                        </div>
                        <button
                          onClick={() => removeUploadedDocument(doc.id)}
                          style={{
                            padding: "4px",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "#64748b",
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Summary & Analyze Button */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #e2e8f0",
          }}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              {parsedUrls.length > 0 && `${parsedUrls.length} URL${parsedUrls.length !== 1 ? "s" : ""}`}
              {parsedUrls.length > 0 && uploadedDocuments.length > 0 && " + "}
              {uploadedDocuments.length > 0 && `${uploadedDocuments.length} document${uploadedDocuments.length !== 1 ? "s" : ""}`}
              {parsedUrls.length === 0 && uploadedDocuments.length === 0 && "Add URLs or documents to analyze"}
            </div>
            <button
              onClick={handleStartAnalysis}
              disabled={parsedUrls.length === 0 && uploadedDocuments.length === 0}
              style={{
                padding: "10px 20px",
                backgroundColor: (parsedUrls.length === 0 && uploadedDocuments.length === 0) ? "#cbd5e1" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: (parsedUrls.length === 0 && uploadedDocuments.length === 0) ? "not-allowed" : "pointer",
              }}
            >
              Analyze Sources →
            </button>
          </div>
        </div>
      )}

      {/* Analyzing */}
      {workflowStep === "analyzing" && (
        <div style={styles.card}>
          <LoadingSpinner title="Analyzing sources..." subtitle="Grouping related content into skills" />
        </div>
      )}

      {/* Step 2: Review Groups */}
      {workflowStep === "review_groups" && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>Review Source Groupings</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              {approvedCount > 0 && (
                <button
                  onClick={generateDrafts}
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
                  Generate Content for {approvedCount} →
                </button>
              )}
              <button onClick={handleReset} style={{ padding: "10px 20px", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>
                Start Over
              </button>
            </div>
          </div>

          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
            Approve groups to generate AI content. You&apos;ll review the content before it&apos;s saved.
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
              <span><strong>{skillGroups.length}</strong> groups</span>
              {pendingCount > 0 && <span style={{ color: "#64748b" }}><strong>{pendingCount}</strong> pending</span>}
              {approvedCount > 0 && <span style={{ color: "#15803d" }}><strong>{approvedCount}</strong> approved</span>}
            </div>
            {pendingCount > 0 && (
              <button onClick={approveAll} style={{ padding: "6px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                Approve All
              </button>
            )}
          </div>

          {/* Group Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {skillGroups.map((group) => (
              <div key={group.id} style={{ border: `1px solid ${getGroupStatusStyle(group.status).borderColor}`, borderRadius: "8px", backgroundColor: getGroupStatusStyle(group.status).backgroundColor, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => toggleGroupExpanded(group.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                    <div style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: group.type === "create" ? "#dbeafe" : "#fef3c7", color: group.type === "create" ? "#1e40af" : "#92400e" }}>
                      {group.type === "create" ? "CREATE" : "UPDATE"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "15px" }}>{group.skillTitle}</div>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>
                        {group.urls.length > 0 && `${group.urls.length} URL${group.urls.length !== 1 ? "s" : ""}`}
                        {group.urls.length > 0 && (group.documents?.length || 0) > 0 && " + "}
                        {(group.documents?.length || 0) > 0 && `${group.documents!.length} doc${group.documents!.length !== 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {group.status === "pending" && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); toggleGroupApproval(group.id); }} style={{ padding: "6px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Approve</button>
                        <button onClick={(e) => { e.stopPropagation(); rejectGroup(group.id); }} style={{ padding: "6px 12px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Skip</button>
                      </>
                    )}
                    {group.status === "approved" && <span style={{ color: "#15803d", fontSize: "13px", fontWeight: 500 }}>✓ Approved</span>}
                    {group.status === "rejected" && <span style={{ color: "#dc2626", fontSize: "13px", fontWeight: 500 }}>Skipped</span>}
                    {expandedGroups.has(group.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {expandedGroups.has(group.id) && (
                  <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.5)" }}>
                    {/* URLs */}
                    {group.urls.length > 0 && (
                      <>
                        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", fontWeight: 500 }}>URLs:</div>
                        {group.urls.map((url, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#f8fafc", borderRadius: "4px", fontSize: "12px", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "monospace", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{url}</span>
                            {group.status === "pending" && (
                              <select
                                onChange={async (e) => {
                                  const value = e.target.value;
                                  e.target.value = "";
                                  if (value === "new") {
                                    const newTitle = await promptForSkillName();
                                    if (newTitle) createNewGroupFromUrl(group.id, url, newTitle);
                                  } else if (value.startsWith("existing:")) {
                                    // Move to an existing skill - create/update a group for it
                                    const skillId = value.replace("existing:", "");
                                    const existingSkill = skills.find(s => s.id === skillId);
                                    if (existingSkill) {
                                      // Check if there's already a group for this skill
                                      const existingGroup = skillGroups.find(g => g.existingSkillId === skillId);
                                      if (existingGroup) {
                                        // Add URL to existing group
                                        moveUrl(group.id, url, existingGroup.id);
                                      } else {
                                        // Create a new UPDATE group for this skill
                                        const newGroup: SkillGroup = {
                                          id: `group-existing-${skillId}-${Date.now()}`,
                                          type: "update",
                                          skillTitle: existingSkill.title,
                                          existingSkillId: skillId,
                                          urls: [url],
                                          status: "pending",
                                        };
                                        // Remove URL from current group and add new group
                                        const updatedGroups = skillGroups
                                          .map(g => g.id === group.id ? { ...g, urls: g.urls.filter(u => u !== url) } : g)
                                          .filter(g => g.urls.length > 0 || (g.documents && g.documents.length > 0));
                                        setSkillGroups([...updatedGroups, newGroup]);
                                      }
                                    }
                                  } else if (value) {
                                    moveUrl(group.id, url, value);
                                  }
                                }}
                                style={{ marginLeft: "8px", padding: "4px 8px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
                                defaultValue=""
                              >
                                <option value="" disabled>Move to...</option>
                                {skillGroups.filter(g => g.id !== group.id).length > 0 && (
                                  <optgroup label="Current groups">
                                    {skillGroups.filter(g => g.id !== group.id).map(g => <option key={g.id} value={g.id}>{g.skillTitle}</option>)}
                                  </optgroup>
                                )}
                                {skills.filter(s => !skillGroups.some(g => g.existingSkillId === s.id)).length > 0 && (
                                  <optgroup label="Existing skills">
                                    {skills
                                      .filter(s => !skillGroups.some(g => g.existingSkillId === s.id))
                                      .map(s => <option key={s.id} value={`existing:${s.id}`}>{s.title}</option>)}
                                  </optgroup>
                                )}
                                <option value="new">+ New skill</option>
                              </select>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    {/* Documents */}
                    {group.documents && group.documents.length > 0 && (
                      <>
                        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", marginTop: group.urls.length > 0 ? "12px" : 0, fontWeight: 500 }}>Documents:</div>
                        {group.documents.map((doc) => (
                          <div key={doc.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", backgroundColor: "#f0fdf4", borderRadius: "4px", fontSize: "12px", marginBottom: "4px", border: "1px solid #bbf7d0" }}>
                            <FileText size={14} style={{ color: "#15803d", marginRight: "8px", flexShrink: 0 }} />
                            <span style={{ color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{doc.filename}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generating */}
      {workflowStep === "generating" && (
        <div style={styles.card}>
          <LoadingSpinner
            title="Generating content..."
            subtitle="Creating skill content from sources"
          />
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {skillGroups.filter(g => g.status !== "rejected" && g.status !== "pending").map(group => (
              <div key={group.id} style={{ padding: "10px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", ...getGroupStatusStyle(group.status), border: `1px solid ${getGroupStatusStyle(group.status).borderColor}` }}>
                <span style={{ fontWeight: 500 }}>{group.skillTitle}</span>
                <span style={{ fontSize: "13px", color: group.status === "generating" ? "#2563eb" : group.status === "ready_for_review" ? "#15803d" : group.status === "approved" ? "#64748b" : "#dc2626" }}>
                  {group.status === "generating" ? "Generating..." : group.status === "ready_for_review" ? "Ready" : group.status === "approved" ? "Queued" : "Error"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Review Drafts */}
      {workflowStep === "review_drafts" && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>Review Generated Content</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              {reviewedCount > 0 && (
                <button onClick={saveReviewedDrafts} style={{ padding: "10px 20px", backgroundColor: "#15803d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                  Save {reviewedCount} Skill{reviewedCount !== 1 ? "s" : ""} →
                </button>
              )}
              <button onClick={() => setWorkflowStep("review_groups")} style={{ padding: "10px 20px", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>
                <ArrowLeft size={14} style={{ marginRight: "4px" }} /> Back
              </button>
            </div>
          </div>

          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
            Review each skill&apos;s content before saving. Click to expand and see the full diff.
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
              {readyForReviewCount > 0 && <span style={{ color: "#ca8a04" }}><strong>{readyForReviewCount}</strong> pending review</span>}
              {reviewedCount > 0 && <span style={{ color: "#15803d" }}><strong>{reviewedCount}</strong> approved</span>}
            </div>
            {readyForReviewCount > 0 && (
              <button onClick={approveAllDrafts} style={{ padding: "6px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "4px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                Approve All
              </button>
            )}
          </div>

          {/* Draft Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {skillGroups.filter(g => g.draft || g.status === "error").map((group) => (
              <div key={group.id} style={{ border: `1px solid ${getGroupStatusStyle(group.status).borderColor}`, borderRadius: "8px", backgroundColor: getGroupStatusStyle(group.status).backgroundColor, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: group.type === "create" ? "#dbeafe" : "#fef3c7", color: group.type === "create" ? "#1e40af" : "#92400e" }}>
                        {group.type === "create" ? "NEW SKILL" : "UPDATE"}
                      </div>
                      {group.draft?.hasChanges === false && (
                        <div style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, backgroundColor: "#f1f5f9", color: "#64748b" }}>
                          No changes needed
                        </div>
                      )}
                    </div>

                    {/* Editable Title */}
                    {editingDraft?.groupId === group.id && editingDraft.field === "title" ? (
                      <input
                        type="text"
                        value={group.draft?.title || ""}
                        onChange={(e) => updateDraftField(group.id, "title", e.target.value)}
                        onBlur={() => setEditingDraft(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingDraft(null)}
                        autoFocus
                        style={{ fontSize: "18px", fontWeight: 600, border: "1px solid #2563eb", borderRadius: "4px", padding: "4px 8px", width: "100%" }}
                      />
                    ) : (
                      <h4 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => setEditingDraft({ groupId: group.id, field: "title" })}>
                        {group.draft?.title || group.skillTitle}
                        <Edit3 size={14} style={{ color: "#94a3b8" }} />
                      </h4>
                    )}

                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                      {group.urls.length} source URL{group.urls.length !== 1 ? "s" : ""}
                    </div>

                    {/* Change highlights */}
                    {group.draft?.changeHighlights && group.draft.changeHighlights.length > 0 && (
                      <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: "6px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>What changed:</div>
                        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#475569" }}>
                          {group.draft.changeHighlights.map((highlight, idx) => (
                            <li key={idx}>{highlight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {(group.status === "ready_for_review" || group.status === "reviewed") && (
                      <>
                        <button onClick={() => setPreviewGroup(previewGroup?.id === group.id ? null : group)} style={{ padding: "8px 12px", backgroundColor: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Eye size={14} /> {previewGroup?.id === group.id ? "Hide" : "Preview"}
                        </button>
                        {group.status === "ready_for_review" && (
                          <>
                            <button onClick={() => approveDraft(group.id)} style={{ padding: "8px 12px", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                              Approve
                            </button>
                            <button onClick={() => rejectDraft(group.id)} style={{ padding: "8px 12px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                              Skip
                            </button>
                          </>
                        )}
                        {group.status === "reviewed" && (
                          <span style={{ padding: "8px 12px", color: "#15803d", fontSize: "13px", fontWeight: 500 }}>✓ Approved</span>
                        )}
                      </>
                    )}
                    {group.status === "error" && (
                      <span style={{ color: "#dc2626", fontSize: "13px" }}>{group.error}</span>
                    )}
                  </div>
                </div>

                {/* Preview/Diff Panel */}
                {previewGroup?.id === group.id && group.draft && (
                  <div style={{ borderTop: "1px solid #e2e8f0", padding: "16px", backgroundColor: "#f8fafc" }}>
                    {/* Source URLs */}
                    {group.urls.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
                          Source URLs:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
                          {group.urls.map((url, idx) => (
                            <li key={idx} style={{ marginBottom: "4px" }}>
                              <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Content Diff */}
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
                        Content {group.type === "update" ? (group.draft.hasChanges ? "Changes" : "") : "Preview"}:
                      </div>
                      {group.type === "update" ? (
                        group.draft.hasChanges === false ? (
                          <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "16px", textAlign: "center" }}>
                            <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>
                              ✓ The existing skill already covers this content
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                              No updates are needed. The source material doesn&apos;t contain new information.
                            </div>
                          </div>
                        ) : (
                          renderDiff(group.originalContent, group.draft.content)
                        )
                      ) : (
                        <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", maxHeight: "400px", overflow: "auto" }}>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "13px", fontFamily: "inherit" }}>{group.draft.content}</pre>
                        </div>
                      )}
                    </div>

                    {/* Edit Content Button */}
                    <div style={{ marginTop: "12px" }}>
                      <button
                        onClick={async () => {
                          const newContent = await promptForContent({ defaultValue: group.draft?.content || "" });
                          if (newContent !== null) {
                            updateDraftField(group.id, "content", newContent);
                          }
                        }}
                        style={{ padding: "8px 12px", backgroundColor: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                      >
                        <Edit3 size={14} style={{ marginRight: "4px" }} /> Edit Content
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saving */}
      {workflowStep === "saving" && (
        <div style={styles.card}>
          <LoadingSpinner title="Saving skills..." subtitle="Writing to database" />
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {skillGroups.filter(g => g.status === "reviewed" || g.status === "saving" || g.status === "done" || g.status === "error").map(group => (
              <div key={group.id} style={{ padding: "10px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", ...getGroupStatusStyle(group.status), border: `1px solid ${getGroupStatusStyle(group.status).borderColor}` }}>
                <span style={{ fontWeight: 500 }}>{group.draft?.title || group.skillTitle}</span>
                <span style={{ fontSize: "13px" }}>
                  {group.status === "saving" && <span style={{ color: "#2563eb" }}>Saving...</span>}
                  {group.status === "done" && <span style={{ color: "#15803d" }}>✓ Saved</span>}
                  {group.status === "error" && <span style={{ color: "#dc2626" }}>Failed</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {workflowStep === "done" && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>Import Complete</h3>
            <button onClick={handleReset} style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
              Import More
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {skillGroups.map(group => (
              <div key={group.id} style={{ padding: "10px 14px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", ...getGroupStatusStyle(group.status), border: `1px solid ${getGroupStatusStyle(group.status).borderColor}` }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{group.draft?.title || group.skillTitle}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{group.type === "create" ? "Created" : "Updated"}</div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>
                  {group.status === "done" && <span style={{ color: "#15803d" }}>✓ Success</span>}
                  {group.status === "error" && <span style={{ color: "#dc2626" }}>Failed</span>}
                  {group.status === "rejected" && <span style={{ color: "#64748b" }}>Skipped</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Skills Info */}
      <div style={{ ...styles.card, backgroundColor: "#f8fafc" }}>
        <h3 style={{ marginTop: 0 }}>Current Skill Library</h3>
        <p style={{ color: "#64748b", marginBottom: "12px" }}>
          <strong>{skills.length}</strong> existing skill{skills.length !== 1 ? "s" : ""}
        </p>
        {skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {skills.slice(0, 12).map((skill) => (
              <span key={skill.id} style={{ padding: "4px 10px", backgroundColor: "#dbeafe", color: "#1e40af", borderRadius: "4px", fontSize: "13px" }}>{skill.title}</span>
            ))}
            {skills.length > 12 && <span style={{ color: "#94a3b8", fontSize: "13px", padding: "4px" }}>+{skills.length - 12} more</span>}
          </div>
        )}
      </div>

      {/* Processing indicator */}
      {["analyzing", "generating", "saving"].includes(workflowStep) && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#1e293b", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 -4px 12px rgba(0,0,0,0.15)", zIndex: 1000 }}>
          <div style={{ width: "20px", height: "20px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>
              {workflowStep === "analyzing" ? "Analyzing sources..." : workflowStep === "generating" ? "Generating content..." : "Saving skills..."}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function AddKnowledgePage() {
  return (
    <Suspense fallback={
      <div style={styles.container}>
        <LoadingSpinner title="Loading..." subtitle="Preparing the knowledge import page" />
      </div>
    }>
      <AddKnowledgeContent />
    </Suspense>
  );
}
