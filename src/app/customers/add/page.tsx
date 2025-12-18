"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createProfile } from "@/lib/customerProfileApi";
import { getDefaultPrompt } from "@/lib/promptBlocks";
import { parseApiData } from "@/lib/apiClient";
import {
  CustomerProfileDraft,
  CustomerProfileSourceUrl,
  CustomerProfileSourceDocument,
} from "@/types/customerProfile";
import TransparencyModal from "@/components/TransparencyModal";
import { CLAUDE_MODEL } from "@/lib/config";
import {
  SourceInputCard,
  SalesforceEnrichmentCard,
  AnalysisResultCard,
  DraftEditorCard,
  styles,
  UploadedDocument,
  SalesforceSearchResult,
  SalesforceEnrichment,
  TransparencyData,
  AnalysisResult,
} from "./components";

export default function CustomerProfileBuilderPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emptyContentWarning, setEmptyContentWarning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<CustomerProfileDraft | null>(null);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);

  // Document upload state
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Transparency state
  const [analyzeTransparency, setAnalyzeTransparency] = useState<TransparencyData | null>(null);
  const [buildTransparency, setBuildTransparency] = useState<TransparencyData | null>(null);
  const [showTransparencyModal, setShowTransparencyModal] = useState<"analyze" | "build" | "preview" | null>(null);

  // Salesforce state
  const [salesforceConfigured, setSalesforceConfigured] = useState<boolean | null>(null);
  const [sfSearchQuery, setSfSearchQuery] = useState("");
  const [sfSearchResults, setSfSearchResults] = useState<SalesforceSearchResult[]>([]);
  const [sfSearching, setSfSearching] = useState(false);
  const [sfEnrichment, setSfEnrichment] = useState<SalesforceEnrichment | null>(null);
  const [sfLoading, setSfLoading] = useState(false);
  // Keep track of the static fields to save when profile is created from Salesforce
  const [salesforceStaticFields, setSalesforceStaticFields] = useState<SalesforceEnrichment | null>(null);

  // Check if Salesforce is configured on mount
  useEffect(() => {
    const checkSalesforce = async () => {
      try {
        const response = await fetch("/api/customers/enrich-from-salesforce?search=test");
        if (response.status === 501) {
          setSalesforceConfigured(false);
        } else {
          setSalesforceConfigured(true);
        }
      } catch {
        setSalesforceConfigured(false);
      }
    };
    checkSalesforce();
  }, []);

  // Warn user before leaving page if upload is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = "Upload in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading]);

  // Get current prompt for preview
  const getCurrentPrompt = () => {
    return getDefaultPrompt("customer_profile");
  };

  // Salesforce search
  const handleSalesforceSearch = async () => {
    if (!sfSearchQuery.trim() || sfSearchQuery.length < 2) return;

    setSfSearching(true);
    setSfSearchResults([]);
    setError(null);

    try {
      const response = await fetch(`/api/customers/enrich-from-salesforce?search=${encodeURIComponent(sfSearchQuery)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to search Salesforce");
      }
      const json = await response.json();
      const data = parseApiData<{ results: SalesforceSearchResult[] }>(json);
      setSfSearchResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salesforce search failed");
    } finally {
      setSfSearching(false);
    }
  };

  // Select a Salesforce account to import
  const handleSelectSalesforceAccount = async (accountId: string) => {
    setSfLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/enrich-from-salesforce?accountId=${accountId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch Salesforce account");
      }
      const json2 = await response.json();
      const data = parseApiData<{ enrichment: SalesforceEnrichment }>(json2);
      setSfEnrichment(data.enrichment);
      setSfSearchResults([]);
      setSfSearchQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account from Salesforce");
    } finally {
      setSfLoading(false);
    }
  };

  // Apply Salesforce enrichment to create a draft (convert to new content format)
  const applySalesforceEnrichment = () => {
    if (!sfEnrichment) return;

    // Build content from Salesforce data
    const contentParts = [
      `## Overview\n${sfEnrichment.overview}`,
    ];
    if (sfEnrichment.keyFacts.length > 0) {
      contentParts.push(`## Key Facts\n${sfEnrichment.keyFacts.map(f => `- ${f.label}: ${f.value}`).join("\n")}`);
    }

    setDraft({
      name: sfEnrichment.name,
      industry: sfEnrichment.industry || undefined,
      website: sfEnrichment.website || undefined,
      content: contentParts.join("\n\n"),
      considerations: [],
    });
    // Save static fields to include when creating the profile
    setSalesforceStaticFields(sfEnrichment);
    setSfEnrichment(null);
  };

  // Handle file upload - now stores File object for later attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    const fileArray = Array.from(files);
    const newDocs: UploadedDocument[] = [];

    // Create abort controller for this upload session
    uploadAbortControllerRef.current = new AbortController();

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const filename = file.name.toLowerCase();

      // Update progress
      setUploadProgress({ current: i + 1, total: fileArray.length, currentFileName: file.name });

      if (
        !filename.endsWith(".pdf") &&
        !filename.endsWith(".docx") &&
        !filename.endsWith(".doc") &&
        !filename.endsWith(".txt")
      ) {
        setError(`Unsupported file type: ${file.name}. Please upload PDF, DOC, DOCX, or TXT files.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);

        // Use AbortController with 3 minute timeout for PDF processing (Claude extraction can take time)
        const timeoutId = setTimeout(() => {
          uploadAbortControllerRef.current?.abort();
        }, 180000); // 3 minutes

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
          signal: uploadAbortControllerRef.current.signal,
        });

        clearTimeout(timeoutId);

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || `Failed to process ${file.name}`);
        }

        const data = parseApiData<{ document: { id: string; content: string } }>(json);

        // Content is returned directly in the response now
        if (data.document.content) {
          newDocs.push({
            name: file.name,
            content: data.document.content,
            size: file.size,
            file: file, // Keep original file for attachment after save
          });
        }

        // Delete the temporary document
        await fetch(`/api/documents/${data.document.id}`, { method: "DELETE" });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError(`Upload timed out for ${file.name}. Please try again with a smaller file.`);
        } else {
          setError(err instanceof Error ? err.message : `Failed to process ${file.name}`);
        }
      }
    }

    if (newDocs.length > 0) {
      setUploadedDocs((prev) => [...prev, ...newDocs]);
    }

    setIsUploading(false);
    setUploadProgress(null);
    uploadAbortControllerRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeDocument = (index: number) => {
    setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 1: Analyze URLs and Documents
  const handleAnalyze = async () => {
    setError(null);
    setSuccessMessage(null);
    setAnalysisResult(null);
    setDraft(null);

    const urls = urlInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0 && uploadedDocs.length === 0) {
      setError("Please enter at least one URL or upload a document");
      return;
    }

    setIsAnalyzing(true);
    try {
      const documentContent = uploadedDocs.length > 0
        ? uploadedDocs.map((doc) => `[Document: ${doc.name}]\n${doc.content}`).join("\n\n---\n\n")
        : undefined;

      const response = await fetch("/api/customers/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: urls,
          documentContent,
          documentNames: uploadedDocs.map((d) => d.name),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze sources");
      }

      const json4 = await response.json();
      const data = parseApiData<AnalysisResult>(json4);
      setAnalysisResult(data);
      setSourceUrls(urls);
      if (data.transparency) {
        setAnalyzeTransparency(data.transparency);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze sources");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Build profile
  const handleBuild = async (forUpdate?: { profileId: string }) => {
    setError(null);
    setEmptyContentWarning(false);
    setIsBuilding(true);

    try {
      const documentContent = uploadedDocs.length > 0
        ? uploadedDocs.map((doc) => `[Document: ${doc.name}]\n${doc.content}`).join("\n\n---\n\n")
        : undefined;

      const response = await fetch("/api/customers/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls,
          documentContent,
          documentNames: uploadedDocs.map((d) => d.name),
          ...(forUpdate && { existingProfile: {} }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to build profile");
      }

      const json5 = await response.json();
      const data = parseApiData<{ draft: CustomerProfileDraft; transparency?: TransparencyData }>(json5);
      setDraft(data.draft);
      setAnalysisResult(null);
      if (data.transparency) {
        setBuildTransparency(data.transparency);
      }

      // Check if content is empty - warn user
      if (!data.draft.content?.trim()) {
        setEmptyContentWarning(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build profile");
    } finally {
      setIsBuilding(false);
    }
  };

  // Step 3: Save profile and attach documents
  const handleSave = async () => {
    if (!draft) return;

    setError(null);
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const sourceUrlsToSave: CustomerProfileSourceUrl[] = sourceUrls.map(
        (url) => ({
          url,
          addedAt: now,
          lastFetchedAt: now,
        })
      );

      // Build sourceDocuments metadata for the profile
      const sourceDocuments: CustomerProfileSourceDocument[] = uploadedDocs.map(doc => ({
        id: "", // Will be filled after upload
        filename: doc.name,
        uploadedAt: now,
      }));

      // Create profile with new content field
      const newProfile = await createProfile({
        name: draft.name,
        industry: draft.industry,
        website: draft.website,
        content: draft.content,
        considerations: draft.considerations || [],
        // Legacy fields - set overview to content for backwards compat
        overview: draft.content,
        keyFacts: [],
        sourceUrls: sourceUrlsToSave,
        sourceDocuments,
        isActive: true,
        // Static fields from Salesforce (if imported from Salesforce)
        ...(salesforceStaticFields && {
          salesforceId: salesforceStaticFields.salesforceId,
          region: salesforceStaticFields.region || undefined,
          tier: salesforceStaticFields.tier || undefined,
          employeeCount: salesforceStaticFields.employeeCount || undefined,
          annualRevenue: salesforceStaticFields.annualRevenue || undefined,
          accountType: salesforceStaticFields.accountType || undefined,
          billingLocation: salesforceStaticFields.billingLocation || undefined,
          lastSalesforceSync: now,
        }),
      });

      // Attach uploaded documents to the new profile
      let attachedCount = 0;
      for (const doc of uploadedDocs) {
        try {
          const formData = new FormData();
          formData.append("file", doc.file);
          formData.append("title", doc.name.replace(/\.[^/.]+$/, "")); // Remove extension
          if (doc.docType) {
            formData.append("docType", doc.docType);
          }

          const attachResponse = await fetch(`/api/customers/${newProfile.id}/documents`, {
            method: "POST",
            body: formData,
          });

          if (attachResponse.ok) {
            attachedCount++;
          }
        } catch {
          // Continue even if one doc fails to attach
          console.error(`Failed to attach document: ${doc.name}`);
        }
      }

      const docMessage = attachedCount > 0 ? ` with ${attachedCount} document(s) attached` : "";
      setSuccessMessage(`Profile "${draft.name}" created successfully${docMessage}!`);
      setDraft(null);
      setUrlInput("");
      setSourceUrls([]);
      setUploadedDocs([]);
      setSalesforceStaticFields(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  // Update draft field
  const updateDraft = (field: keyof CustomerProfileDraft, value: unknown) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
  };

  // Consideration handlers
  const addConsideration = () => {
    if (!draft) return;
    updateDraft("considerations", [...(draft.considerations || []), ""]);
  };

  const updateConsideration = (index: number, value: string) => {
    if (!draft) return;
    const considerations = [...(draft.considerations || [])];
    considerations[index] = value;
    updateDraft("considerations", considerations);
  };

  const removeConsideration = (index: number) => {
    if (!draft) return;
    const considerations = (draft.considerations || []).filter((_, i) => i !== index);
    updateDraft("considerations", considerations);
  };

  return (
    <div style={styles.container}>
      <h1 style={{ marginBottom: "8px" }}>
        The Rolodex{" "}
        <span style={{ fontWeight: 400, color: "#64748b" }}>
          (Build Customer Profile)
        </span>
      </h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Build customer intelligence from company websites, press releases, and
        case studies.{" "}
        <Link href="/customers" style={{ color: "#6366f1", textDecoration: "none" }}>
          View Library →
        </Link>
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {/* Step 1: URL and Document Input */}
      {!draft && (
        <SourceInputCard
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          isAnalyzing={isAnalyzing}
          isBuilding={isBuilding}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadedDocs={uploadedDocs}
          onFileUpload={handleFileUpload}
          onRemoveDocument={removeDocument}
          onAnalyze={handleAnalyze}
          onViewPrompt={() => setShowTransparencyModal("preview")}
          salesforceConfigured={salesforceConfigured}
          sfSearchQuery={sfSearchQuery}
          setSfSearchQuery={setSfSearchQuery}
          sfSearchResults={sfSearchResults}
          sfSearching={sfSearching}
          sfLoading={sfLoading}
          onSalesforceSearch={handleSalesforceSearch}
          onSelectSalesforceAccount={handleSelectSalesforceAccount}
        />
      )}

      {/* Salesforce Enrichment Preview */}
      {sfEnrichment && !draft && (
        <SalesforceEnrichmentCard
          enrichment={sfEnrichment}
          onApply={applySalesforceEnrichment}
          onCancel={() => setSfEnrichment(null)}
        />
      )}

      {/* Step 2: Analysis Result */}
      {analysisResult && !draft && (
        <AnalysisResultCard
          analysisResult={analysisResult}
          analyzeTransparency={analyzeTransparency}
          isBuilding={isBuilding}
          onBuild={handleBuild}
          onCancel={() => setAnalysisResult(null)}
          onViewPrompt={() => setShowTransparencyModal("analyze")}
        />
      )}

      {/* Step 3: Edit Draft */}
      {draft && (
        <>
          {/* Warning when LLM returned empty content */}
          {emptyContentWarning && (
            <div
              style={{
                ...styles.card,
                backgroundColor: "#fef3c7",
                border: "1px solid #f59e0b",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <span style={{ fontSize: "20px" }}>&#9888;</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: "#92400e" }}>Content extraction failed</strong>
                  <p style={{ margin: "4px 0 12px", color: "#78350f", fontSize: "14px" }}>
                    The AI was unable to extract profile content from your sources. This can happen if the source URLs
                    returned blocked content, login pages, or limited text. You can try again or manually fill in the content below.
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      style={{ ...styles.button, ...styles.primaryButton }}
                      onClick={() => {
                        setEmptyContentWarning(false);
                        handleBuild();
                      }}
                      disabled={isBuilding}
                    >
                      {isBuilding ? "Retrying..." : "Retry Build"}
                    </button>
                    <button
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={() => setShowTransparencyModal("build")}
                    >
                      View Prompt
                    </button>
                    <button
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={() => setEmptyContentWarning(false)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DraftEditorCard
            draft={draft}
            buildTransparency={buildTransparency}
            isSaving={isSaving}
            onUpdateDraft={updateDraft}
            onAddConsideration={addConsideration}
            onUpdateConsideration={updateConsideration}
            onRemoveConsideration={removeConsideration}
            onSave={handleSave}
            onCancel={() => {
              setDraft(null);
              setSourceUrls([]);
              setUploadedDocs([]);
              setEmptyContentWarning(false);
              setSalesforceStaticFields(null);
            }}
            onViewPrompt={() => setShowTransparencyModal("build")}
          />
        </>
      )}

      {/* Transparency Modal */}
      {showTransparencyModal === "analyze" && analyzeTransparency && (
        <TransparencyModal
          title="Analysis Prompt"
          subtitle="The prompts used to analyze your sources and identify the customer"
          headerColor="purple"
          onClose={() => setShowTransparencyModal(null)}
          configs={[
            { label: "Model", value: analyzeTransparency.model, color: "purple" },
            { label: "Max Tokens", value: analyzeTransparency.maxTokens, color: "blue" },
            { label: "Temperature", value: analyzeTransparency.temperature, color: "yellow" },
          ]}
          systemPrompt={analyzeTransparency.systemPrompt}
          systemPromptNote="This prompt instructs the AI on how to identify the customer and decide whether to create or update a profile."
          userPrompt={analyzeTransparency.userPrompt}
          userPromptLabel="User Prompt (with source content)"
          userPromptNote="This includes your source URLs/documents and existing customer profiles for comparison."
        />
      )}

      {showTransparencyModal === "build" && buildTransparency && (
        <TransparencyModal
          title="Profile Generation Prompt"
          subtitle="The prompts used to extract and structure the customer profile"
          headerColor="blue"
          onClose={() => setShowTransparencyModal(null)}
          configs={[
            { label: "Model", value: buildTransparency.model, color: "purple" },
            { label: "Max Tokens", value: buildTransparency.maxTokens, color: "blue" },
            { label: "Temperature", value: buildTransparency.temperature, color: "yellow" },
          ]}
          systemPrompt={buildTransparency.systemPrompt}
          systemPromptNote="This prompt defines the structure and content to extract for the customer profile."
          userPrompt={buildTransparency.userPrompt}
          userPromptLabel="User Prompt (with source material)"
          userPromptNote="This includes all the source content from your URLs and documents."
        />
      )}

      {showTransparencyModal === "preview" && (
        <TransparencyModal
          title="Profile Extraction Prompt"
          subtitle="This is the system prompt that will be sent to the LLM when building a customer profile"
          headerColor="purple"
          onClose={() => setShowTransparencyModal(null)}
          configs={[
            { label: "Model", value: CLAUDE_MODEL, color: "purple" },
            { label: "Max Tokens", value: 4000, color: "blue" },
            { label: "Temperature", value: 0.2, color: "yellow" },
          ]}
          systemPrompt={getCurrentPrompt()}
          systemPromptNote={
            <>
              This prompt can be customized in the <a href="/admin/prompt-blocks" style={{ color: "#6366f1" }}>Prompt Builder</a>.
            </>
          }
        />
      )}
    </div>
  );
}
