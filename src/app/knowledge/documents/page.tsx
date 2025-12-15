"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, FileText, File, Loader2, X, ChevronDown, LayoutTemplate } from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";

interface CategoryItem {
  id: string;
  name: string;
  description?: string;
}

interface DocumentMeta {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  categories?: string[];
  isTemplate?: boolean;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Document",
    message: "Are you sure you want to delete this document?",
    confirmLabel: "Delete",
    variant: "danger",
  });
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
    // Load categories from API
    loadCategoriesFromApi().then(setAvailableCategories).catch(console.error);
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
      if (selectedCategories.length > 0) {
        formData.append("categories", JSON.stringify(selectedCategories));
      }
      if (saveAsTemplate) {
        formData.append("saveAsTemplate", "true");
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
    const confirmed = await confirmDelete();
    if (!confirmed) return;

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
    setSelectedCategories([]);
    setShowCategoryDropdown(false);
    setSaveAsTemplate(false);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
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
    if (fileType === "pptx") {
      return <FileText size={20} style={{ color: "#f97316" }} />; // Orange for PowerPoint
    }
    return <File size={20} style={{ color: "#3b82f6" }} />;
  };

  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <ConfirmDialog />
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
              accept=".pdf,.doc,.docx,.txt,.pptx"
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
              Supported formats: PDF, DOC, DOCX, PPTX, TXT (max 10MB recommended)
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

          {/* Categories */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              Categories (optional)
            </label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  backgroundColor: "#fff",
                  fontSize: "0.95rem",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: selectedCategories.length === 0 ? "#9ca3af" : "inherit" }}>
                  {selectedCategories.length === 0
                    ? "Select categories..."
                    : `${selectedCategories.length} selected`}
                </span>
                <ChevronDown size={16} style={{ color: "#64748b" }} />
              </button>

              {showCategoryDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: "4px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    zIndex: 50,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {availableCategories.map((cat) => (
                    <label
                      key={cat.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.name)}
                        onChange={() => toggleCategory(cat.name)}
                        style={{ width: "16px", height: "16px" }}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                  {availableCategories.length === 0 && (
                    <div style={{ padding: "10px 12px", color: "#64748b", fontSize: "0.9rem" }}>
                      No categories available. Create some in the Categories page.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected categories pills */}
            {selectedCategories.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {selectedCategories.map((cat) => (
                  <span
                    key={cat}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                    }}
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <X size={14} style={{ color: "#0369a1" }} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Save as Template checkbox */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: "pointer",
                padding: "12px",
                backgroundColor: saveAsTemplate ? "#fef3c7" : "#fff",
                border: saveAsTemplate ? "1px solid #fcd34d" : "1px solid #e2e8f0",
                borderRadius: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                style={{ width: "18px", height: "18px", marginTop: "2px" }}
              />
              <div>
                <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
                  <LayoutTemplate size={16} style={{ color: "#d97706" }} />
                  Save as Template
                </div>
                <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "4px 0 0 0" }}>
                  Generate a markdown template from this document. Use templates in chat to have the AI fill them in with knowledge from your skills.
                </p>
              </div>
            </label>
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
                  <div style={{ fontWeight: 600, marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {doc.title}
                    {doc.isTemplate && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        <LayoutTemplate size={12} />
                        Template
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "4px" }}>
                    {doc.filename} • {formatFileSize(doc.fileSize)} • {doc.fileType.toUpperCase()}
                  </div>
                  {doc.description && (
                    <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
                      {doc.description}
                    </p>
                  )}
                  {doc.categories && doc.categories.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                      {doc.categories.map((cat) => (
                        <span
                          key={cat}
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
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
