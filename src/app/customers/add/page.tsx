"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createProfile, updateProfile } from "@/lib/customerProfileApi";
import { getDefaultPrompt } from "@/lib/promptBlocks";
import { parseApiData } from "@/lib/apiClient";
import {
  CustomerProfile,
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
  const [updateProfileId, setUpdateProfileId] = useState<string | null>(null); // Track profile ID for updates

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

  // Handle file upload - now just adds files to the list without processing
  // Processing happens later when creating the profile
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const fileArray = Array.from(files);
    const newDocs: UploadedDocument[] = [];

    for (const file of fileArray) {
      const filename = file.name.toLowerCase();

      if (
        !filename.endsWith(".pdf") &&
        !filename.endsWith(".docx") &&
        !filename.endsWith(".doc") &&
        !filename.endsWith(".txt")
      ) {
        setError(`Unsupported file type: ${file.name}. Please upload PDF, DOC, DOCX, or TXT files.`);
        continue;
      }

      // Check file size (20MB limit)
      const MAX_FILE_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} exceeds 20MB limit`);
        continue;
      }

      // Just add to list - no processing yet
      newDocs.push({
        name: file.name,
        content: "", // Will be populated when profile is created
        size: file.size,
        file: file,
        processForContent: true, // Default to processing for content
      });
    }

    if (newDocs.length > 0) {
      setUploadedDocs((prev) => [...prev, ...newDocs]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeDocument = (index: number) => {
    setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleProcessContent = (index: number) => {
    setUploadedDocs((prev) =>
      prev.map((doc, i) =>
        i === index ? { ...doc, processForContent: !doc.processForContent } : doc
      )
    );
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
      // First, extract content from documents marked for processing
      const docsToProcess = uploadedDocs.filter(doc => doc.processForContent);
      if (docsToProcess.length > 0 && !docsToProcess.every(doc => doc.content)) {
        // Extract content from documents that need it
        setIsUploading(true);
        for (let i = 0; i < docsToProcess.length; i++) {
          const doc = docsToProcess[i];
          if (doc.content) continue; // Skip if already has content

          setUploadProgress({ current: i + 1, total: docsToProcess.length, currentFileName: doc.name });

          try {
            const formData = new FormData();
            formData.append("file", doc.file);
            formData.append("title", doc.name);

            const response = await fetch("/api/documents", {
              method: "POST",
              body: formData,
            });

            const json = await response.json();
            if (!response.ok) {
              throw new Error(json.error || `Failed to process ${doc.name}`);
            }

            const data = parseApiData<{ document: { id: string; content: string } }>(json);

            // Update document with extracted content
            const docIndex = uploadedDocs.findIndex(d => d.name === doc.name);
            if (docIndex >= 0) {
              setUploadedDocs(prev => {
                const updated = [...prev];
                updated[docIndex] = { ...updated[docIndex], content: data.document.content };
                return updated;
              });
            }

            // Delete temporary document
            await fetch(`/api/documents/${data.document.id}`, { method: "DELETE" });
          } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to process ${doc.name}`);
            setIsUploading(false);
            setUploadProgress(null);
            setIsAnalyzing(false);
            return;
          }
        }
        setIsUploading(false);
        setUploadProgress(null);
      }

      // Now analyze with extracted content
      const documentContent = uploadedDocs.filter(doc => doc.processForContent && doc.content).length > 0
        ? uploadedDocs
            .filter(doc => doc.processForContent && doc.content)
            .map((doc) => `[Document: ${doc.name}]\n${doc.content}`)
            .join("\n\n---\n\n")
        : undefined;

      const response = await fetch("/api/customers/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: urls,
          documentContent,
          documentNames: uploadedDocs.filter(doc => doc.processForContent).map((d) => d.name),
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
      // If updating, fetch the existing profile data first
      let existingProfileData = null;
      if (forUpdate) {
        const profileResponse = await fetch(`/api/customers/${forUpdate.profileId}`);
        if (!profileResponse.ok) {
          throw new Error("Failed to fetch existing profile");
        }
        const profileJson = await profileResponse.json();
        const profile = parseApiData<{ profile: CustomerProfile }>(profileJson);
        existingProfileData = {
          name: profile.profile.name,
          content: profile.profile.content || profile.profile.overview || "",
        };
        setUpdateProfileId(forUpdate.profileId); // Save the ID for later save operation
      }

      const documentContent = uploadedDocs.filter(doc => doc.processForContent && doc.content).length > 0
        ? uploadedDocs
            .filter(doc => doc.processForContent && doc.content)
            .map((doc) => `[Document: ${doc.name}]\n${doc.content}`)
            .join("\n\n---\n\n")
        : undefined;

      const response = await fetch("/api/customers/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls,
          documentContent,
          documentNames: uploadedDocs.filter(doc => doc.processForContent).map((d) => d.name),
          ...(existingProfileData && { existingProfile: existingProfileData }),
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

      let savedProfile;

      if (updateProfileId) {
        // Update existing profile
        savedProfile = await updateProfile(updateProfileId, {
          name: draft.name,
          industry: draft.industry,
          website: draft.website,
          content: draft.content,
          considerations: draft.considerations || [],
          // Legacy fields - set overview to content for backwards compat
          overview: draft.content,
          sourceUrls: sourceUrlsToSave,
          sourceDocuments,
        });
      } else {
        // Create new profile
        savedProfile = await createProfile({
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
      }

      // Attach uploaded documents to the profile using batch upload
      let attachedCount = 0;
      if (uploadedDocs.length > 0) {
        try {
          const formData = new FormData();

          // Add all files
          uploadedDocs.forEach((doc) => {
            formData.append("files", doc.file);
          });

          // Add array of booleans indicating which files to process for content
          formData.append("processForContent", JSON.stringify(uploadedDocs.map(doc => doc.processForContent)));

          const batchResponse = await fetch(`/api/customers/${savedProfile.id}/documents/batch`, {
            method: "POST",
            body: formData,
          });

          if (batchResponse.ok) {
            const batchData = parseApiData<{ summary: { successful: number; failed: number } }>(await batchResponse.json());
            attachedCount = batchData.summary.successful;

            if (batchData.summary.failed > 0) {
              console.warn(`${batchData.summary.failed} document(s) failed to upload`);
            }
          }
        } catch (err) {
          console.error("Failed to batch upload documents:", err);
        }
      }

      const docMessage = attachedCount > 0 ? ` with ${attachedCount} document(s) attached` : "";
      const actionVerb = updateProfileId ? "updated" : "created";
      setSuccessMessage(`Profile "${draft.name}" ${actionVerb} successfully${docMessage}!`);
      setDraft(null);
      setUrlInput("");
      setSourceUrls([]);
      setUploadedDocs([]);
      setSalesforceStaticFields(null);
      setUpdateProfileId(null); // Clear update mode
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
          onToggleProcessContent={toggleProcessContent}
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
          onCancel={() => {
            setAnalysisResult(null);
            setUpdateProfileId(null); // Clear update mode
          }}
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
              setUpdateProfileId(null); // Clear update mode
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
              This prompt can be customized in the <a href="/admin/prompt-library" style={{ color: "#6366f1" }}>Prompt Library</a>.
            </>
          }
        />
      )}
    </div>
  );
}
