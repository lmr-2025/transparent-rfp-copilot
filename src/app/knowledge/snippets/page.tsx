"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmModal";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Copy,
  Loader2,
  FileCode,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

interface ContextSnippet {
  id: string;
  name: string;
  key: string;
  content: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#1e293b",
    margin: "0 0 8px 0",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "0.95rem",
    margin: 0,
    lineHeight: 1.5,
  },
  controls: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    flex: "1",
    minWidth: "200px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    flex: 1,
    fontSize: "0.9rem",
    backgroundColor: "transparent",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  primaryButton: {
    backgroundColor: "#0ea5e9",
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    marginBottom: "12px",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "16px 20px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    cursor: "pointer",
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    color: "#1e293b",
    margin: "0 0 4px 0",
  },
  cardKey: {
    fontFamily: "monospace",
    fontSize: "0.85rem",
    color: "#0ea5e9",
    backgroundColor: "#f0f9ff",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  cardDescription: {
    color: "#64748b",
    fontSize: "0.85rem",
    marginTop: "6px",
  },
  cardContent: {
    padding: "0 20px 16px 20px",
    borderTop: "1px solid #f1f5f9",
  },
  contentPreview: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "0.85rem",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap" as const,
    maxHeight: "200px",
    overflow: "auto",
    color: "#334155",
  },
  category: {
    fontSize: "0.75rem",
    padding: "3px 8px",
    backgroundColor: "#f1f5f9",
    color: "#64748b",
    borderRadius: "4px",
    fontWeight: 500,
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px dashed #cbd5e1",
  },
  modal: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    maxWidth: "600px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
  },
  modalHeader: {
    padding: "20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalBody: {
    padding: "20px",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontWeight: 500,
    fontSize: "0.9rem",
    color: "#374151",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.9rem",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.9rem",
    fontFamily: "monospace",
    minHeight: "150px",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  },
  hint: {
    fontSize: "0.8rem",
    color: "#6b7280",
    marginTop: "4px",
  },
  modalFooter: {
    padding: "16px 20px",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },
  infoBox: {
    backgroundColor: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "24px",
  },
};

const SUGGESTED_CATEGORIES = [
  "Company",
  "Product",
  "Compliance",
  "Values",
  "Customers",
  "Technical",
];

