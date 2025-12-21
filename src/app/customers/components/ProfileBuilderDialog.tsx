"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createProfile, updateProfile } from "@/lib/customerProfileApi";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Types
type UploadedDocument = {
  name: string;
  content: string;
  size: number;
  file: File;
  processForContent: boolean;
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
  region: string | null;
  tier: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  accountType: string | null;
  billingLocation: string | null;
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

type ProfileBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type Step = "input" | "analysis" | "salesforce_preview" | "draft";

export default function ProfileBuilderDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProfileBuilderDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyContentWarning, setEmptyContentWarning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<CustomerProfileDraft | null>(null);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [updateProfileId, setUpdateProfileId] = useState<string | null>(null);

  // Document upload state
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
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
  const [salesforceStaticFields, setSalesforceStaticFields] = useState<SalesforceEnrichment | null>(null);

  // Check if Salesforce is configured on mount
  useEffect(() => {
    if (open) {
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
    }
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("input");
      setUrlInput("");
      setError(null);
      setAnalysisResult(null);
      setDraft(null);
      setSourceUrls([]);
      setUploadedDocs([]);
      setSfEnrichment(null);
      setSfSearchQuery("");
      setSfSearchResults([]);
      setSalesforceStaticFields(null);
      setUpdateProfileId(null);
      setEmptyContentWarning(false);
    }
  }, [open]);

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
      const json = await response.json();
      const data = parseApiData<{ enrichment: SalesforceEnrichment }>(json);
      setSfEnrichment(data.enrichment);
      setSfSearchResults([]);
      setSfSearchQuery("");
      setStep("salesforce_preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account from Salesforce");
    } finally {
      setSfLoading(false);
    }
  };

  // Apply Salesforce enrichment to create a draft
  const applySalesforceEnrichment = () => {
    if (!sfEnrichment) return;

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
    setSalesforceStaticFields(sfEnrichment);
    setSfEnrichment(null);
    setStep("draft");
  };

  // Handle file upload
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

      const MAX_FILE_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} exceeds 20MB limit`);
        continue;
      }

      newDocs.push({
        name: file.name,
        content: "",
        size: file.size,
        file: file,
        processForContent: true,
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
      // Extract content from documents
      const docsToProcess = uploadedDocs.filter(doc => doc.processForContent);
      if (docsToProcess.length > 0 && !docsToProcess.every(doc => doc.content)) {
        setIsUploading(true);
        for (let i = 0; i < docsToProcess.length; i++) {
          const doc = docsToProcess[i];
          if (doc.content) continue;

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

            const docIndex = uploadedDocs.findIndex(d => d.name === doc.name);
            if (docIndex >= 0) {
              setUploadedDocs(prev => {
                const updated = [...prev];
                updated[docIndex] = { ...updated[docIndex], content: data.document.content };
                return updated;
              });
            }

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

      const json = await response.json();
      const data = parseApiData<AnalysisResult>(json);
      setAnalysisResult(data);
      setSourceUrls(urls);
      if (data.transparency) {
        setAnalyzeTransparency(data.transparency);
      }
      setStep("analysis");
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
      let existingProfileData = null;
      if (forUpdate) {
        const profileResponse = await fetch(`/api/customers/${forUpdate.profileId}`);
        if (!profileResponse.ok) {
          throw new Error("Failed to fetch existing profile");
        }
        const profileJson = await profileResponse.json();
        const profile = parseApiData<{ profile: { name: string; content?: string; overview?: string } }>(profileJson);
        existingProfileData = {
          name: profile.profile.name,
          content: profile.profile.content || profile.profile.overview || "",
        };
        setUpdateProfileId(forUpdate.profileId);
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

      const json = await response.json();
      const data = parseApiData<{ draft: CustomerProfileDraft; transparency?: TransparencyData }>(json);
      setDraft(data.draft);
      setAnalysisResult(null);
      if (data.transparency) {
        setBuildTransparency(data.transparency);
      }

      if (!data.draft.content?.trim()) {
        setEmptyContentWarning(true);
      }
      setStep("draft");
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

      const sourceDocuments: CustomerProfileSourceDocument[] = uploadedDocs.map(doc => ({
        id: "",
        filename: doc.name,
        uploadedAt: now,
      }));

      let savedProfile;

      if (updateProfileId) {
        savedProfile = await updateProfile(updateProfileId, {
          name: draft.name,
          industry: draft.industry,
          website: draft.website,
          content: draft.content,
          considerations: draft.considerations || [],
          overview: draft.content,
          sourceUrls: sourceUrlsToSave,
          sourceDocuments,
        });
      } else {
        savedProfile = await createProfile({
          name: draft.name,
          industry: draft.industry,
          website: draft.website,
          content: draft.content,
          considerations: draft.considerations || [],
          overview: draft.content,
          keyFacts: [],
          sourceUrls: sourceUrlsToSave,
          sourceDocuments,
          isActive: true,
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

      // Attach uploaded documents
      if (uploadedDocs.length > 0) {
        try {
          const formData = new FormData();
          uploadedDocs.forEach((doc) => {
            formData.append("files", doc.file);
          });
          formData.append("processForContent", JSON.stringify(uploadedDocs.map(doc => doc.processForContent)));

          await fetch(`/api/customers/${savedProfile.id}/documents/batch`, {
            method: "POST",
            body: formData,
          });
        } catch (err) {
          console.error("Failed to batch upload documents:", err);
        }
      }

      onSuccess();
      onOpenChange(false);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === "input" && "Add Customer Profile"}
              {step === "analysis" && "Analysis Result"}
              {step === "salesforce_preview" && "Salesforce Import"}
              {step === "draft" && "Review & Edit Profile"}
            </DialogTitle>
            <DialogDescription>
              {step === "input" && "Build customer intelligence from websites, documents, or Salesforce."}
              {step === "analysis" && "Review what we found and build the profile."}
              {step === "salesforce_preview" && "Review the data from Salesforce."}
              {step === "draft" && "Review and edit the profile before saving."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Input */}
          {step === "input" && (
            <div className="space-y-4">
              {/* URL Input */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Source URLs
                </label>
                <p className="text-sm text-muted-foreground mb-2">
                  Paste URLs to the customer&apos;s website, about page, press releases, or case studies. One URL per line.
                </p>
                <Textarea
                  placeholder={"https://example.com/about\nhttps://example.com/press/funding"}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isAnalyzing || isBuilding || isUploading}
                  className="min-h-[100px]"
                />
              </div>

              {/* Document Upload */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium mb-2 block">
                  Upload Documents
                </label>
                <p className="text-sm text-muted-foreground mb-2">
                  PDF, DOC, DOCX, or TXT files
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isAnalyzing || isBuilding || isUploading}
                />

                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing || isBuilding || isUploading}
                >
                  {isUploading ? "Processing..." : "Upload Documents"}
                </Button>

                {/* Upload Progress */}
                {isUploading && uploadProgress && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium text-blue-700">
                        Processing file {uploadProgress.current} of {uploadProgress.total}
                      </span>
                    </div>
                    <div className="text-sm text-blue-800">{uploadProgress.currentFileName}</div>
                    <div className="mt-2 h-1 bg-blue-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Uploaded Documents */}
                {uploadedDocs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-muted-foreground bg-slate-50 p-2 rounded">
                      Select which files to process for profile content
                    </div>
                    {uploadedDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-100 rounded"
                      >
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={doc.processForContent}
                            onChange={() => toggleProcessContent(idx)}
                            disabled={isAnalyzing || isBuilding}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">
                            {doc.name}{" "}
                            <span className="text-muted-foreground text-xs">
                              ({Math.round(doc.size / 1024)} KB)
                            </span>
                          </span>
                        </label>
                        <button
                          className="text-muted-foreground hover:text-foreground p-1"
                          onClick={() => removeDocument(idx)}
                          disabled={isAnalyzing || isBuilding}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Salesforce Import */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">Or import from</span>
                  <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded text-xs font-medium">
                    Salesforce
                  </span>
                </div>

                {salesforceConfigured === false && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-3">
                    <p className="text-sm text-muted-foreground">
                      Salesforce integration is not configured.{" "}
                      <Link href="/admin/settings" className="text-primary hover:underline">
                        Set up Salesforce
                      </Link>
                    </p>
                  </div>
                )}

                {salesforceConfigured === null && (
                  <p className="text-sm text-muted-foreground">Checking Salesforce connection...</p>
                )}

                {salesforceConfigured && (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search Salesforce accounts by name..."
                        value={sfSearchQuery}
                        onChange={(e) => setSfSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSalesforceSearch()}
                        disabled={sfSearching || sfLoading}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={handleSalesforceSearch}
                        disabled={sfSearching || sfLoading || sfSearchQuery.length < 2}
                      >
                        {sfSearching ? "Searching..." : "Search"}
                      </Button>
                    </div>

                    {sfSearchResults.length > 0 && (
                      <div className="mt-2 border rounded-md overflow-hidden">
                        {sfSearchResults.map((result) => (
                          <div
                            key={result.id}
                            onClick={() => handleSelectSalesforceAccount(result.id)}
                            className="p-3 border-b last:border-b-0 cursor-pointer hover:bg-slate-50"
                          >
                            <div className="font-medium">{result.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[result.industry, result.type, result.website].filter(Boolean).join(" - ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTransparencyModal("preview")}
                >
                  View Prompt
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || isBuilding || isUploading || (!urlInput.trim() && uploadedDocs.length === 0)}
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze Sources"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Analysis Result */}
          {step === "analysis" && analysisResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{analysisResult.sourcePreview}</p>

              {analysisResult.urlAlreadyUsed && (
                <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
                  <strong className="text-amber-800">URLs Already Used</strong>
                  <p className="text-sm text-amber-700 mt-1">
                    These URLs were previously used to build &quot;{analysisResult.urlAlreadyUsed.profileName}&quot;.
                  </p>
                </div>
              )}

              <div className={cn(
                "rounded-md p-4",
                analysisResult.suggestion.action === "create_new"
                  ? "bg-green-50 border border-green-200"
                  : "bg-indigo-50 border border-indigo-200"
              )}>
                <strong className={analysisResult.suggestion.action === "create_new" ? "text-green-800" : "text-indigo-800"}>
                  {analysisResult.suggestion.action === "create_new" ? "Create New Profile" : "Update Existing Profile"}
                </strong>
                {analysisResult.suggestion.suggestedName && (
                  <p className="font-semibold mt-1">{analysisResult.suggestion.suggestedName}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">{analysisResult.suggestion.reason}</p>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                {analyzeTransparency && (
                  <Button variant="outline" size="sm" onClick={() => setShowTransparencyModal("analyze")}>
                    View Prompt
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={() => setStep("input")}>
                    Back
                  </Button>
                  <Button
                    onClick={() =>
                      handleBuild(
                        analysisResult.suggestion.existingProfileId
                          ? { profileId: analysisResult.suggestion.existingProfileId }
                          : undefined
                      )
                    }
                    disabled={isBuilding}
                  >
                    {isBuilding
                      ? "Building..."
                      : analysisResult.suggestion.action === "create_new"
                      ? "Build Profile"
                      : "Update Profile"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Salesforce Preview */}
          {step === "salesforce_preview" && sfEnrichment && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-md p-4">
                <h4 className="font-semibold text-lg mb-2">{sfEnrichment.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {sfEnrichment.industry && (
                    <div><span className="text-muted-foreground">Industry:</span> {sfEnrichment.industry}</div>
                  )}
                  {sfEnrichment.website && (
                    <div><span className="text-muted-foreground">Website:</span> {sfEnrichment.website}</div>
                  )}
                  {sfEnrichment.region && (
                    <div><span className="text-muted-foreground">Region:</span> {sfEnrichment.region}</div>
                  )}
                  {sfEnrichment.tier && (
                    <div><span className="text-muted-foreground">Tier:</span> {sfEnrichment.tier}</div>
                  )}
                  {sfEnrichment.employeeCount && (
                    <div><span className="text-muted-foreground">Employees:</span> {sfEnrichment.employeeCount.toLocaleString()}</div>
                  )}
                  {sfEnrichment.annualRevenue && (
                    <div><span className="text-muted-foreground">Revenue:</span> ${(sfEnrichment.annualRevenue / 1000000).toFixed(1)}M</div>
                  )}
                </div>
                <p className="mt-3 text-sm">{sfEnrichment.overview}</p>
                {sfEnrichment.keyFacts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sfEnrichment.keyFacts.map((fact, idx) => (
                      <span key={idx} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">
                        {fact.label}: {fact.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Fields like Region, Tier, Location will be synced from Salesforce and cannot be edited directly.
              </p>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => { setSfEnrichment(null); setStep("input"); }}>
                  Cancel
                </Button>
                <Button onClick={applySalesforceEnrichment}>
                  Use This Data
                </Button>
              </div>
            </div>
          )}

          {/* Step: Draft Editor */}
          {step === "draft" && draft && (
            <div className="space-y-4">
              {emptyContentWarning && (
                <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
                  <strong className="text-amber-800">Content extraction failed</strong>
                  <p className="text-sm text-amber-700 mt-1">
                    The AI was unable to extract profile content. You can retry or manually fill in the content below.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => { setEmptyContentWarning(false); handleBuild(); }} disabled={isBuilding}>
                      {isBuilding ? "Retrying..." : "Retry Build"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEmptyContentWarning(false)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">Company Name *</label>
                <Input
                  value={draft.name}
                  onChange={(e) => updateDraft("name", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Industry</label>
                  <Input
                    value={draft.industry || ""}
                    onChange={(e) => updateDraft("industry", e.target.value)}
                    placeholder="e.g., Healthcare, FinTech"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Website</label>
                  <Input
                    value={draft.website || ""}
                    onChange={(e) => updateDraft("website", e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Profile Content * <span className="font-normal text-muted-foreground">(Markdown supported)</span>
                </label>
                <Textarea
                  className="min-h-[200px] font-mono text-sm"
                  value={draft.content}
                  onChange={(e) => updateDraft("content", e.target.value)}
                  placeholder="## Overview&#10;Company overview...&#10;&#10;## Products & Services&#10;Their main offerings..."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Considerations <span className="font-normal text-muted-foreground">(Special notes)</span>
                </label>
                {(draft.considerations || []).map((consideration, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <Input
                      className="flex-1"
                      value={consideration}
                      onChange={(e) => updateConsideration(idx, e.target.value)}
                      placeholder="e.g., Highly regulated industry"
                    />
                    <Button variant="outline" size="sm" onClick={() => removeConsideration(idx)}>
                      &times;
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addConsideration}>
                  + Add Consideration
                </Button>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                {buildTransparency && (
                  <Button variant="outline" size="sm" onClick={() => setShowTransparencyModal("build")}>
                    View Prompt
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft(null);
                      setSourceUrls([]);
                      setEmptyContentWarning(false);
                      setSalesforceStaticFields(null);
                      setUpdateProfileId(null);
                      setStep("input");
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !draft.name.trim() || !draft.content?.trim()}
                  >
                    {isSaving ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transparency Modals */}
      {showTransparencyModal === "analyze" && analyzeTransparency && (
        <TransparencyModal
          title="Analysis Prompt"
          subtitle="The prompts used to analyze your sources"
          headerColor="purple"
          onClose={() => setShowTransparencyModal(null)}
          configs={[
            { label: "Model", value: analyzeTransparency.model, color: "purple" },
            { label: "Max Tokens", value: analyzeTransparency.maxTokens, color: "blue" },
            { label: "Temperature", value: analyzeTransparency.temperature, color: "yellow" },
          ]}
          systemPrompt={analyzeTransparency.systemPrompt}
          systemPromptNote="This prompt instructs the AI on how to identify the customer."
          userPrompt={analyzeTransparency.userPrompt}
          userPromptLabel="User Prompt (with source content)"
          userPromptNote="This includes your source URLs/documents."
        />
      )}

      {showTransparencyModal === "build" && buildTransparency && (
        <TransparencyModal
          title="Profile Generation Prompt"
          subtitle="The prompts used to structure the customer profile"
          headerColor="blue"
          onClose={() => setShowTransparencyModal(null)}
          configs={[
            { label: "Model", value: buildTransparency.model, color: "purple" },
            { label: "Max Tokens", value: buildTransparency.maxTokens, color: "blue" },
            { label: "Temperature", value: buildTransparency.temperature, color: "yellow" },
          ]}
          systemPrompt={buildTransparency.systemPrompt}
          systemPromptNote="This prompt defines the structure to extract for the customer profile."
          userPrompt={buildTransparency.userPrompt}
          userPromptLabel="User Prompt (with source material)"
          userPromptNote="This includes all the source content."
        />
      )}

      {showTransparencyModal === "preview" && (
        <TransparencyModal
          title="Profile Extraction Prompt"
          subtitle="The system prompt sent to the LLM when building a customer profile"
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
              This prompt can be customized in the <Link href="/admin/prompt-library" className="text-primary">Prompt Library</Link>.
            </>
          }
        />
      )}
    </>
  );
}
