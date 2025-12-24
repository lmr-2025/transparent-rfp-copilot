"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, Edit2, FileText, Eye, Copy, Check, Upload, Loader2, Sparkles, User } from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import type { TemplateResponse, CreateTemplateInput, PlaceholderMapping } from "@/types/template";
import { TEMPLATE_CATEGORIES, OUTPUT_FORMATS } from "@/types/template";
import { PlaceholderMappingEditor } from "./components/PlaceholderMappingEditor";
import { parseApiData } from "@/lib/apiClient";

type InstructionPreset = {
  id: string;
  name: string;
  description?: string;
  isShared: boolean;
  shareStatus: string;
};

type TemplateListItem = Omit<TemplateResponse, "content" | "placeholderHint" | "placeholderMappings">;

export default function TemplatesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateResponse | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<TemplateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instructionPresets, setInstructionPresets] = useState<InstructionPreset[]>([]);
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Delete Template",
    message: "Are you sure you want to delete this template?",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Fetch instruction presets
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const res = await fetch("/api/instruction-presets");
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData<{ presets: InstructionPreset[] }>(json);
          setInstructionPresets(data.presets || []);
        }
      } catch {
        // Silent failure - presets are optional
      }
    };
    loadPresets();
  }, []);

  // Form state
  const [formData, setFormData] = useState<CreateTemplateInput>({
    name: "",
    description: "",
    content: "",
    category: "",
    outputFormat: "markdown",
    placeholderHint: "",
    placeholderMappings: [],
    instructionPresetId: "",
    isActive: true,
    sortOrder: 0,
  });

  // Fetch templates list
  const {
    data: templates = [],
    isLoading,
  } = useApiQuery<TemplateListItem[]>({
    queryKey: ["admin-templates"],
    url: "/api/templates",
    params: { activeOnly: false },
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch single template for editing/viewing
  const fetchTemplate = async (id: string): Promise<TemplateResponse | null> => {
    try {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch template");
      const data = await res.json();
      return data.data;
    } catch {
      toast.error("Failed to load template");
      return null;
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      content: "",
      category: "",
      outputFormat: "markdown",
      placeholderHint: "",
      placeholderMappings: [],
      instructionPresetId: "",
      isActive: true,
      sortOrder: 0,
    });
    setError(null);
  };

  // Create template mutation
  const createMutation = useApiMutation<TemplateResponse, CreateTemplateInput>({
    url: "/api/templates",
    method: "POST",
    invalidateKeys: [["admin-templates"]],
    onSuccess: () => {
      toast.success("Template created");
      resetForm();
      setShowForm(false);
    },
    onError: (err) => {
      const message = err.message || "Failed to create template";
      setError(message);
      toast.error(message);
    },
  });

  // Update template mutation
  const updateMutation = useApiMutation<TemplateResponse, { id: string; data: CreateTemplateInput }>({
    url: (vars) => `/api/templates/${vars.id}`,
    method: "PATCH",
    invalidateKeys: [["admin-templates"]],
    onSuccess: () => {
      toast.success("Template updated");
      resetForm();
      setEditingTemplate(null);
    },
    onError: (err) => {
      const message = err.message || "Failed to update template";
      setError(message);
      toast.error(message);
    },
  });

  // Delete template mutation
  const deleteMutation = useApiMutation<void, string>({
    url: (id) => `/api/templates/${id}`,
    method: "DELETE",
    invalidateKeys: [["admin-templates"]],
    onSuccess: () => {
      toast.success("Template deleted");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("Failed to delete template");
      setDeletingId(null);
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleCreate = () => {
    setError(null);

    if (!formData.name.trim()) {
      setError("Template name is required");
      return;
    }
    if (!formData.content.trim()) {
      setError("Template content is required");
      return;
    }

    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingTemplate) return;
    setError(null);

    if (!formData.name.trim()) {
      setError("Template name is required");
      return;
    }
    if (!formData.content.trim()) {
      setError("Template content is required");
      return;
    }

    updateMutation.mutate({ id: editingTemplate.id, data: formData });
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm();
    if (!confirmed) return;
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const res = await fetch("/api/templates/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse file");
      }

      const data = await res.json();
      const result = data.data;

      // Pre-populate form with parsed content
      setFormData({
        name: result.suggestedName || "",
        description: "",
        content: result.content || "",
        category: result.suggestedCategory || "",
        outputFormat: "markdown",
        placeholderHint: "",
        isActive: true,
        sortOrder: 0,
      });

      setShowForm(true);
      toast.success(`File parsed successfully. Found ${result.stats.placeholderCount} placeholders.`);

      // Show detected sections if any
      if (result.sections.length > 0) {
        toast.info(`Detected ${result.sections.length} sections: ${result.sections.slice(0, 3).join(", ")}${result.sections.length > 3 ? "..." : ""}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload file";
      toast.error(message);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const startEdit = async (template: TemplateListItem) => {
    const full = await fetchTemplate(template.id);
    if (full) {
      setEditingTemplate(full);
      setFormData({
        name: full.name,
        description: full.description || "",
        content: full.content,
        category: full.category || "",
        outputFormat: full.outputFormat as "markdown" | "docx" | "pdf",
        placeholderHint: full.placeholderHint || "",
        placeholderMappings: (full.placeholderMappings as PlaceholderMapping[]) || [],
        instructionPresetId: full.instructionPresetId || "",
        isActive: full.isActive,
        sortOrder: full.sortOrder,
      });
    }
  };

  const viewTemplate = async (template: TemplateListItem) => {
    const full = await fetchTemplate(template.id);
    if (full) {
      setViewingTemplate(full);
    }
  };

  // Note: placeholderHints replaced by PlaceholderMappingEditor component

  return (
    <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
          Document Templates
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Create reusable templates for sales documents, battlecards, and proposals.
          Use placeholders like {"{{customer.name}}"} or {"{{llm:instruction}}"} for dynamic content.
        </p>
      </div>

      {/* Add Template Buttons */}
      {!showForm && !editingTemplate && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <Link href="/admin/templates/build">
            <button
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
              }}
            >
              <Sparkles size={18} />
              Build Template
            </button>
          </Link>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              backgroundColor: "#fff",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            <Plus size={18} />
            Manual Template
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.md,.txt,.markdown"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              backgroundColor: isUploading ? "#e2e8f0" : "#fff",
              color: isUploading ? "#94a3b8" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: isUploading ? "not-allowed" : "pointer",
              fontWeight: 500,
            }}
          >
            {isUploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            {isUploading ? "Parsing..." : "Upload Template"}
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {(showForm || editingTemplate) && (
        <div
          style={{
            padding: "24px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ marginBottom: "20px", fontWeight: 600 }}>
            {editingTemplate ? "Edit Template" : "Add Template"}
          </h3>

          {error && (
            <div style={{ marginBottom: "16px" }}>
              <InlineError message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Battlecard"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                  backgroundColor: "#fff",
                }}
              >
                <option value="">No category</option>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this template is for"
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
              Template Content * (Markdown with placeholders)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder={`# Sales Battlecard: {{customer.name}}

## Company Overview
{{customer.content}}

## Industry: {{customer.industry}}

## Key Challenges
{{llm:summarize the customer's main challenges based on their profile}}

## Recommended Approach
{{llm:generate a tailored approach based on available GTM data}}`}
              rows={16}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontFamily: "monospace",
                resize: "vertical",
              }}
            />
          </div>

          {/* Placeholder Mapping Editor */}
          <div style={{ marginBottom: "16px" }}>
            <PlaceholderMappingEditor
              content={formData.content}
              mappings={formData.placeholderMappings || []}
              onChange={(mappings) => setFormData({ ...formData, placeholderMappings: mappings })}
            />
          </div>

          {/* Linked Instruction Preset */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", fontWeight: 500 }}>
              <User size={16} />
              Linked Assistant Persona
            </label>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
              Auto-selects this persona in Collateral Builder when this template is chosen
            </p>
            <select
              value={formData.instructionPresetId || ""}
              onChange={(e) => setFormData({ ...formData, instructionPresetId: e.target.value || undefined })}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.95rem",
                backgroundColor: "#fff",
              }}
            >
              <option value="">No linked persona</option>
              {instructionPresets.filter(p => p.shareStatus === "APPROVED" || !p.isShared).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} {preset.isShared ? "(Org)" : "(Personal)"}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
                Output Format
              </label>
              <select
                value={formData.outputFormat}
                onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value as "markdown" | "docx" | "pdf" })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                  backgroundColor: "#fff",
                }}
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", paddingTop: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: "18px", height: "18px" }}
                />
                <span style={{ fontWeight: 500 }}>Active</span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={editingTemplate ? handleUpdate : handleCreate}
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
              {isSaving && <InlineLoader size="sm" />}
              {isSaving ? "Saving..." : editingTemplate ? "Update Template" : "Add Template"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingTemplate(null);
                resetForm();
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

      {/* View Template Modal */}
      {viewingTemplate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setViewingTemplate(null)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              width: "90%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{viewingTemplate.name}</h2>
                {viewingTemplate.description && (
                  <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "4px" }}>
                    {viewingTemplate.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewingTemplate(null)}
                style={{
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "1.5rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "16px",
                backgroundColor: "#f8fafc",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                whiteSpace: "pre-wrap",
                overflow: "auto",
              }}
            >
              {viewingTemplate.content}
            </div>

            <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
              <CopyButton text={viewingTemplate.content} />
              <button
                onClick={() => {
                  setViewingTemplate(null);
                  startEdit(viewingTemplate);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                <Edit2 size={16} />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template List */}
      {isLoading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <InlineLoader size="lg" />
          </div>
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
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
          <p style={{ color: "#64748b", marginBottom: "4px" }}>No templates yet</p>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Create templates to generate consistent sales documents
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: "16px",
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={18} style={{ color: "#6366f1" }} />
                    <span style={{ fontWeight: 600 }}>{template.name}</span>
                    {!template.isActive && (
                      <span
                        style={{
                          padding: "2px 6px",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                          fontWeight: 500,
                        }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "4px" }}>
                      {template.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {template.category && (
                  <span
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                    }}
                  >
                    {template.category}
                  </span>
                )}
                <span
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "#f3f4f6",
                    color: "#4b5563",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                  }}
                >
                  {template.outputFormat}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                <button
                  onClick={() => viewTemplate(template)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    backgroundColor: "#f8fafc",
                    color: "#475569",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  <Eye size={14} />
                  View
                </button>
                <button
                  onClick={() => startEdit(template)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    backgroundColor: "#f8fafc",
                    color: "#3b82f6",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  disabled={deletingId === template.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: "4px",
                    cursor: deletingId === template.id ? "not-allowed" : "pointer",
                    fontSize: "0.85rem",
                    opacity: deletingId === template.id ? 0.5 : 1,
                  }}
                >
                  {deletingId === template.id ? (
                    <InlineLoader size="sm" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete
                </button>
              </div>
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
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#1e40af", marginBottom: "12px" }}>
          <strong>Placeholder Reference:</strong>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "8px", fontSize: "0.85rem" }}>
          <div>
            <code style={{ backgroundColor: "#e0f2fe", padding: "2px 4px", borderRadius: "2px" }}>
              {"{{customer.name}}"}
            </code>{" "}
            - Customer field
          </div>
          <div>
            <code style={{ backgroundColor: "#e0f2fe", padding: "2px 4px", borderRadius: "2px" }}>
              {"{{gtm.recent_calls_summary}}"}
            </code>{" "}
            - GTM data
          </div>
          <div>
            <code style={{ backgroundColor: "#e0f2fe", padding: "2px 4px", borderRadius: "2px" }}>
              {"{{skill.all}}"}
            </code>{" "}
            - All skill content
          </div>
          <div>
            <code style={{ backgroundColor: "#fef3c7", padding: "2px 4px", borderRadius: "2px" }}>
              {"{{llm:instruction}}"}
            </code>{" "}
            - AI generates content
          </div>
          <div>
            <code style={{ backgroundColor: "#e0f2fe", padding: "2px 4px", borderRadius: "2px" }}>
              {"{{date.today}}"}
            </code>{" "}
            - Current date
          </div>
          <div>
            <code style={{ backgroundColor: "#e0f2fe", padding: "2px 4px", borderRadius: "2px" }}>
              {"{{custom.fieldName}}"}
            </code>{" "}
            - User-provided value
          </div>
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}

// Copy button component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        backgroundColor: "#f8fafc",
        color: "#475569",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
