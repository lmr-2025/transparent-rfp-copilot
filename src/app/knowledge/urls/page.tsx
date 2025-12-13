"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ExternalLink, Globe, ChevronDown, X } from "lucide-react";
import { ReferenceUrl } from "@/types/referenceUrl";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";

interface CategoryItem {
  id: string;
  name: string;
  description?: string;
}

export default function ReferenceUrlsPage() {
  const [urls, setUrls] = useState<ReferenceUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load URLs from database API on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/reference-urls").then(res => res.json()),
      loadCategoriesFromApi(),
    ])
      .then(([urlData, cats]) => {
        setUrls(urlData.urls || []);
        setAvailableCategories(cats);
      })
      .catch(err => console.error("Failed to load data:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleAdd = async () => {
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

    try {
      const response = await fetch("/api/reference-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          categories: selectedCategories,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add URL");
      }

      const added = await response.json();
      setUrls([...urls, added]);
      setNewUrl("");
      setNewTitle("");
      setNewDescription("");
      setSelectedCategories([]);
      setShowCategoryDropdown(false);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add URL");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/reference-urls/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete URL");
      }

      setUrls(urls.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Failed to delete URL:", err);
    }
  };

  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
          Reference URLs
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          External URLs that will be searched when skills don&apos;t have the answer.
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
                setSelectedCategories([]);
                setShowCategoryDropdown(false);
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
      {isLoading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          Loading reference URLs...
        </div>
      ) : urls.length === 0 ? (
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
                {url.categories && url.categories.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                    {url.categories.map((cat) => (
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
          <strong>How it works:</strong> When a question doesn&apos;t match any skills, the assistant
          will fetch and search these URLs for relevant information. The source will appear in the
          Reasoning section of the response.
        </p>
      </div>
    </div>
  );
}
