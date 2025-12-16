"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadSkillsFromStorage, loadSkillsFromApi, createSkillViaApi, updateSkillViaApi } from "@/lib/skillStorage";
import { getApiErrorMessage } from "@/lib/utils";
import { Skill, SourceUrl, SkillHistoryEntry } from "@/types/skill";
import LoadingSpinner from "@/components/LoadingSpinner";
import { usePrompt, useTextareaPrompt } from "@/components/ConfirmModal";
import {
  useBulkImportStore,
  useBulkImportCounts,
  type SkillGroup,
  type DocumentSource,
} from "@/stores/bulk-import-store";
import {
  ProgressSteps,
  SourceInputStep,
  ReviewGroupsStep,
  ReviewDraftsStep,
  GeneratingStep,
  SavingStep,
  DoneStep,
  SkillLibraryInfo,
  ProcessingIndicator,
  styles,
} from "./components";

function AddKnowledgeContent() {
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");

  // Local state for skills (fetched from API)
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());

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

      const json = await response.json();
      // API response is wrapped as { data: { skillGroups: [...] } }
      const data = json.data ?? json;

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

          const json = await response.json();
          const data = json.data ?? json;

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

          const json2 = await response.json();
          const data2 = json2.data ?? json2;
          const draft = data2.draft;

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

          // Link documents in parallel
          if (group.documents && group.documents.length > 0) {
            await Promise.all(
              group.documents.map(doc =>
                fetch(`/api/documents/${doc.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ skillId: updatedSkill.id }),
                })
              )
            );
          }

          // Link URLs in batch (single API call)
          if (group.urls.length > 0) {
            await fetch("/api/reference-urls/link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                urls: group.urls.map(url => ({ url, title: group.skillTitle })),
                skillId: updatedSkill.id,
              }),
            });
          }

          setSkills(prev => prev.map(s => s.id === existingSkill.id ? updatedSkill : s));
          updated++;
        } else {
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

          // Link documents in parallel
          if (group.documents && group.documents.length > 0) {
            await Promise.all(
              group.documents.map(doc =>
                fetch(`/api/documents/${doc.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ skillId: newSkill.id }),
                })
              )
            );
          }

          // Link URLs in batch (single API call)
          if (group.urls.length > 0) {
            await fetch("/api/reference-urls/link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                urls: group.urls.map(url => ({ url, title: group.skillTitle })),
                skillId: newSkill.id,
              }),
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

  const handleReset = () => {
    reset();
  };

  const parsedUrls = parseUrls(urlInput);

  return (
    <div style={styles.container}>
      <PromptDialog />
      <TextareaPromptDialog />
      <h1 style={{ marginBottom: "8px" }}>Add Knowledge</h1>
      <p style={{ color: "#475569", marginBottom: "24px" }}>
        Add documentation URLs or upload files. The AI will analyze your sources and suggest skills to create or update.
      </p>

      <ProgressSteps workflowStep={workflowStep} />

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

      {/* Step 1: Source Input */}
      {workflowStep === "input" && (
        <SourceInputStep
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          uploadedDocuments={uploadedDocuments}
          addUploadedDocument={addUploadedDocument}
          removeUploadedDocument={removeUploadedDocument}
          onStartAnalysis={handleStartAnalysis}
          parsedUrls={parsedUrls}
        />
      )}

      {/* Analyzing */}
      {workflowStep === "analyzing" && (
        <div style={styles.card}>
          <LoadingSpinner title="Analyzing sources..." subtitle="Grouping related content into skills" />
        </div>
      )}

      {/* Step 2: Review Groups */}
      {workflowStep === "review_groups" && (
        <ReviewGroupsStep
          skillGroups={skillGroups}
          setSkillGroups={setSkillGroups}
          expandedGroups={expandedGroups}
          toggleGroupExpanded={toggleGroupExpanded}
          toggleGroupApproval={toggleGroupApproval}
          rejectGroup={rejectGroup}
          approveAll={approveAll}
          moveUrl={moveUrl}
          createNewGroupFromUrl={createNewGroupFromUrl}
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          skills={skills}
          onGenerateDrafts={generateDrafts}
          onReset={handleReset}
          promptForSkillName={promptForSkillName}
        />
      )}

      {/* Generating */}
      {workflowStep === "generating" && (
        <GeneratingStep skillGroups={skillGroups} />
      )}

      {/* Step 3: Review Drafts */}
      {workflowStep === "review_drafts" && (
        <ReviewDraftsStep
          skillGroups={skillGroups}
          readyForReviewCount={readyForReviewCount}
          reviewedCount={reviewedCount}
          previewGroup={previewGroup}
          setPreviewGroup={setPreviewGroup}
          editingDraft={editingDraft}
          setEditingDraft={setEditingDraft}
          approveDraft={approveDraft}
          approveAllDrafts={approveAllDrafts}
          rejectDraft={rejectDraft}
          updateDraftField={updateDraftField}
          onSaveReviewedDrafts={saveReviewedDrafts}
          onBack={() => setWorkflowStep("review_groups")}
          promptForContent={promptForContent}
        />
      )}

      {/* Saving */}
      {workflowStep === "saving" && (
        <SavingStep skillGroups={skillGroups} />
      )}

      {/* Done */}
      {workflowStep === "done" && (
        <DoneStep skillGroups={skillGroups} onReset={handleReset} />
      )}

      {/* Current Skills Info */}
      <SkillLibraryInfo skills={skills} />

      {/* Processing indicator */}
      <ProcessingIndicator workflowStep={workflowStep} />
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
