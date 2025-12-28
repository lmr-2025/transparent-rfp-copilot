"use client";

import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadSkillsFromStorage, loadSkillsFromApi, createSkillViaApi, updateSkillViaApi } from "@/lib/skillStorage";
import { parseApiData, getApiErrorMessage } from "@/lib/apiClient";
import { Skill, SourceUrl, SkillHistoryEntry } from "@/types/skill";
import { useCategories } from "@/hooks/use-knowledge";
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

  // Categories for skill assignment
  const { data: categories = [] } = useCategories();

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
  const isAnalyzingRef = useRef(false); // Prevent duplicate analyze calls

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
        const doc = parseApiData<{ id: string; title: string; filename: string; content: string }>(json, "document");
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
  const analyzeAndGroupSources = useCallback(async (urls: string[], documents: DocumentSource[]) => {
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
      const data = parseApiData<{ skillGroups?: Array<{
        action: string;
        skillTitle: string;
        existingSkillId?: string;
        urls?: string[];
        documentIds?: string[];
        reason?: string;
      }> }>(json);

      if (data.skillGroups && Array.isArray(data.skillGroups)) {
        const groups: SkillGroup[] = data.skillGroups.map((group: {
          action: string;
          skillTitle: string;
          existingSkillId?: string;
          urls?: string[];
          documentIds?: string[];
          category?: string;
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
            category: group.category, // AI-suggested category
            status: "pending" as const,
            reason: group.reason,
            originalContent: existingSkill?.content,
            originalTitle: existingSkill?.title,
          };
        });
        setSkillGroups(groups);

        // Fetch both types of analysis in parallel (runs in background)
        Promise.all([
          fetchDiscrepancyAnalysis(groups),
          fetchCoherenceAnalysis(groups),
        ]);
      }

      setWorkflowStep("review_groups");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed");
      setWorkflowStep("input");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setErrorMessage, setSkillGroups, setWorkflowStep, skills]);

  // Fetch discrepancy analysis for UPDATE groups (runs in background)
  const fetchDiscrepancyAnalysis = useCallback(async (groups: SkillGroup[]) => {
    const updateGroups = groups.filter(g => g.type === "update" && g.existingSkillId && g.urls.length > 0);

    for (const group of updateGroups) {
      try {
        // Analyze the first URL in the group (representative)
        const response = await fetch(`/api/skills/${group.existingSkillId}/sources/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: group.urls[0] }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.accessible) {
            // Update the group with discrepancy analysis
            const currentGroups = useBulkImportStore.getState().skillGroups;
            const updatedGroups = currentGroups.map(g =>
              g.id === group.id
                ? {
                    ...g,
                    discrepancyAnalysis: {
                      changeLevel: data.changeLevel,
                      changePercentage: data.changePercentage,
                      changeSummary: data.changeSummary,
                      recommendation: data.recommendation,
                    },
                  }
                : g
            );
            setSkillGroups(updatedGroups);
          }
        }
      } catch (error) {
        // Silently fail - discrepancy analysis is optional
        console.warn(`Failed to analyze discrepancy for group ${group.id}:`, error);
      }
    }
  }, [setSkillGroups]);

  // Fetch coherence analysis for groups with multiple sources (runs in background)
  const fetchCoherenceAnalysis = useCallback(async (groups: SkillGroup[]) => {
    // Filter: Only analyze groups with 2-5 sources for coherence check
    // But volume analysis runs for all groups (including single-source UPDATE groups)
    const eligibleGroups = groups.filter(g => {
      const sourceCount = (g.urls?.length || 0) + (g.documentIds?.length || 0);
      // For coherence: need 2+ sources
      // For volume: always check (especially UPDATE groups with existing content)
      return sourceCount >= 2 && sourceCount <= 5 || (g.type === "update" && sourceCount >= 1);
    });

    // Run analyses in parallel with max concurrency of 3
    const runAnalysis = async (group: SkillGroup) => {
      try {
        // Build sources array
        const sources = [
          ...(group.urls || []).map(url => ({ type: "url" as const, url })),
          ...(group.documents || []).map(doc => ({
            type: "document" as const,
            id: doc.id,
            content: doc.content,
            filename: doc.filename,
          })),
        ];

        const response = await fetch("/api/skills/groups/analyze-coherence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources,
            groupTitle: group.skillTitle,
            existingContent: group.type === "update" ? group.originalContent : undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update the group with coherence analysis
          const currentGroups = useBulkImportStore.getState().skillGroups;
          const updatedGroups = currentGroups.map(g =>
            g.id === group.id
              ? {
                  ...g,
                  coherenceAnalysis: {
                    coherent: data.coherent,
                    coherenceLevel: data.coherenceLevel,
                    coherencePercentage: data.coherencePercentage,
                    conflicts: data.conflicts || [],
                    recommendation: data.recommendation,
                    summary: data.summary,
                  },
                }
              : g
          );
          setSkillGroups(updatedGroups);
        }
      } catch (error) {
        // Silently fail - coherence analysis is optional
        console.warn(`Failed to analyze coherence for group ${group.id}:`, error);
      }
    };

    // Run with max concurrency of 3
    const chunks: SkillGroup[][] = [];
    for (let i = 0; i < eligibleGroups.length; i += 3) {
      chunks.push(eligibleGroups.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(runAnalysis));
    }
  }, [setSkillGroups]);

  const handleStartAnalysis = () => {
    setErrorMessage(null);
    setProcessedResult(null);

    const urls = parseUrls(urlInput);
    const documents = uploadedDocuments;

    if (urls.length === 0 && documents.length === 0) {
      setErrorMessage("Please enter at least one URL or upload a document");
      return;
    }

    // Go straight to auto-analyze
    setWorkflowStep("analyzing");
  };

  // Trigger analysis when workflow step changes to analyzing
  useEffect(() => {
    if (workflowStep === "analyzing" && skillGroups.length === 0 && !isAnalyzingRef.current) {
      // Prevent duplicate calls
      isAnalyzingRef.current = true;

      const urls = parseUrls(urlInput);
      const documents = uploadedDocuments;

      // Clear inputs now that we're moving to analysis
      setUrlInput("");
      clearUploadedDocuments();

      analyzeAndGroupSources(urls, documents).finally(() => {
        isAnalyzingRef.current = false;
      });
    }
  }, [
    analyzeAndGroupSources,
    clearUploadedDocuments,
    setUrlInput,
    skillGroups.length,
    uploadedDocuments,
    urlInput,
    workflowStep,
  ]);

  // Step 2: Generate drafts for approved groups
  // Helper to call the suggest API with proper error handling
  const callSuggestApi = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/skills/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = "Generation failed";
      try {
        const errorData = await response.json();
        errorMessage = getApiErrorMessage(errorData, "Generation failed");
      } catch {
        errorMessage = response.status === 504 ? "Request timed out" : `Server error (${response.status})`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const generateDrafts = async () => {
    setWorkflowStep("generating");
    const approvedGroups = skillGroups.filter(g => g.status === "approved");

    // Max URLs to process in a single API call (to avoid timeouts)
    const MAX_URLS_PER_BATCH = 2;

    for (const group of approvedGroups) {
      updateSkillGroup(group.id, { status: "generating" });

      try {
        const documentContent = group.documents && group.documents.length > 0
          ? group.documents.map(d => d.content).join("\n\n---\n\n")
          : undefined;

        if (group.type === "update" && group.existingSkillId) {
          const existingSkill = skills.find(s => s.id === group.existingSkillId);
          if (!existingSkill) throw new Error("Existing skill not found");

          // For updates with many URLs, process iteratively to avoid timeouts
          if (group.urls.length > MAX_URLS_PER_BATCH) {
            let currentContent = existingSkill.content;
            let currentTitle = existingSkill.title;
            const allHighlights: string[] = [];
            const allSources: string[] = [];
            let hasAnyChanges = false;

            // Process URLs in batches
            for (let i = 0; i < group.urls.length; i += MAX_URLS_PER_BATCH) {
              const batchUrls = group.urls.slice(i, i + MAX_URLS_PER_BATCH);
              const isFirstBatch = i === 0;

              const json = await callSuggestApi({
                sourceUrls: batchUrls,
                sourceText: isFirstBatch ? documentContent : undefined,
                notes: group.notes,
                existingSkill: {
                  title: currentTitle,
                  content: currentContent,
                },
              });

              const data = parseApiData<{ draftMode?: boolean; draft?: {
                title?: string;
                content: string;
                hasChanges?: boolean;
                changeHighlights?: string[];
                reasoning?: string;
                inference?: string;
                sources?: string;
              } }>(json);

              if (data.draftMode && data.draft) {
                if (data.draft.hasChanges) {
                  hasAnyChanges = true;
                  currentContent = data.draft.content;
                  if (data.draft.title) currentTitle = data.draft.title;
                  if (data.draft.changeHighlights) allHighlights.push(...data.draft.changeHighlights);
                }
                if (data.draft.sources) allSources.push(data.draft.sources);
              }

              // Small delay between batches
              if (i + MAX_URLS_PER_BATCH < group.urls.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }

            updateSkillGroup(group.id, {
              status: "ready_for_review",
              draft: {
                title: currentTitle,
                content: currentContent,
                hasChanges: hasAnyChanges,
                changeHighlights: allHighlights.length > 0 ? allHighlights : undefined,
                sources: allSources.length > 0 ? allSources.join("\n") : undefined,
              },
              originalContent: existingSkill.content,
              originalTitle: existingSkill.title,
            });
          } else {
            // Small number of URLs - process in single request
            const json = await callSuggestApi({
              sourceUrls: group.urls.length > 0 ? group.urls : undefined,
              sourceText: documentContent,
              notes: group.notes,
              existingSkill: {
                title: existingSkill.title,
                content: existingSkill.content,
              },
            });

            const data = parseApiData<{ draftMode?: boolean; draft?: {
              title?: string;
              content: string;
              hasChanges?: boolean;
              changeHighlights?: string[];
              reasoning?: string;
              inference?: string;
              sources?: string;
            } }>(json);

            if (data.draftMode && data.draft) {
              updateSkillGroup(group.id, {
                status: "ready_for_review",
                draft: {
                  title: data.draft.title || existingSkill.title,
                  content: data.draft.content,
                  hasChanges: data.draft.hasChanges,
                  changeHighlights: data.draft.changeHighlights,
                  reasoning: data.draft.reasoning,
                  inference: data.draft.inference,
                  sources: data.draft.sources,
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
          }
        } else {
          // CREATE mode - for many URLs, process iteratively
          if (group.urls.length > MAX_URLS_PER_BATCH) {
            // First batch: create initial draft
            const firstBatchUrls = group.urls.slice(0, MAX_URLS_PER_BATCH);
            const json = await callSuggestApi({
              sourceUrls: firstBatchUrls,
              sourceText: documentContent,
              notes: group.notes,
            });

            const data = parseApiData<{ draft: {
              title?: string;
              content: string;
              reasoning?: string;
              inference?: string;
              sources?: string;
            } }>(json);

            let currentContent = data.draft.content;
            let currentTitle = data.draft.title || group.skillTitle;
            const allSources: string[] = data.draft.sources ? [data.draft.sources] : [];

            // Process remaining URLs as updates to the draft
            for (let i = MAX_URLS_PER_BATCH; i < group.urls.length; i += MAX_URLS_PER_BATCH) {
              const batchUrls = group.urls.slice(i, i + MAX_URLS_PER_BATCH);

              await new Promise(resolve => setTimeout(resolve, 200));

              const updateJson = await callSuggestApi({
                sourceUrls: batchUrls,
                notes: group.notes,
                existingSkill: {
                  title: currentTitle,
                  content: currentContent,
                },
              });

              const updateData = parseApiData<{ draftMode?: boolean; draft?: {
                title?: string;
                content: string;
                hasChanges?: boolean;
                sources?: string;
              } }>(updateJson);

              if (updateData.draftMode && updateData.draft?.hasChanges) {
                currentContent = updateData.draft.content;
                if (updateData.draft.title) currentTitle = updateData.draft.title;
                if (updateData.draft.sources) allSources.push(updateData.draft.sources);
              }
            }

            updateSkillGroup(group.id, {
              status: "ready_for_review",
              draft: {
                title: currentTitle,
                content: currentContent,
                hasChanges: true,
                sources: allSources.length > 0 ? allSources.join("\n") : undefined,
              },
            });
          } else {
            // Small number of URLs - process in single request
            const json = await callSuggestApi({
              sourceUrls: group.urls.length > 0 ? group.urls : undefined,
              sourceText: documentContent,
              notes: group.notes,
            });

            const data = parseApiData<{ draft: {
              title?: string;
              content: string;
              reasoning?: string;
              inference?: string;
              sources?: string;
            } }>(json);
            const draft = data.draft;

            updateSkillGroup(group.id, {
              status: "ready_for_review",
              draft: {
                title: draft.title || group.skillTitle,
                content: draft.content,
                hasChanges: true,
                reasoning: draft.reasoning,
                inference: draft.inference,
                sources: draft.sources,
              },
            });
          }
        }
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : "Unknown error";
        // Handle Vercel serverless function termination
        if (errorMessage === "terminated" || errorMessage.includes("FUNCTION_INVOCATION_TIMEOUT")) {
          errorMessage = "Request timed out - try again";
        }
        updateSkillGroup(group.id, {
          status: "error",
          error: errorMessage,
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
            categories: group.category ? [group.category] : [],
            quickFacts: [] as { question: string; answer: string }[],
            edgeCases: [] as string[],
            sourceUrls,
            sourceDocuments: sourceDocuments.length > 0 ? sourceDocuments : undefined,
            isActive: true,
            tier: "library" as const,
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
    isAnalyzingRef.current = false;
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
          updateSkillGroup={updateSkillGroup}
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
          categories={categories}
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
          updateGroupCategory={(groupId, category) => updateSkillGroup(groupId, { category })}
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
