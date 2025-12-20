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
import { PlaceholderMappingEditor } from "@/app/admin/templates/components/PlaceholderMappingEditor";
import { parseApiData } from "@/lib/apiClient";

type InstructionPreset = {
  id: string;
  name: string;
  description?: string;
  isShared: boolean;
  shareStatus: string;
};

type TemplateListItem = Omit<TemplateResponse, "content" | "placeholderHint" | "placeholderMappings">;

export default function TemplatesTab() {
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

  return (
    <div className="p-8 max-w-6xl mx-auto overflow-auto h-full">
      <div className="mb-6">
        <p className="text-muted-foreground text-sm">
          Create reusable templates for sales documents, battlecards, and proposals.
          Use placeholders like {"{{customer.name}}"} or {"{{llm:instruction}}"} for dynamic content.
        </p>
      </div>

      {/* Add Template Buttons */}
      {!showForm && !editingTemplate && (
        <div className="flex gap-3 mb-6">
          <Link href="/admin/templates/build">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90">
              <Sparkles size={18} />
              Build Template
            </button>
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-background text-foreground border border-border rounded-md font-medium hover:bg-muted"
          >
            <Plus size={18} />
            Manual Template
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.md,.txt,.markdown"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex items-center gap-2 px-4 py-2.5 border border-border rounded-md font-medium ${
              isUploading ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-background text-foreground hover:bg-muted"
            }`}
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
        <div className="p-6 bg-muted/50 rounded-lg border border-border mb-6">
          <h3 className="mb-5 font-semibold">
            {editingTemplate ? "Edit Template" : "Add Template"}
          </h3>

          {error && (
            <div className="mb-4">
              <InlineError message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1 font-medium text-sm">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Battlecard"
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium text-sm">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background"
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

          <div className="mb-4">
            <label className="block mb-1 font-medium text-sm">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this template is for"
              className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-medium text-sm">
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
              className="w-full p-3 border border-border rounded-md text-sm font-mono resize-y bg-background"
            />
          </div>

          {/* Placeholder Mapping Editor */}
          <div className="mb-4">
            <PlaceholderMappingEditor
              content={formData.content}
              mappings={formData.placeholderMappings || []}
              onChange={(mappings) => setFormData({ ...formData, placeholderMappings: mappings })}
            />
          </div>

          {/* Linked Instruction Preset */}
          <div className="mb-4">
            <label className="flex items-center gap-2 mb-1 font-medium text-sm">
              <User size={16} />
              Linked Assistant Persona
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Auto-selects this persona in Collateral Builder when this template is chosen
            </p>
            <select
              value={formData.instructionPresetId || ""}
              onChange={(e) => setFormData({ ...formData, instructionPresetId: e.target.value || undefined })}
              className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background"
            >
              <option value="">No linked persona</option>
              {instructionPresets.filter(p => p.shareStatus === "APPROVED" || !p.isShared).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} {preset.isShared ? "(Org)" : "(Personal)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block mb-1 font-medium text-sm">Output Format</label>
              <select
                value={formData.outputFormat}
                onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value as "markdown" | "docx" | "pdf" })}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background"
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-medium text-sm">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="font-medium text-sm">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={editingTemplate ? handleUpdate : handleCreate}
              disabled={isSaving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-primary-foreground ${
                isSaving ? "bg-primary/50 cursor-not-allowed" : "bg-primary hover:bg-primary/90"
              }`}
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
              className="px-5 py-2.5 bg-background text-muted-foreground border border-border rounded-md font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* View Template Modal */}
      {viewingTemplate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setViewingTemplate(null)}
        >
          <div
            className="bg-background rounded-lg w-[90%] max-w-3xl max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold">{viewingTemplate.name}</h2>
                {viewingTemplate.description && (
                  <p className="text-muted-foreground text-sm mt-1">
                    {viewingTemplate.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewingTemplate(null)}
                className="p-2 text-muted-foreground hover:text-foreground text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-4 bg-muted rounded-md border border-border font-mono text-sm whitespace-pre-wrap overflow-auto">
              {viewingTemplate.content}
            </div>

            <div className="mt-4 flex gap-3">
              <CopyButton text={viewingTemplate.content} />
              <button
                onClick={() => {
                  setViewingTemplate(null);
                  startEdit(viewingTemplate);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
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
        <div className="p-10 text-center text-muted-foreground">
          <div className="flex justify-center mb-3">
            <InlineLoader size="lg" />
          </div>
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="p-10 text-center bg-muted/50 rounded-lg border border-dashed border-border">
          <FileText size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-1">No templates yet</p>
          <p className="text-muted-foreground/70 text-sm">
            Create templates to generate consistent sales documents
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-4 bg-background rounded-lg border border-border flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    <span className="font-semibold">{template.name}</span>
                    {!template.isActive && (
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-muted-foreground text-sm mt-1">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {template.category && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded text-xs">
                    {template.category}
                  </span>
                )}
                <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs uppercase">
                  {template.outputFormat}
                </span>
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => viewTemplate(template)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground border border-border rounded text-sm hover:bg-muted/80"
                >
                  <Eye size={14} />
                  View
                </button>
                <button
                  onClick={() => startEdit(template)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-muted text-primary border border-border rounded text-sm hover:bg-muted/80"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  disabled={deletingId === template.id}
                  className={`flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded text-sm ${
                    deletingId === template.id ? "opacity-50 cursor-not-allowed" : "hover:bg-red-100 dark:hover:bg-red-900/30"
                  }`}
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
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
        <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
          <strong>Placeholder Reference:</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          <div>
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded text-xs">
              {"{{customer.name}}"}
            </code>{" "}
            - Customer field
          </div>
          <div>
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded text-xs">
              {"{{gtm.recent_calls_summary}}"}
            </code>{" "}
            - GTM data
          </div>
          <div>
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded text-xs">
              {"{{skill.all}}"}
            </code>{" "}
            - All skill content
          </div>
          <div>
            <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded text-xs">
              {"{{llm:instruction}}"}
            </code>{" "}
            - AI generates content
          </div>
          <div>
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded text-xs">
              {"{{date.today}}"}
            </code>{" "}
            - Current date
          </div>
          <div>
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded text-xs">
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
      className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground border border-border rounded-md font-medium hover:bg-muted/80"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
