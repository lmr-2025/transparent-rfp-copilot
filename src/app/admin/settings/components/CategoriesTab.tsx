"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, FolderOpen, GripVertical } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import { toast } from "sonner";
import { SkillCategoryItem } from "@/types/skill";
import {
  loadCategoriesFromApi,
  addCategory,
  updateCategory,
  deleteCategory,
  saveCategories,
} from "@/lib/categoryStorage";

export default function CategoriesTab() {
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCategoriesFromApi()
      .then(setCategories)
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  const handleAdd = async () => {
    setError(null);
    if (!newName.trim()) {
      setError("Category name is required");
      return;
    }
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
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Organize your skills into broad capability areas. Skills can belong to multiple categories.
      </p>

      {!showForm && !editingId && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-md text-sm font-medium hover:bg-indigo-600 mb-4"
        >
          <Plus size={16} />
          Add Category
        </button>
      )}

      {showForm && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
          <h4 className="font-medium mb-3">Add Category</h4>
          {error && (
            <div className="mb-3">
              <InlineError message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Security & Compliance"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Brief description (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md text-sm font-medium hover:bg-indigo-600"
            >
              Add Category
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); setNewName(""); setNewDescription(""); }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoadingCategories ? (
        <div className="p-8 text-center">
          <div className="flex justify-center mb-2">
            <InlineLoader size="lg" className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <FolderOpen size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No categories yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className={`p-3 rounded-lg border flex items-center gap-3 ${
                editingId === cat.id ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"
              }`}
            >
              <button
                onClick={() => moveCategory(index, "up")}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <GripVertical size={14} />
              </button>

              {editingId === cat.id ? (
                <div className="flex-1">
                  {error && <div className="mb-2"><InlineError message={error} onDismiss={() => setError(null)} /></div>}
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1"
                  />
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(cat.id)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
                      Save
                    </button>
                    <button onClick={cancelEdit} className="px-3 py-1 bg-white border border-gray-300 text-gray-600 rounded text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={14} className="text-indigo-500" />
                      <span className="font-medium text-sm">{cat.name}</span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-gray-500 ml-5 mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  <button onClick={() => startEdit(cat)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
