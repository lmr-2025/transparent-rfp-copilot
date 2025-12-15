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

type UploadedDocument = {
  name: string;
  content: string;
  size: number;
};

type SalesforceSearchResult = {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  type?: string;
};

type SalesforceEnrichment = {
  name: string;
  industry: string | null;
  website: string | null;
  overview: string;
  keyFacts: { label: string; value: string }[];
  salesforceId: string;
};

type TransparencyData = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
};

type AnalysisResult = {
  suggestion: {
    action: "create_new" | "update_existing";
    existingProfileId?: string;
    existingProfileName?: string;
    suggestedName?: string;
    suggestedIndustry?: string;
    reason: string;
  };
  sourcePreview: string;
  urlAlreadyUsed?: {
    profileId: string;
    profileName: string;
    matchedUrls: string[];
  };
  transparency?: TransparencyData;
};

const styles = {
  container: {
    maxWidth: "820px",
    margin: "0 auto",
    padding: "24px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "16px",
    backgroundColor: "#fff",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginTop: "12px",
    marginBottom: "4px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical" as const,
    minHeight: "100px",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    color: "#fff",
  },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "10px 12px",
    marginTop: "12px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    borderRadius: "6px",
    padding: "10px 12px",
    marginTop: "12px",
  },
  keyFact: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "8px",
  },
};

