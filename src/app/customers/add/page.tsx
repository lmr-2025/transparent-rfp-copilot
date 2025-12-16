"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createProfile } from "@/lib/customerProfileApi";
import { getDefaultPrompt } from "@/lib/promptBlocks";
import {
  CustomerProfileDraft,
  CustomerProfileKeyFact,
  CustomerProfileSourceUrl,
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
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<CustomerProfileDraft | null>(null);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);

  // Document upload state
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const data = json.data ?? json;
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
      const data = json2.data ?? json2;
      setSfEnrichment(data.enrichment);
      setSfSearchResults([]);
      setSfSearchQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account from Salesforce");
    } finally {
      setSfLoading(false);
    }
  };

  // Apply Salesforce enrichment to create a draft
  const applySalesforceEnrichment = () => {
    if (!sfEnrichment) return;

    setDraft({
      name: sfEnrichment.name,
      industry: sfEnrichment.industry || undefined,
      website: sfEnrichment.website || undefined,
      overview: sfEnrichment.overview,
      keyFacts: sfEnrichment.keyFacts,
    });
    setSfEnrichment(null);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    const newDocs: UploadedDocument[] = [];

    for (const file of Array.from(files)) {
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

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to process ${file.name}`);
        }

        const json3 = await response.json();
        const data = json3.data ?? json3;

        const contentResponse = await fetch(`/api/documents/${data.document.id}`);
        if (contentResponse.ok) {
          const contentJson = await contentResponse.json();
          const contentData = contentJson.data ?? contentJson;
          newDocs.push({
            name: file.name,
            content: contentData.document.content,
            size: file.size,
          });

          await fetch(`/api/documents/${data.document.id}`, { method: "DELETE" });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to process ${file.name}`);
      }
    }

    if (newDocs.length > 0) {
      setUploadedDocs((prev) => [...prev, ...newDocs]);
    }

    setIsUploading(false);

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
      const data = (json4.data ?? json4) as AnalysisResult;
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
      const data = json5.data ?? json5;
      setDraft(data.draft);
      setAnalysisResult(null);
      if (data.transparency) {
        setBuildTransparency(data.transparency);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build profile");
    } finally {
      setIsBuilding(false);
    }
  };

  // Step 3: Save profile
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

      await createProfile({
        name: draft.name,
        industry: draft.industry,
        website: draft.website,
        overview: draft.overview,
        products: draft.products,
        challenges: draft.challenges,
        keyFacts: draft.keyFacts || [],
        sourceUrls: sourceUrlsToSave,
        isActive: true,
      });

      setSuccessMessage(`Profile "${draft.name}" created successfully!`);
      setDraft(null);
      setUrlInput("");
      setSourceUrls([]);
      setUploadedDocs([]);
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

  // Add key fact
  const addKeyFact = () => {
    if (!draft) return;
    const newFact: CustomerProfileKeyFact = { label: "", value: "" };
    updateDraft("keyFacts", [...(draft.keyFacts || []), newFact]);
  };

  // Update key fact
  const updateKeyFact = (index: number, field: "label" | "value", value: string) => {
    if (!draft) return;
    const facts = [...(draft.keyFacts || [])];
    facts[index] = { ...facts[index], [field]: value };
    updateDraft("keyFacts", facts);
  };

  // Remove key fact
  const removeKeyFact = (index: number) => {
    if (!draft) return;
    const facts = (draft.keyFacts || []).filter((_, i) => i !== index);
    updateDraft("keyFacts", facts);
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
        <DraftEditorCard
          draft={draft}
          buildTransparency={buildTransparency}
          isSaving={isSaving}
          onUpdateDraft={updateDraft}
          onAddKeyFact={addKeyFact}
          onUpdateKeyFact={updateKeyFact}
          onRemoveKeyFact={removeKeyFact}
          onSave={handleSave}
          onCancel={() => {
            setDraft(null);
            setSourceUrls([]);
            setUploadedDocs([]);
          }}
          onViewPrompt={() => setShowTransparencyModal("build")}
        />
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
