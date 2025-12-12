"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChatPrompt,
  CategoryConfig,
  loadUserPrompts,
  addUserPrompt,
  updateUserPrompt,
  updateBuiltInPrompt,
  resetBuiltInPrompt,
  deleteUserPrompt,
  getEffectiveBuiltInPrompts,
  isBuiltInModified,
  getEffectiveCategories,
  addCustomCategory,
  updateCategory,
  deleteCategory,
  resetCategoryToDefault,
  isCategoryModified,
  categoryColorPresets,
} from "@/lib/chatPromptLibrary";

type EditingPrompt = {
  id: string | null; // null = new prompt
  title: string;
  prompt: string;
  category: string;
  isBuiltIn?: boolean; // true when editing a built-in prompt
};

type EditingCategory = {
  id: string | null; // null = new category
  label: string;
  description: string;
  color: { bg: string; text: string; border: string };
  isBuiltIn: boolean;
};

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    margin: "0 0 8px 0",
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
    margin: 0,
    fontSize: "15px",
  },
  statsBar: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  statCard: {
    padding: "12px 20px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "16px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    backgroundColor: "#fff",
    cursor: "pointer",
  },
  categoryBadge: (color: { bg: string; text: string; border: string }) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    backgroundColor: color.bg,
    color: color.text,
    border: `1px solid ${color.border}`,
  }),
  promptCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "10px",
    backgroundColor: "#fff",
    transition: "box-shadow 0.15s",
  },
  modal: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "800px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  },
};