export default function CustomerProfileBuilderPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
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

  // Get current prompt for preview (uses the block-based system)
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
      const data = await response.json();
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
      const data = await response.json();
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

      // Check supported types
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
        // Upload to document API to extract text
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

        const data = await response.json();

        // Fetch the full content
        const contentResponse = await fetch(`/api/documents/${data.document.id}`);
        if (contentResponse.ok) {
          const contentData = await contentResponse.json();
          newDocs.push({
            name: file.name,
            content: contentData.document.content,
            size: file.size,
          });

          // Delete the temporary document from the database
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

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove an uploaded document
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
      // Combine document content for analysis
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

      const data = (await response.json()) as AnalysisResult;
      setAnalysisResult(data);
      setSourceUrls(urls);
      // Store transparency data
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
      // Prompt is now loaded server-side from the block system
      // No need to pass it from client - API will use loadSystemPrompt

      // Combine document content for building
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
          ...(forUpdate && {
            existingProfile: {
              // Would need to fetch existing profile here for update mode
              // For now, just create new
            },
          }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to build profile");
      }

      const data = await response.json();
      setDraft(data.draft);
      setAnalysisResult(null);
      // Store transparency data
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
  const updateKeyFact = (
    index: number,
    field: "label" | "value",
    value: string
  ) => {
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
        <Link
          href="/customers"
          style={{ color: "#6366f1", textDecoration: "none" }}
        >
          View Library →
        </Link>
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {/* Step 1: URL and Document Input */}
      {!draft && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
            Add Customer Sources
          </h3>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "12px" }}>
            Paste URLs to the customer&apos;s website, about page, press releases, or
            case studies. One URL per line.
          </p>
          <textarea
            style={{ ...styles.textarea, minHeight: "100px" }}
            placeholder="https://example.com/about&#10;https://example.com/press/funding-announcement&#10;https://example.com/customers/case-study"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isAnalyzing || isBuilding || isUploading}
          />

          {/* Document Upload Section */}
          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "12px" }}>
              Or upload documents (PDF, DOC, DOCX, TXT)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              onChange={handleFileUpload}
              style={{ display: "none" }}
              disabled={isAnalyzing || isBuilding || isUploading}
            />

            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || isBuilding || isUploading}
            >
              {isUploading ? "Processing..." : "Upload Documents"}
            </button>

            {/* Show uploaded documents */}
            {uploadedDocs.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                {uploadedDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "#f1f5f9",
                      borderRadius: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#475569" }}>
                      📄 {doc.name}{" "}
                      <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                        ({Math.round(doc.size / 1024)} KB)
                      </span>
                    </span>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        fontSize: "16px",
                        padding: "0 4px",
                      }}
                      onClick={() => removeDocument(idx)}
                      disabled={isAnalyzing || isBuilding}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Salesforce Import Section */}
          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", color: "#64748b" }}>Or import from</span>
              <span style={{
                backgroundColor: "#e0f2fe",
                color: "#0369a1",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
              }}>
                Salesforce
              </span>
            </div>

            {salesforceConfigured === false && (
              <div style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "12px 16px",
              }}>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
                  Salesforce integration is not configured.{" "}
                  <Link
                    href="/admin/settings"
                    style={{ color: "#6366f1", textDecoration: "none", fontWeight: 500 }}
                  >
                    Set up Salesforce →
                  </Link>
                </p>
              </div>
            )}

            {salesforceConfigured === null && (
              <p style={{ fontSize: "13px", color: "#94a3b8" }}>Checking Salesforce connection...</p>
            )}

            {salesforceConfigured && (
              <>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="Search Salesforce accounts by name..."
                    value={sfSearchQuery}
                    onChange={(e) => setSfSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSalesforceSearch()}
                    disabled={sfSearching || sfLoading}
                  />
                  <button
                    style={{ ...styles.button, ...styles.secondaryButton }}
                    onClick={handleSalesforceSearch}
                    disabled={sfSearching || sfLoading || sfSearchQuery.length < 2}
                  >
                    {sfSearching ? "Searching..." : "Search"}
                  </button>
                </div>

                {/* Search Results */}
                {sfSearchResults.length > 0 && (
                  <div style={{ marginTop: "12px", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                    {sfSearchResults.map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleSelectSalesforceAccount(result.id)}
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          backgroundColor: "#fff",
                          transition: "background-color 0.15s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#fff"}
                      >
                        <div style={{ fontWeight: 500, color: "#1e293b" }}>{result.name}</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {[result.industry, result.type, result.website].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sfSearchResults.length === 0 && sfSearchQuery && !sfSearching && (
                  <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "8px" }}>
                    No accounts found. Try a different search term.
                  </p>
                )}
              </>
            )}
          </div>

          <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleAnalyze}
              disabled={isAnalyzing || isBuilding || isUploading || (!urlInput.trim() && uploadedDocs.length === 0)}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Sources"}
            </button>
            <button
              style={{
                ...styles.button,
                ...styles.secondaryButton,
                fontSize: "12px",
                padding: "6px 10px",
              }}
              onClick={() => setShowTransparencyModal("preview")}
            >
              View Prompt
            </button>
          </div>
        </div>
      )}

      {/* Salesforce Enrichment Preview */}
      {sfEnrichment && !draft && (
        <div style={styles.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{
              backgroundColor: "#e0f2fe",
              color: "#0369a1",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
            }}>
              Salesforce
            </span>
            <h3 style={{ margin: 0 }}>Import Preview</h3>
          </div>

          <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>{sfEnrichment.name}</h4>
            {sfEnrichment.industry && (
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#64748b" }}>
                <strong>Industry:</strong> {sfEnrichment.industry}
              </p>
            )}
            {sfEnrichment.website && (
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#64748b" }}>
                <strong>Website:</strong> {sfEnrichment.website}
              </p>
            )}
            <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#475569" }}>
              {sfEnrichment.overview}
            </p>

            {sfEnrichment.keyFacts.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <strong style={{ fontSize: "13px", color: "#64748b" }}>Key Facts:</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                  {sfEnrichment.keyFacts.map((fact, idx) => (
                    <span key={idx} style={{
                      backgroundColor: "#e0e7ff",
                      color: "#4338ca",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}>
                      {fact.label}: {fact.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={applySalesforceEnrichment}
            >
              Use This Data
            </button>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => setSfEnrichment(null)}
            >
              Cancel
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px" }}>
            This will create a draft profile. You can edit all fields before saving, or add URLs/documents to enrich further.
          </p>
        </div>
      )}

      {/* Step 2: Analysis Result */}
      {analysisResult && !draft && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Analysis Result</h3>
          <p style={{ color: "#475569", marginBottom: "12px" }}>
            {analysisResult.sourcePreview}
          </p>

          {analysisResult.urlAlreadyUsed && (
            <div
              style={{
                backgroundColor: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <strong style={{ color: "#92400e" }}>⚠️ URLs Already Used</strong>
              <p style={{ color: "#78350f", fontSize: "14px", margin: "4px 0 0" }}>
                These URLs were previously used to build &quot;
                {analysisResult.urlAlreadyUsed.profileName}&quot;.
              </p>
            </div>
          )}

          <div
            style={{
              backgroundColor:
                analysisResult.suggestion.action === "create_new"
                  ? "#dcfce7"
                  : "#e0e7ff",
              border: `1px solid ${analysisResult.suggestion.action === "create_new" ? "#86efac" : "#a5b4fc"}`,
              borderRadius: "6px",
              padding: "12px",
              marginBottom: "12px",
            }}
          >
            <strong
              style={{
                color:
                  analysisResult.suggestion.action === "create_new"
                    ? "#166534"
                    : "#3730a3",
              }}
            >
              {analysisResult.suggestion.action === "create_new"
                ? "✨ Create New Profile"
                : "📝 Update Existing Profile"}
            </strong>
            {analysisResult.suggestion.suggestedName && (
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {analysisResult.suggestion.suggestedName}
              </p>
            )}
            <p style={{ color: "#475569", fontSize: "14px", margin: "4px 0 0" }}>
              {analysisResult.suggestion.reason}
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() =>
                  handleBuild(
                    analysisResult.suggestion.existingProfileId
                      ? { profileId: analysisResult.suggestion.existingProfileId }
                      : undefined
                  )
                }
                disabled={isBuilding}
              >
                {isBuilding ? (
                  <>
                    Building...
                  </>
                ) : analysisResult.suggestion.action === "create_new" ? (
                  "Build Profile"
                ) : (
                  "Update Profile"
                )}
              </button>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setAnalysisResult(null)}
                disabled={isBuilding}
              >
                Cancel
              </button>
            </div>
            {analyzeTransparency && (
              <button
                style={{
                  ...styles.button,
                  ...styles.secondaryButton,
                  fontSize: "12px",
                  padding: "6px 10px",
                }}
                onClick={() => setShowTransparencyModal("analyze")}
              >
                View Prompt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Edit Draft */}
      {draft && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>
              Review & Edit Profile
            </h3>
            {buildTransparency && (
              <button
                style={{
                  ...styles.button,
                  ...styles.secondaryButton,
                  fontSize: "12px",
                  padding: "6px 10px",
                }}
                onClick={() => setShowTransparencyModal("build")}
              >
                View Prompt
              </button>
            )}
          </div>

          <label style={styles.label}>Company Name *</label>
          <input
            style={styles.input}
            value={draft.name}
            onChange={(e) => updateDraft("name", e.target.value)}
          />

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Industry</label>
              <input
                style={styles.input}
                value={draft.industry || ""}
                onChange={(e) => updateDraft("industry", e.target.value)}
                placeholder="e.g., Healthcare, FinTech"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Website</label>
              <input
                style={styles.input}
                value={draft.website || ""}
                onChange={(e) => updateDraft("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>

          <label style={styles.label}>Overview *</label>
          <textarea
            style={{ ...styles.textarea, minHeight: "150px" }}
            value={draft.overview}
            onChange={(e) => updateDraft("overview", e.target.value)}
          />

          <label style={styles.label}>Products & Services</label>
          <textarea
            style={styles.textarea}
            value={draft.products || ""}
            onChange={(e) => updateDraft("products", e.target.value)}
            placeholder="Description of main products and services..."
          />

          <label style={styles.label}>Challenges & Needs</label>
          <textarea
            style={styles.textarea}
            value={draft.challenges || ""}
            onChange={(e) => updateDraft("challenges", e.target.value)}
            placeholder="Known business challenges, pain points, or focus areas..."
          />

          <label style={styles.label}>Key Facts</label>
          {(draft.keyFacts || []).map((fact, idx) => (
            <div key={idx} style={styles.keyFact}>
              <input
                style={{ ...styles.input, width: "150px" }}
                value={fact.label}
                onChange={(e) => updateKeyFact(idx, "label", e.target.value)}
                placeholder="Label"
              />
              <input
                style={{ ...styles.input, flex: 1 }}
                value={fact.value}
                onChange={(e) => updateKeyFact(idx, "value", e.target.value)}
                placeholder="Value"
              />
              <button
                style={{
                  ...styles.button,
                  ...styles.secondaryButton,
                  padding: "8px 12px",
                }}
                onClick={() => removeKeyFact(idx)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              marginTop: "8px",
            }}
            onClick={addKeyFact}
          >
            + Add Fact
          </button>

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
            }}
          >
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => {
                setDraft(null);
                setSourceUrls([]);
                setUploadedDocs([]);
              }}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleSave}
              disabled={isSaving || !draft.name.trim() || !draft.overview.trim()}
            >
              {isSaving ? (
                <>
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </button>
          </div>
        </div>
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
