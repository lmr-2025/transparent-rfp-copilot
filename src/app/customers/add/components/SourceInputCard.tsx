"use client";

import { useRef } from "react";
import Link from "next/link";
import { styles } from "./styles";
import { UploadedDocument, SalesforceSearchResult, SalesforceEnrichment } from "./types";

type UploadProgress = {
  current: number;
  total: number;
  currentFileName: string;
};

type SourceInputCardProps = {
  urlInput: string;
  setUrlInput: (value: string) => void;
  isAnalyzing: boolean;
  isBuilding: boolean;
  isUploading: boolean;
  uploadProgress: UploadProgress | null;
  uploadedDocs: UploadedDocument[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveDocument: (index: number) => void;
  onToggleProcessContent: (index: number) => void;
  onAnalyze: () => void;
  onViewPrompt: () => void;
  // Salesforce props
  salesforceConfigured: boolean | null;
  sfSearchQuery: string;
  setSfSearchQuery: (value: string) => void;
  sfSearchResults: SalesforceSearchResult[];
  sfSearching: boolean;
  sfLoading: boolean;
  onSalesforceSearch: () => void;
  onSelectSalesforceAccount: (accountId: string) => void;
};

export default function SourceInputCard({
  urlInput,
  setUrlInput,
  isAnalyzing,
  isBuilding,
  isUploading,
  uploadProgress,
  uploadedDocs,
  onFileUpload,
  onRemoveDocument,
  onToggleProcessContent,
  onAnalyze,
  onViewPrompt,
  salesforceConfigured,
  sfSearchQuery,
  setSfSearchQuery,
  sfSearchResults,
  sfSearching,
  sfLoading,
  onSalesforceSearch,
  onSelectSalesforceAccount,
}: SourceInputCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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
          onChange={onFileUpload}
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

        {/* Upload Progress Indicator */}
        {isUploading && uploadProgress && (
          <div style={{
            marginTop: "12px",
            padding: "12px",
            backgroundColor: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{
                width: "16px",
                height: "16px",
                border: "2px solid #0ea5e9",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#0369a1" }}>
                Processing file {uploadProgress.current} of {uploadProgress.total}
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "#0c4a6e", marginBottom: "8px" }}>
              {uploadProgress.currentFileName}
            </div>
            <div style={{
              height: "4px",
              backgroundColor: "#e0f2fe",
              borderRadius: "2px",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                backgroundColor: "#0ea5e9",
                transition: "width 0.3s ease",
              }} />
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Show uploaded documents */}
        {uploadedDocs.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <div style={{
              fontSize: "13px",
              color: "#64748b",
              marginBottom: "8px",
              padding: "8px 12px",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}>
              <strong>Select which files to process for profile content:</strong>
              <div style={{ fontSize: "12px", marginTop: "4px", color: "#94a3b8" }}>
                ✓ Checked files will be analyzed and added to the profile content<br/>
                ✗ Unchecked files will only be stored as reference documents
              </div>
            </div>
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
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  cursor: "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={doc.processForContent}
                    onChange={() => onToggleProcessContent(idx)}
                    disabled={isAnalyzing || isBuilding}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                    }}
                  />
                  <span style={{ fontSize: "14px", color: "#475569", flex: 1 }}>
                    📄 {doc.name}{" "}
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                      ({Math.round(doc.size / 1024)} KB)
                    </span>
                  </span>
                </label>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    fontSize: "16px",
                    padding: "0 4px",
                  }}
                  onClick={() => onRemoveDocument(idx)}
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
                onKeyDown={(e) => e.key === "Enter" && onSalesforceSearch()}
                disabled={sfSearching || sfLoading}
              />
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={onSalesforceSearch}
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
                    onClick={() => onSelectSalesforceAccount(result.id)}
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
          onClick={onAnalyze}
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
          onClick={onViewPrompt}
        >
          View Prompt
        </button>
      </div>
    </div>
  );
}
