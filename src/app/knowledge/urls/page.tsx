"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ExternalLink, Globe } from "lucide-react";
import { ReferenceUrl } from "@/types/referenceUrl";
import {
  loadReferenceUrls,
  addReferenceUrl,
  deleteReferenceUrl,
} from "@/lib/referenceUrlStorage";

export default function ReferenceUrlsPage() {
  const [urls, setUrls] = useState<ReferenceUrl[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrls(loadReferenceUrls());
  }, []);

  const handleAdd = () => {
    setError(null);

    if (!newUrl.trim()) {
      setError("URL is required");
      return;
    }

    if (!newTitle.trim()) {
      setError("Title is required");
      return;
    }

    // Basic URL validation
    try {
      new URL(newUrl.trim());
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    const added = addReferenceUrl({
      url: newUrl.trim(),
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
    });

    setUrls([...urls, added]);
    setNewUrl("");
    setNewTitle("");
    setNewDescription("");
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    deleteReferenceUrl(id);
    setUrls(urls.filter((u) => u.id !== id));
  };

  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
          Reference URLs
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          External URLs that GRC Minion will search when skills don&apos;t have the answer.
          These are fetched as fallback context for answering questions.
        </p>
      </div>

      {/* Add URL Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
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
          <Plus size={18} />
          Add Reference URL
        </button>
      )}

      {/* Add URL Form */}
      {showForm && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ marginBottom: "16px", fontWeight: 600 }}>Add Reference URL</h3>

          {error && (
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
              {error}
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              Title *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Trust Center, Security Whitepaper"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.95rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              URL *
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/security"
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
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description of what this page contains"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.95rem",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleAdd}
              style={{
                padding: "10px 20px",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Add URL
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
                setNewUrl("");
                setNewTitle("");
                setNewDescription("");
              }}
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

      {/* URL List */}
      {urls.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px dashed #cbd5e1",
          }}
        >
          <Globe size={48} style={{ color: "#94a3b8", marginBottom: "12px" }} />
          <p style={{ color: "#64748b", marginBottom: "4px" }}>No reference URLs added yet</p>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Add external URLs like your trust center or security documentation
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {urls.map((url) => (
            <div
              key={url.id}
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
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <Globe size={16} style={{ color: "#0ea5e9" }} />
                  <span style={{ fontWeight: 600 }}>{url.title}</span>
                </div>
                <a
                  href={url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#0ea5e9",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: url.description ? "8px" : "0",
                  }}
                >
                  {url.url}
                  <ExternalLink size={12} />
                </a>
                {url.description && (
                  <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                    {url.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(url.id)}
                style={{
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444",
                  borderRadius: "4px",
                }}
                title="Delete URL"
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
          <strong>How it works:</strong> When a question doesn&apos;t match any skills, GRC Minion
          will fetch and search these URLs for relevant information. The source will appear in the
          Reasoning section of the response.
        </p>
      </div>
    </div>
  );
}