export default function PromptLibraryPage() {
  const [userPrompts, setUserPrompts] = useState<ChatPrompt[]>([]);
  const [builtInPrompts, setBuiltInPrompts] = useState<ChatPrompt[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [editingPrompt, setEditingPrompt] = useState<EditingPrompt | null>(null);
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingResetId, setConfirmingResetId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [confirmingCategoryDeleteId, setConfirmingCategoryDeleteId] = useState<string | null>(null);

  const reloadAll = () => {
    setUserPrompts(loadUserPrompts());
    setBuiltInPrompts(getEffectiveBuiltInPrompts());
    setCategories(getEffectiveCategories());
  };

  useEffect(() => {
    reloadAll();
  }, []);

  // Helper to get category config by id
  const getCategoryConfig = (id: string): CategoryConfig | undefined => {
    return categories.find(c => c.id === id);
  };

  const allPrompts = [...builtInPrompts, ...userPrompts];

  const filteredPrompts = allPrompts.filter(p => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch = search === "" ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const promptsByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = filteredPrompts.filter(p => p.category === cat.id);
    return acc;
  }, {} as Record<string, ChatPrompt[]>);

  const handleSavePrompt = () => {
    if (!editingPrompt || !editingPrompt.title.trim() || !editingPrompt.prompt.trim()) return;

    if (editingPrompt.id && editingPrompt.isBuiltIn) {
      // Update built-in prompt (saves as override)
      updateBuiltInPrompt(editingPrompt.id, {
        title: editingPrompt.title,
        prompt: editingPrompt.prompt,
        category: editingPrompt.category,
      });
    } else if (editingPrompt.id) {
      // Update existing user prompt
      updateUserPrompt(editingPrompt.id, {
        title: editingPrompt.title,
        prompt: editingPrompt.prompt,
        category: editingPrompt.category,
      });
    } else {
      // Create new prompt
      addUserPrompt(editingPrompt.title, editingPrompt.prompt, editingPrompt.category);
    }

    reloadAll();
    setEditingPrompt(null);
  };

  const handleDeletePrompt = (id: string) => {
    deleteUserPrompt(id);
    reloadAll();
    setConfirmingDeleteId(null);
  };

  const handleResetBuiltIn = (id: string) => {
    resetBuiltInPrompt(id);
    reloadAll();
    setConfirmingResetId(null);
  };

  // Category management handlers
  const handleSaveCategory = () => {
    if (!editingCategory || !editingCategory.label.trim()) return;

    if (editingCategory.id) {
      updateCategory(editingCategory.id, {
        label: editingCategory.label,
        description: editingCategory.description,
        color: editingCategory.color,
      });
    } else {
      addCustomCategory(
        editingCategory.label,
        editingCategory.description,
        editingCategory.color
      );
    }

    reloadAll();
    setEditingCategory(null);
  };

  const handleDeleteCategory = (id: string) => {
    deleteCategory(id);
    reloadAll();
    setConfirmingCategoryDeleteId(null);
  };

  const handleResetCategory = (id: string) => {
    resetCategoryToDefault(id);
    reloadAll();
  };

  const openNewPrompt = () => {
    setEditingPrompt({
      id: null,
      title: "",
      prompt: "",
      category: "custom",
    });
  };

  const openEditPrompt = (prompt: ChatPrompt) => {
    setEditingPrompt({
      id: prompt.id,
      title: prompt.title,
      prompt: prompt.prompt,
      category: prompt.category,
      isBuiltIn: prompt.isBuiltIn,
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={styles.title}>Prompt Library</h1>
            <p style={styles.subtitle}>
              Pre-built prompts for GTM collateral, sales enablement, and customer communications.
              Use these with <Link href="/chat" style={{ color: "#2563eb" }}>Chat with Knowledge</Link>.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewPrompt}
            style={{ ...styles.button, backgroundColor: "#2563eb", color: "#fff" }}
          >
            + New Prompt
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b" }}>{builtInPrompts.length}</span>
          <span style={{ marginLeft: "8px", color: "#64748b", fontSize: "14px" }}>Built-in</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b" }}>{userPrompts.length}</span>
          <span style={{ marginLeft: "8px", color: "#64748b", fontSize: "14px" }}>Custom</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowCategoryManager(!showCategoryManager)}
          style={{
            ...styles.button,
            backgroundColor: showCategoryManager ? "#1e293b" : "#f1f5f9",
            color: showCategoryManager ? "#fff" : "#475569",
            marginRight: "12px",
          }}
        >
          {showCategoryManager ? "Hide Categories" : "Manage Categories"}
        </button>
        <Link href="/prompts" style={{ color: "#64748b", fontSize: "14px" }}>
          ← Back to System Prompts
        </Link>
      </div>

      {/* Filters */}
      <div style={{ ...styles.card, display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search prompts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            style={{
              ...styles.button,
              backgroundColor: activeCategory === "all" ? "#1e293b" : "#f1f5f9",
              color: activeCategory === "all" ? "#fff" : "#475569",
            }}
          >
            All ({allPrompts.length})
          </button>
          {categories.map(cat => {
            const count = allPrompts.filter(p => p.category === cat.id).length;
            if (count === 0 && cat.id !== "custom") return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  ...styles.button,
                  backgroundColor: activeCategory === cat.id ? cat.color.text : cat.color.bg,
                  color: activeCategory === cat.id ? "#fff" : cat.color.text,
                  border: `1px solid ${cat.color.border}`,
                }}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Manager */}
      {showCategoryManager && (
        <div style={{ ...styles.card, marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Manage Categories</h3>
            <button
              type="button"
              onClick={() => setEditingCategory({
                id: null,
                label: "",
                description: "",
                color: categoryColorPresets[0],
                isBuiltIn: false,
              })}
              style={{ ...styles.button, backgroundColor: "#2563eb", color: "#fff" }}
            >
              + New Category
            </button>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            {categories.map(cat => (
              <div
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  backgroundColor: cat.color.bg,
                  borderRadius: "6px",
                  border: `1px solid ${cat.color.border}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: cat.color.text, fontSize: "14px" }}>
                    {cat.label}
                    {cat.isBuiltIn && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: "#94a3b8", fontWeight: 400 }}>
                        Built-in
                      </span>
                    )}
                    {isCategoryModified(cat.id) && (
                      <span style={{ marginLeft: "8px", fontSize: "10px", color: "#d97706", backgroundColor: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                        Modified
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{cat.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCategory({
                    id: cat.id,
                    label: cat.label,
                    description: cat.description,
                    color: cat.color,
                    isBuiltIn: cat.isBuiltIn,
                  })}
                  style={{ ...styles.button, backgroundColor: "#fff", color: "#475569", border: "1px solid #e2e8f0", padding: "6px 10px", fontSize: "12px" }}
                >
                  Edit
                </button>
                {isCategoryModified(cat.id) && (
                  <button
                    type="button"
                    onClick={() => handleResetCategory(cat.id)}
                    style={{ ...styles.button, backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", padding: "6px 10px", fontSize: "12px" }}
                  >
                    Reset
                  </button>
                )}
                {!cat.isBuiltIn && (
                  confirmingCategoryDeleteId === cat.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        style={{ ...styles.button, backgroundColor: "#dc2626", color: "#fff", padding: "6px 10px", fontSize: "12px" }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCategoryDeleteId(null)}
                        style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#475569", padding: "6px 10px", fontSize: "12px" }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingCategoryDeleteId(cat.id)}
                      style={{ ...styles.button, backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 10px", fontSize: "12px" }}
                    >
                      Delete
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompts by Category */}
      {activeCategory === "all" ? (
        // Show all categories
        categories.map(cat => {
          const prompts = promptsByCategory[cat.id] || [];
          if (prompts.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: "32px" }}>
              <div style={{ marginBottom: "12px" }}>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", color: cat.color.text }}>
                  {cat.label}
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  {cat.description}
                </p>
              </div>
              <div style={{ display: "grid", gap: "10px" }}>
                {prompts.map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    categoryConfig={getCategoryConfig(prompt.category)}
                    isExpanded={expandedPromptId === prompt.id}
                    onToggle={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
                    onEdit={() => openEditPrompt(prompt)}
                    onDelete={() => setConfirmingDeleteId(prompt.id)}
                    onReset={() => setConfirmingResetId(prompt.id)}
                    isConfirmingDelete={confirmingDeleteId === prompt.id}
                    isConfirmingReset={confirmingResetId === prompt.id}
                    onConfirmDelete={() => handleDeletePrompt(prompt.id)}
                    onCancelDelete={() => setConfirmingDeleteId(null)}
                    onConfirmReset={() => handleResetBuiltIn(prompt.id)}
                    onCancelReset={() => setConfirmingResetId(null)}
                    isModified={prompt.isBuiltIn && isBuiltInModified(prompt.id)}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        // Show single category
        (() => {
          const activeCat = getCategoryConfig(activeCategory);
          return (
            <div>
              <div style={{ marginBottom: "12px" }}>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", color: activeCat?.color.text || "#1e293b" }}>
                  {activeCat?.label || activeCategory}
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  {activeCat?.description || ""}
                </p>
              </div>
              {filteredPrompts.length === 0 ? (
                <div style={{ ...styles.card, textAlign: "center", color: "#64748b", padding: "40px" }}>
                  No prompts found. {activeCategory === "custom" && (
                    <button
                      type="button"
                      onClick={openNewPrompt}
                      style={{ ...styles.button, backgroundColor: "#2563eb", color: "#fff", marginLeft: "12px" }}
                    >
                      Create one
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {filteredPrompts.map(prompt => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      categoryConfig={getCategoryConfig(prompt.category)}
                      isExpanded={expandedPromptId === prompt.id}
                      onToggle={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
                      onEdit={() => openEditPrompt(prompt)}
                      onDelete={() => setConfirmingDeleteId(prompt.id)}
                      onReset={() => setConfirmingResetId(prompt.id)}
                      isConfirmingDelete={confirmingDeleteId === prompt.id}
                      isConfirmingReset={confirmingResetId === prompt.id}
                      onConfirmDelete={() => handleDeletePrompt(prompt.id)}
                      onCancelDelete={() => setConfirmingDeleteId(null)}
                      onConfirmReset={() => handleResetBuiltIn(prompt.id)}
                      onCancelReset={() => setConfirmingResetId(null)}
                      isModified={prompt.isBuiltIn && isBuiltInModified(prompt.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Edit/Create Modal */}
      {editingPrompt && (
        <div style={styles.modal} onClick={() => setEditingPrompt(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                {editingPrompt.isBuiltIn
                  ? "Edit Built-in Prompt"
                  : editingPrompt.id
                  ? "Edit Prompt"
                  : "New Prompt"}
              </h3>
              {editingPrompt.isBuiltIn && (
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Changes will apply for all users. You can reset to the original default at any time.
                </p>
              )}
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <label style={{ fontWeight: 600, fontSize: "14px" }}>
                    Title
                  </label>
                  <span style={{
                    fontSize: "11px",
                    color: editingPrompt.title.length > 180 ? "#dc2626" : "#94a3b8",
                  }}>
                    {editingPrompt.title.length} / 200
                  </span>
                </div>
                <input
                  type="text"
                  value={editingPrompt.title}
                  onChange={e => setEditingPrompt({ ...editingPrompt, title: e.target.value.slice(0, 200) })}
                  placeholder="e.g., SOC 2 questionnaire helper"
                  style={styles.input}
                  maxLength={200}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "14px" }}>
                  Category
                </label>
                <select
                  value={editingPrompt.category}
                  onChange={e => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                  style={styles.select}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <label style={{ fontWeight: 600, fontSize: "14px" }}>
                    Prompt Text
                  </label>
                  <span style={{
                    fontSize: "12px",
                    color: editingPrompt.prompt.length > 45000 ? "#dc2626" : "#94a3b8",
                  }}>
                    {editingPrompt.prompt.length.toLocaleString()} / 50,000
                  </span>
                </div>
                <textarea
                  value={editingPrompt.prompt}
                  onChange={e => setEditingPrompt({ ...editingPrompt, prompt: e.target.value.slice(0, 50000) })}
                  placeholder="Write the prompt that will be sent to the AI. You can include detailed instructions, examples, formatting requirements, and more..."
                  rows={12}
                  style={{ ...styles.textarea, minHeight: "250px", lineHeight: 1.6 }}
                  maxLength={50000}
                />
                <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  This prompt will be combined with your knowledge base when used in Chat.
                  You can write detailed, multi-paragraph prompts with specific instructions.
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setEditingPrompt(null)}
                  style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#475569" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  disabled={!editingPrompt.title.trim() || !editingPrompt.prompt.trim()}
                  style={{
                    ...styles.button,
                    backgroundColor: editingPrompt.title.trim() && editingPrompt.prompt.trim() ? "#2563eb" : "#94a3b8",
                    color: "#fff",
                    cursor: editingPrompt.title.trim() && editingPrompt.prompt.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {editingPrompt.id ? "Save Changes" : "Create Prompt"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Edit Modal */}
      {editingCategory && (
        <div style={styles.modal} onClick={() => setEditingCategory(null)}>
          <div style={{ ...styles.modalContent, maxWidth: "500px" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                {editingCategory.id ? "Edit Category" : "New Category"}
              </h3>
              {editingCategory.isBuiltIn && (
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Editing a built-in category. Changes apply for all users.
                </p>
              )}
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <label style={{ fontWeight: 600, fontSize: "14px" }}>
                    Label
                  </label>
                  <span style={{
                    fontSize: "11px",
                    color: editingCategory.label.length > 90 ? "#dc2626" : "#94a3b8",
                  }}>
                    {editingCategory.label.length} / 100
                  </span>
                </div>
                <input
                  type="text"
                  value={editingCategory.label}
                  onChange={e => setEditingCategory({ ...editingCategory, label: e.target.value.slice(0, 100) })}
                  placeholder="e.g., Security Assessments"
                  style={styles.input}
                  maxLength={100}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <label style={{ fontWeight: 600, fontSize: "14px" }}>
                    Description
                  </label>
                  <span style={{
                    fontSize: "11px",
                    color: editingCategory.description.length > 450 ? "#dc2626" : "#94a3b8",
                  }}>
                    {editingCategory.description.length} / 500
                  </span>
                </div>
                <input
                  type="text"
                  value={editingCategory.description}
                  onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value.slice(0, 500) })}
                  placeholder="Brief description of this category"
                  style={styles.input}
                  maxLength={500}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "8px", fontSize: "14px" }}>
                  Color
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {categoryColorPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditingCategory({ ...editingCategory, color: { bg: preset.bg, text: preset.text, border: preset.border } })}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: preset.bg,
                        border: editingCategory.color.bg === preset.bg
                          ? `3px solid ${preset.text}`
                          : `1px solid ${preset.border}`,
                        cursor: "pointer",
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  style={{ ...styles.button, backgroundColor: "#f1f5f9", color: "#475569" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  disabled={!editingCategory.label.trim()}
                  style={{
                    ...styles.button,
                    backgroundColor: editingCategory.label.trim() ? "#2563eb" : "#94a3b8",
                    color: "#fff",
                    cursor: editingCategory.label.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {editingCategory.id ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Prompt Card Component
function PromptCard({
  prompt,
  categoryConfig,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onReset,
  isConfirmingDelete,
  isConfirmingReset,
  onConfirmDelete,
  onCancelDelete,
  onConfirmReset,
  onCancelReset,
  isModified,
}: {
  prompt: ChatPrompt;
  categoryConfig?: CategoryConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReset: () => void;
  isConfirmingDelete: boolean;
  isConfirmingReset: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
  isModified: boolean;
}) {
  const color = categoryConfig?.color || { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
  const label = categoryConfig?.label || prompt.category;

  return (
    <div style={styles.promptCard}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}
        onClick={onToggle}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "15px", color: "#1e293b" }}>{prompt.title}</span>
            <span style={styles.categoryBadge(color)}>
              {label}
            </span>
            {prompt.isBuiltIn && (
              <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>Built-in</span>
            )}
            {isModified && (
              <span style={{
                fontSize: "10px",
                color: "#d97706",
                backgroundColor: "#fef3c7",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600,
              }}>
                Modified
              </span>
            )}
          </div>
          {!isExpanded && (
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: 1.4 }}>
              {prompt.prompt.length > 120 ? prompt.prompt.substring(0, 120) + "..." : prompt.prompt}
            </p>
          )}
        </div>
        <span style={{ color: "#94a3b8", fontSize: "12px", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{
            backgroundColor: "#f8fafc",
            padding: "12px",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#334155",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            marginBottom: "12px",
          }}>
            {prompt.prompt}
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Link
              href={`/chat?prompt=${encodeURIComponent(prompt.prompt)}`}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid #86efac",
              }}
            >
              Use in Chat →
            </Link>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "#f1f5f9",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid #e2e8f0",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
            {/* Reset to default for modified built-in prompts */}
            {prompt.isBuiltIn && isModified && (
              <>
                {isConfirmingReset ? (
                  <>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onConfirmReset(); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#d97706",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onCancelReset(); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onReset(); }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "1px solid #fcd34d",
                      cursor: "pointer",
                    }}
                  >
                    Reset to Default
                  </button>
                )}
              </>
            )}
            {/* Delete for user prompts only */}
            {!prompt.isBuiltIn && (
              <>
                {isConfirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onConfirmDelete(); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onCancelDelete(); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      backgroundColor: "#fef2f2",
                      color: "#dc2626",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "1px solid #fecaca",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
