"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";

type CustomerDocument = {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  docType: string | null;
};

const DOC_TYPES = [
  { value: "proposal", label: "Past Proposal" },
  { value: "meeting_notes", label: "Meeting Notes" },
  { value: "requirements", label: "Requirements Doc" },
  { value: "contract", label: "Contract" },
  { value: "rfp", label: "RFP/Questionnaire" },
  { value: "other", label: "Other" },
];

const styles = {
  section: {
    marginTop: "16px",
    padding: "16px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 600,
    fontSize: "14px",
    color: "#334155",
    margin: 0,
  },
  badge: {
    backgroundColor: "#e0e7ff",
    color: "#4338ca",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 600,
  },
  uploadArea: {
    marginTop: "12px",
    padding: "20px",
    border: "2px dashed #cbd5e1",
    borderRadius: "8px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "border-color 0.2s, background-color 0.2s",
  },
  uploadAreaDragging: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  documentList: {
    marginTop: "12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  documentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "#fff",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
  },
  docTypeBadge: {
    fontSize: "11px",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: "#f1f5f9",
    color: "#64748b",
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
  },
  button: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
  },
};

type Props = {
  customerId: string;
  customerName: string;
};

export default function CustomerDocuments({ customerId, customerName }: Props) {
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Delete Document",
    message: "Delete this document? This cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");

  // Load documents when expanded
  useEffect(() => {
    if (expanded && documents.length === 0) {
      loadDocuments();
    }
  }, [expanded]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/documents`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load documents");
      setDocuments(data.data?.documents || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove extension for title
    setShowUploadForm(true);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle.trim());
    if (uploadDocType) formData.append("docType", uploadDocType);
    if (uploadDescription.trim()) formData.append("description", uploadDescription.trim());

    try {
      const res = await fetch(`/api/customers/${customerId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload document");

      // Add to list
      setDocuments((prev) => [data.data.document, ...prev]);

      // Reset form
      setUploadFile(null);
      setUploadTitle("");
      setUploadDocType("");
      setUploadDescription("");
      setShowUploadForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    const confirmed = await confirm();
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/customers/${customerId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete document");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete document");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeLabel = (docType: string | null) => {
    if (!docType) return null;
    const found = DOC_TYPES.find((t) => t.value === docType);
    return found?.label || docType;
  };

  return (
    <div style={styles.section}>
      {/* Header */}
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <h4 style={styles.title}>
          <FileText size={16} />
          Customer Documents
          {documents.length > 0 && <span style={styles.badge}>{documents.length}</span>}
        </h4>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {expanded && (
        <>
          {/* Help text */}
          <p style={{ fontSize: "13px", color: "#64748b", margin: "8px 0 12px 0" }}>
            Upload documents specific to {customerName}. These will only be used when this customer is selected.
          </p>

          {error && (
            <div style={{
              padding: "8px 12px",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              borderRadius: "6px",
              fontSize: "13px",
              marginBottom: "12px"
            }}>
              {error}
            </div>
          )}

          {/* Upload Area */}
          {!showUploadForm ? (
            <div
              style={{
                ...styles.uploadArea,
                ...(dragging ? styles.uploadAreaDragging : {}),
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />
              <Upload size={24} style={{ color: "#94a3b8", marginBottom: "8px" }} />
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Drop a file here or click to upload
              </p>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12px" }}>
                PDF, DOC, DOCX, XLSX, PPTX, TXT (max 20MB)
              </p>
            </div>
          ) : (
            /* Upload Form */
            <div style={{
              marginTop: "12px",
              padding: "16px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0"
            }}>
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                  Selected file: <strong>{uploadFile?.name}</strong>
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Title *
                </label>
                <input
                  style={styles.input}
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Document Type
                </label>
                <select
                  style={styles.input}
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                >
                  <option value="">Select type...</option>
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Description (optional)
                </label>
                <input
                  style={styles.input}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description of this document"
                />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#475569" }}
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadFile(null);
                    setUploadTitle("");
                    setUploadDocType("");
                    setUploadDescription("");
                  }}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  style={{ ...styles.button, backgroundColor: "#6366f1", color: "#fff" }}
                  onClick={handleUpload}
                  disabled={uploading || !uploadTitle.trim()}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          )}

          {/* Document List */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
              Loading documents...
            </div>
          ) : documents.length > 0 ? (
            <div style={styles.documentList}>
              {documents.map((doc) => (
                <div key={doc.id} style={styles.documentItem}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "14px" }}>{doc.title}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      {doc.filename} • {formatFileSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                      {doc.docType && (
                        <span style={{ ...styles.docTypeBadge, marginLeft: "8px" }}>
                          {getDocTypeLabel(doc.docType)}
                        </span>
                      )}
                    </div>
                    {doc.description && (
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                        {doc.description}
                      </div>
                    )}
                  </div>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#94a3b8",
                    }}
                    onClick={() => handleDelete(doc.id)}
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: "center",
              padding: "20px",
              color: "#94a3b8",
              fontSize: "13px"
            }}>
              No documents uploaded yet
            </div>
          )}
        </>
      )}
      <ConfirmDialog />
    </div>
  );
}
