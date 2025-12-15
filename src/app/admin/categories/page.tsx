"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, FolderOpen, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SkillCategoryItem } from "@/types/skill";
import {
  loadCategoriesFromApi,
  addCategory,
  updateCategory,
  deleteCategory,
  saveCategories,
} from "@/lib/categoryStorage";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Load categories from API on mount
  useEffect(() => {
    loadCategoriesFromApi()
      .then(setCategories)
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setIsLoadingCategories(false));
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    setError(null);

    if (!newName.trim()) {
      setError("Category name is required");
      return;
    }

    // Check for duplicates
    if (categories.some((cat) => cat.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError("A category with this name already exists");
      return;
    }

    setIsSaving(true);
    try {
      const added = await addCategory(newName, newDescription);
      setCategories([...categories, added]);
      setNewName("");
      setNewDescription("");
      setShowForm(false);
      toast.success("Category created");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      toast.error(message);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setError(null);

    if (!newName.trim()) {
      setError("Category name is required");
      return;
    }

    // Check for duplicates (excluding current category)
    if (categories.some((cat) => cat.id !== id && cat.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError("A category with this name already exists");
      return;
    }

    setIsSaving(true);
    try {
      await updateCategory(id, { name: newName.trim(), description: newDescription.trim() || undefined });
      setCategories(categories.map((cat) =>
        cat.id === id ? { ...cat, name: newName.trim(), description: newDescription.trim() || undefined } : cat
      ));
      setEditingId(null);
      setNewName("");
      setNewDescription("");
      toast.success("Category updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update category";
      toast.error(message);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCategory(id);
      setCategories(categories.filter((cat) => cat.id !== id));
      toast.success("Category deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete category";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (cat: SkillCategoryItem) => {
    setEditingId(cat.id);
    setNewName(cat.name);
    setNewDescription(cat.description || "");
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewName("");
    setNewDescription("");
    setError(null);
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const newCategories = [...categories];
    [newCategories[index], newCategories[newIndex]] = [newCategories[newIndex], newCategories[index]];
    setCategories(newCategories);
    saveCategories(newCategories);
  };

  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
          Skill Categories
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Organize your skills into broad capability areas. Skills can belong to multiple categories.
          Drag to reorder, or use the arrows.
        </p>
      </div>

      {/* Add Category Button */}
      {!showForm && !editingId && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "24px",
          }}
        >
          <Plus size={18} />
          Add Category
        </button>
      )}

      {/* Add Category Form */}
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
          <h3 style={{ marginBottom: "16px", fontWeight: 600 }}>Add Category</h3>

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
              Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Security & Compliance"
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
              placeholder="Brief description of what this category covers"
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
              disabled={isSaving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: isSaving ? "#a5b4fc" : "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isSaving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? "Adding..." : "Add Category"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
                setNewName("");
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

      {/* Category List */}
      {isLoadingCategories ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          <p>Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px dashed #cbd5e1",
          }}
        >
          <FolderOpen size={48} style={{ color: "#94a3b8", marginBottom: "12px" }} />
          <p style={{ color: "#64748b", marginBottom: "4px" }}>No categories yet</p>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Add categories to organize your skills
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              style={{
                padding: "12px 16px",
                backgroundColor: editingId === cat.id ? "#f0f9ff" : "#fff",
                borderRadius: "8px",
                border: editingId === cat.id ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Drag handle / reorder buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <button
                  onClick={() => moveCategory(index, "up")}
                  disabled={index === 0}
                  style={{
                    padding: "2px",
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: index === 0 ? "not-allowed" : "pointer",
                    opacity: index === 0 ? 0.3 : 1,
                    color: "#64748b",
                  }}
                  title="Move up"
                >
                  <GripVertical size={14} />
                </button>
              </div>

              {editingId === cat.id ? (
                /* Edit mode */
                <div style={{ flex: 1 }}>
                  {error && (
                    <div
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#fef2f2",
                        color: "#dc2626",
                        borderRadius: "4px",
                        marginBottom: "12px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {error}
                    </div>
                  )}
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Category name"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      marginBottom: "8px",
                    }}
                  />
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description (optional)"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      marginBottom: "8px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleUpdate(cat.id)}
                      disabled={isSaving}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        backgroundColor: isSaving ? "#93c5fd" : "#3b82f6",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isSaving ? "not-allowed" : "pointer",
                        fontSize: "0.85rem",
                        fontWeight: 500,
                      }}
                    >
                      {isSaving && <Loader2 size={14} className="animate-spin" />}
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#fff",
                        color: "#64748b",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FolderOpen size={16} style={{ color: "#6366f1" }} />
                      <span style={{ fontWeight: 600 }}>{cat.name}</span>
                    </div>
                    {cat.description && (
                      <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "4px 0 0 24px" }}>
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(cat)}
                    style={{
                      padding: "8px",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#3b82f6",
                      borderRadius: "4px",
                    }}
                    title="Edit category"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={deletingId === cat.id}
                    style={{
                      padding: "8px",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: deletingId === cat.id ? "not-allowed" : "pointer",
                      color: "#ef4444",
                      borderRadius: "4px",
                      opacity: deletingId === cat.id ? 0.5 : 1,
                    }}
                    title="Delete category"
                  >
                    {deletingId === cat.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div
        style={{
          marginTop: "32px",
          padding: "16px",
          backgroundColor: "#f0f9ff",
          borderRadius: "8px",
          borderLeft: "3px solid #3b82f6",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#1e40af" }}>
          <strong>How categories work:</strong> Categories help organize your skills into broad
          capability areas. When building skills, the AI will suggest categories based on content.
          Skills can belong to multiple categories. Use the Library page to filter skills by category.
        </p>
      </div>
    </div>
  );
}
