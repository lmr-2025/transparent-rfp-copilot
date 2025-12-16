"use client";

import { useRef, useState } from "react";
import { FileText, Link as LinkIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/utils";
import { type DocumentSource } from "@/stores/bulk-import-store";
import { styles } from "./styles";

type InputMode = "urls" | "documents";

type SourceInputStepProps = {
  urlInput: string;
  setUrlInput: (value: string) => void;
  uploadedDocuments: DocumentSource[];
  addUploadedDocument: (doc: DocumentSource) => void;
  removeUploadedDocument: (id: string) => void;
  onStartAnalysis: () => void;
  parsedUrls: string[];
};

export default function SourceInputStep({
  urlInput,
  setUrlInput,
  uploadedDocuments,
  addUploadedDocument,
  removeUploadedDocument,
  onStartAnalysis,
  parsedUrls,
}: SourceInputStepProps) {
  const [inputMode, setInputMode] = useState<InputMode>("urls");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        formData.append("title", nameWithoutExt);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const json = await response.json();

        if (!response.ok) {
          throw new Error(getApiErrorMessage(json, `Failed to upload ${file.name}`));
        }

        const data = json.data ?? json;
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canAnalyze = parsedUrls.length > 0 || uploadedDocuments.length > 0;

  return (
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
          onClick={onStartAnalysis}
          disabled={!canAnalyze}
          style={{
            padding: "10px 20px",
            backgroundColor: canAnalyze ? "#2563eb" : "#cbd5e1",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: canAnalyze ? "pointer" : "not-allowed",
          }}
        >
          Analyze Sources →
        </button>
      </div>
    </div>
  );
}
