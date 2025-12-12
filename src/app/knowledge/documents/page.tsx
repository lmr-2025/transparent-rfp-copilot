"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, FileText, File, Loader2 } from "lucide-react";

interface DocumentMeta {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill title from filename if empty
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      setUploadError("Please select a file and enter a title");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload document");
      }

      setDocuments([data.document, ...documents]);
      resetForm();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments(documents.filter((d) => d.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const resetForm = () => {
    setShowUploadForm(false);
    setTitle("");
    setDescription("");
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") {
      return <FileText size={20} style={{ color: "#ef4444" }} />;
    }
    return <File size={20} style={{ color: "#3b82f6" }} />;
  };

  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
          Knowledge Documents
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Upload documents (PDF, Word, TXT) that will be searched when skills don&apos;t have the answer.
          Great for reference materials and internal documentation.
        </p>
      </div>

      {/* Upload Button */}
      {!showUploadForm && (
        <button
          onClick={() => setShowUploadForm(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#0ea5e9",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "24px",
          }}
        >
          <Upload size={18} />
          Upload Document
        </button>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ marginBottom: "16px", fontWeight: 600 }}>Upload Document</h3>

          {uploadError && (
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "#fef2f2",
                color: "#dc2626",
                borderRadius: "6px",
                marginBottom: "16px",
                fontSize: "0.9rem",
              }}
            >
              {uploadError}
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              File *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                backgroundColor: "#fff",
              }}
            />
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
              Supported formats: PDF, DOC, DOCX, TXT (max 10MB recommended)
            </p>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., SOC2 Type II Report 2024"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.95rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this document contains"
              rows={2}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.95rem",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: isUploading || !selectedFile ? "#94a3b8" : "#0ea5e9",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isUploading || !selectedFile ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload
                </>
              )}
            </button>
            <button
              onClick={resetForm}
              disabled={isUploading}
              style={{
                padding: "10px 20px",
                backgroundColor: "#fff",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Document List */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          <p>Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px dashed #cbd5e1",
          }}
        >
          <FileText size={48} style={{ color: "#94a3b8", marginBottom: "12px" }} />
          <p style={{ color: "#64748b", marginBottom: "4px" }}>No documents uploaded yet</p>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Upload SOC2 reports, security policies, or other compliance documentation
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                padding: "16px",
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", gap: "12px", flex: 1 }}>
                <div style={{ paddingTop: "2px" }}>{getFileIcon(doc.fileType)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{doc.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "4px" }}>
                    {doc.filename} • {formatFileSize(doc.fileSize)} • {doc.fileType.toUpperCase()}
                  </div>
                  {doc.description && (
                    <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
                      {doc.description}
                    </p>
                  )}
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                style={{
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444",
                  borderRadius: "4px",
                }}
                title="Delete document"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div
        style={{
          marginTop: "32px",
          padding: "16px",
          backgroundColor: "#eff6ff",
          borderRadius: "8px",
          borderLeft: "3px solid #3b82f6",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#1e40af" }}>
          <strong>How it works:</strong> When a question doesn&apos;t match any skills, the assistant
          searches your uploaded documents for relevant information. The source will appear in the
          Reasoning section of the response.
        </p>
      </div>
    </div>
  );
}
