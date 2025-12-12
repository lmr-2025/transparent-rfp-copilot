"use client";

import { useState } from "react";
import Link from "next/link";
import { createProfile } from "@/lib/customerProfileApi";
import {
  loadCustomerProfileSections,
  buildCustomerProfilePromptFromSections,
} from "@/lib/customerProfilePromptSections";
import {
  CustomerProfileDraft,
  CustomerProfileKeyFact,
  CustomerProfileSourceUrl,
} from "@/types/customerProfile";

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
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    backgroundColor: "#e0e7ff",
    color: "#4338ca",
    borderRadius: "4px",
    fontSize: "12px",
    marginRight: "4px",
    marginBottom: "4px",
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

  // Step 1: Analyze URLs
  const handleAnalyze = async () => {
    setError(null);
    setSuccessMessage(null);
    setAnalysisResult(null);
    setDraft(null);

    const urls = urlInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      setError("Please enter at least one URL");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/customers/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrls: urls }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze URLs");
      }

      const data = (await response.json()) as AnalysisResult;
      setAnalysisResult(data);
      setSourceUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze URLs");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Build profile
  const handleBuild = async (forUpdate?: { profileId: string }) => {
    setError(null);
    setIsBuilding(true);

    try {
      const promptSections = loadCustomerProfileSections();
      const prompt = buildCustomerProfilePromptFromSections(promptSections);

      const response = await fetch("/api/customers/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls,
          prompt,
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
        tags: draft.tags || [],
        sourceUrls: sourceUrlsToSave,
        isActive: true,
      });

      setSuccessMessage(`Profile "${draft.name}" created successfully!`);
      setDraft(null);
      setUrlInput("");
      setSourceUrls([]);
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
          href="/customers/library"
          style={{ color: "#6366f1", textDecoration: "none" }}
        >
          View Library →
        </Link>
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {/* Step 1: URL Input */}
      {!draft && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
            Enter Customer URLs
          </h3>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "12px" }}>
            Paste URLs to the customer&apos;s website, about page, press releases, or
            case studies. One URL per line.
          </p>
          <textarea
            style={{ ...styles.textarea, minHeight: "120px" }}
            placeholder="https://example.com/about&#10;https://example.com/press/funding-announcement&#10;https://example.com/customers/case-study"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isAnalyzing || isBuilding}
          />
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleAnalyze}
              disabled={isAnalyzing || isBuilding || !urlInput.trim()}
            >
              {isAnalyzing ? (
                <>
                  Analyzing...
                </>
              ) : (
                "Analyze URLs"
              )}
            </button>
          </div>
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
        </div>
      )}

      {/* Step 3: Edit Draft */}
      {draft && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
            Review & Edit Profile
          </h3>

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

          <label style={styles.label}>Tags</label>
          <input
            style={styles.input}
            value={(draft.tags || []).join(", ")}
            onChange={(e) =>
              updateDraft(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim().toLowerCase())
                  .filter((t) => t)
              )
            }
            placeholder="healthcare, saas, enterprise (comma separated)"
          />
          <div style={{ marginTop: "8px" }}>
            {(draft.tags || []).map((tag, idx) => (
              <span key={idx} style={styles.tag}>
                {tag}
              </span>
            ))}
          </div>

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
    </div>
  );
}