export default function ContextSnippetsPage() {
  const router = useRouter();
  const [snippets, setSnippets] = useState<ContextSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Snippet",
    message: "This cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<ContextSnippet | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    content: "",
    category: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load snippets
  useEffect(() => {
    const loadSnippets = async () => {
      try {
        const response = await fetch("/api/context-snippets?active=false");
        if (response.ok) {
          const data = await response.json();
          setSnippets(data);
        }
      } catch (error) {
        console.error("Failed to load snippets:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSnippets();
  }, []);

  // Filter snippets
  const filteredSnippets = useMemo(() => {
    if (!searchQuery) return snippets;
    const query = searchQuery.toLowerCase();
    return snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        s.category?.toLowerCase().includes(query)
    );
  }, [snippets, searchQuery]);

  // Group by category
  const groupedSnippets = useMemo(() => {
    const groups: Record<string, ContextSnippet[]> = {};
    filteredSnippets.forEach((snippet) => {
      const cat = snippet.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(snippet);
    });
    return groups;
  }, [filteredSnippets]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openCreateModal = () => {
    setEditingSnippet(null);
    setFormData({ name: "", key: "", content: "", category: "", description: "" });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (snippet: ContextSnippet) => {
    setEditingSnippet(snippet);
    setFormData({
      name: snippet.name,
      key: snippet.key,
      content: snippet.content,
      category: snippet.category || "",
      description: snippet.description || "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError(null);

    // Validate
    if (!formData.name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!formData.key.trim()) {
      setFormError("Key is required");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      setFormError("Key must be lowercase letters, numbers, and underscores, starting with a letter");
      return;
    }
    if (!formData.content.trim()) {
      setFormError("Content is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSnippet
        ? `/api/context-snippets/${editingSnippet.id}`
        : "/api/context-snippets";
      const method = editingSnippet ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          key: formData.key.trim(),
          content: formData.content.trim(),
          category: formData.category.trim() || null,
          description: formData.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save snippet");
      }

      const savedSnippet = await response.json();

      if (editingSnippet) {
        setSnippets((prev) => prev.map((s) => (s.id === savedSnippet.id ? savedSnippet : s)));
      } else {
        setSnippets((prev) => [...prev, savedSnippet]);
      }

      setShowModal(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (snippet: ContextSnippet) => {
    const confirmed = await confirmDelete({
      message: `Delete "${snippet.name}"? This cannot be undone.`,
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/context-snippets/${snippet.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSnippets((prev) => prev.filter((s) => s.id !== snippet.id));
      }
    } catch (error) {
      console.error("Failed to delete snippet:", error);
      toast.error("Failed to delete snippet");
    }
  };

  // Auto-generate key from name
  const generateKeyFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/^[0-9_]+/, "")
      .slice(0, 50);
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Loader2 size={40} className="animate-spin" style={{ color: "#0ea5e9", margin: "0 auto 16px" }} />
          <p style={{ color: "#64748b" }}>Loading snippets...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <ConfirmDialog />
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Link href="/knowledge" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.9rem" }}>
            ← Knowledge
          </Link>
        </div>
        <h1 style={styles.title}>Context Snippets</h1>
        <p style={styles.subtitle}>
          Reusable text blocks for instruction presets. Use <code style={{ backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>{"{{key}}"}</code> syntax to insert snippets.
        </p>
      </div>

      {/* Info Box */}
      <div style={styles.infoBox}>
        <div style={{ fontWeight: 600, marginBottom: "8px", color: "#0369a1" }}>
          How to use snippets
        </div>
        <p style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#334155" }}>
          Create snippets for company boilerplate like your company description, value props, or certifications.
          Then reference them in instruction presets using the variable syntax:
        </p>
        <code style={{
          display: "block",
          backgroundColor: "#fff",
          padding: "10px",
          borderRadius: "4px",
          fontSize: "0.85rem",
          color: "#0369a1",
        }}>
          Always mention our certifications: {"{{company_certifications}}"}
        </code>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.searchBox}>
          <Search size={18} style={{ color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <X size={16} style={{ color: "#94a3b8" }} />
            </button>
          )}
        </div>

        <button
          onClick={openCreateModal}
          style={{ ...styles.button, ...styles.primaryButton }}
        >
          <Plus size={18} />
          Add Snippet
        </button>
      </div>

      {/* Snippets List */}
      {filteredSnippets.length === 0 ? (
        <div style={styles.emptyState}>
          <FileCode size={48} style={{ color: "#94a3b8", marginBottom: "12px" }} />
          <p style={{ color: "#64748b", marginBottom: "4px", fontWeight: 500 }}>
            {searchQuery ? "No snippets match your search" : "No context snippets yet"}
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "16px" }}>
            Create reusable text blocks for company info, value props, certifications, etc.
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              <Plus size={18} />
              Create Your First Snippet
            </button>
          )}
        </div>
      ) : (
        Object.entries(groupedSnippets).map(([category, categorySnippets]) => (
          <div key={category} style={{ marginBottom: "24px" }}>
            <h3 style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}>
              {category} ({categorySnippets.length})
            </h3>

            {categorySnippets.map((snippet) => (
              <div key={snippet.id} style={styles.card}>
                <div
                  style={styles.cardHeader}
                  onClick={() => toggleExpand(snippet.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h4 style={styles.cardTitle}>{snippet.name}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyKey(snippet.key);
                        }}
                        style={{
                          ...styles.cardKey,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Click to copy"
                      >
                        {`{{${snippet.key}}}`}
                        {copiedKey === snippet.key ? (
                          <Check size={12} style={{ color: "#22c55e" }} />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                      {!snippet.isActive && (
                        <span style={{ ...styles.category, backgroundColor: "#fee2e2", color: "#dc2626" }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    {snippet.description && (
                      <p style={styles.cardDescription}>{snippet.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(snippet);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: "4px",
                        color: "#64748b",
                      }}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(snippet);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: "4px",
                        color: "#ef4444",
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedIds.has(snippet.id) ? (
                      <ChevronUp size={20} style={{ color: "#94a3b8" }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: "#94a3b8" }} />
                    )}
                  </div>
                </div>

                {expandedIds.has(snippet.id) && (
                  <div style={styles.cardContent}>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "8px", marginTop: "12px" }}>
                      Content Preview
                    </div>
                    <div style={styles.contentPreview}>
                      {snippet.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                {editingSnippet ? "Edit Snippet" : "Create Snippet"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} style={{ color: "#64748b" }} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {formError && (
                <div style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: "#dc2626",
                  fontSize: "0.9rem",
                }}>
                  {formError}
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name,
                      // Auto-generate key if creating new and key is empty or matches auto-generated
                      key: !editingSnippet && (!prev.key || prev.key === generateKeyFromName(prev.name))
                        ? generateKeyFromName(name)
                        : prev.key,
                    }));
                  }}
                  placeholder="e.g., Company Description"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Variable Key *</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData((prev) => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                  placeholder="e.g., company_description"
                  style={styles.input}
                />
                <p style={styles.hint}>
                  Use this key in presets: <code>{`{{${formData.key || "key"}}}`}</code>
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  style={styles.input}
                >
                  <option value="">Select a category...</option>
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this snippet contains"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="The actual text that will be inserted when this snippet is used..."
                  style={styles.textarea}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  ...styles.button,
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity: isSaving ? 0.7 : 1,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {editingSnippet ? "Save Changes" : "Create Snippet"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
