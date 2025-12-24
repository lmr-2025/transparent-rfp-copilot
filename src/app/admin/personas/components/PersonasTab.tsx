"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  X,
  Pencil,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useConfirm } from "@/components/ConfirmModal";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { type InstructionPreset, statusColors } from "./types";

type SkillCategory = {
  id: string;
  name: string;
};

export function PersonasTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["approved", "pending"])
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategories, setNewCategories] = useState<string[]>([]);

  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Persona",
    message: "Are you sure you want to delete this persona?",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Resizable detail panel
  const {
    panelWidth: detailWidth,
    isDragging,
    containerRef,
    handleMouseDown,
  } = useResizablePanel({
    storageKey: "admin-personas-detail-panel-width",
    defaultWidth: 420,
    minWidth: 350,
    maxWidth: 600,
  });

  // Fetch presets
  const { data: presetsData, isLoading, refetch } = useApiQuery<{ presets: InstructionPreset[] }>({
    url: "/api/instruction-presets",
    queryKey: ["instruction-presets"],
  });

  const presets = useMemo(() => presetsData?.presets ?? [], [presetsData?.presets]);

  // Fetch skill categories for the category picker
  const { data: categoriesData } = useApiQuery<{ categories: SkillCategory[] }>({
    url: "/api/skill-categories",
    queryKey: ["skill-categories"],
  });

  const skillCategories = categoriesData?.categories || [];

  // Mutations
  const updateMutation = useApiMutation<void, { id: string; data: Record<string, unknown> }>({
    url: "/api/instruction-presets",
    method: "PUT",
    onSuccess: () => refetch(),
  });

  const deleteMutation = useApiMutation<void, { id: string }>({
    url: "/api/instruction-presets",
    method: "DELETE",
    onSuccess: () => {
      refetch();
      setSelectedPresetId(null);
    },
  });

  const createMutation = useApiMutation<void, { name: string; description: string; content: string; defaultCategories: string[]; requestShare: boolean }>({
    url: "/api/instruction-presets",
    method: "POST",
    onSuccess: () => {
      refetch();
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewContent("");
      setNewCategories([]);
    },
  });

  // Group presets by status
  const groupedPresets = useMemo(() => {
    const filtered = presets.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
      approved: filtered.filter((p) => p.shareStatus === "APPROVED" || p.isDefault),
      pending: filtered.filter((p) => p.shareStatus === "PENDING_APPROVAL"),
      private: filtered.filter((p) => p.shareStatus === "PRIVATE"),
      rejected: filtered.filter((p) => p.shareStatus === "REJECTED"),
    };
  }, [presets, searchQuery]);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const handleStartEdit = () => {
    if (selectedPreset) {
      setEditName(selectedPreset.name);
      setEditDescription(selectedPreset.description || "");
      setEditContent(selectedPreset.content);
      setEditCategories(selectedPreset.defaultCategories || []);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPreset) return;
    await updateMutation.mutateAsync({
      id: selectedPreset.id,
      data: { name: editName, description: editDescription, content: editContent, defaultCategories: editCategories },
    });
    setIsEditing(false);
  };

  const toggleCategory = (categoryName: string, categories: string[], setCategories: (cats: string[]) => void) => {
    if (categories.includes(categoryName)) {
      setCategories(categories.filter(c => c !== categoryName));
    } else {
      setCategories([...categories, categoryName]);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDelete();
    if (confirmed) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const handleCopy = () => {
    if (selectedPreset) {
      navigator.clipboard.writeText(selectedPreset.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderSection = (title: string, items: InstructionPreset[], sectionKey: string, icon: React.ReactNode) => {
    if (items.length === 0) return null;
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div key={sectionKey}>
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {icon}
          {title}
          <span className="ml-auto text-xs text-slate-400">{items.length}</span>
        </button>
        {isExpanded && (
          <div className="space-y-1 mt-1">
            {items.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedPresetId(preset.id);
                  setIsEditing(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedPresetId === preset.id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{preset.name}</span>
                  {preset.isDefault && <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                </div>
                {preset.description && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{preset.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      <ConfirmDialog />

      {/* Left: List */}
      <div className="flex-1 flex flex-col border-r overflow-hidden">
        {/* Search + Create */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search personas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowCreate(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Persona
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {renderSection("Shared", groupedPresets.approved, "approved", <CheckCircle className="h-4 w-4 text-green-500" />)}
          {renderSection("Pending Review", groupedPresets.pending, "pending", <Clock className="h-4 w-4 text-amber-500" />)}
          {renderSection("Private", groupedPresets.private, "private", <User className="h-4 w-4 text-slate-400" />)}
          {renderSection("Rejected", groupedPresets.rejected, "rejected", <AlertCircle className="h-4 w-4 text-red-500" />)}
        </div>
      </div>

      {/* Resizable divider */}
      <ResizableDivider onMouseDown={handleMouseDown} isDragging={isDragging} />

      {/* Right: Detail */}
      <div style={{ width: detailWidth }} className="flex-shrink-0 flex flex-col overflow-hidden bg-slate-50">
        {selectedPreset ? (
          <div className="flex-1 overflow-auto p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="font-semibold text-lg mb-2"
                  />
                ) : (
                  <h3 className="font-semibold text-lg text-slate-800">{selectedPreset.name}</h3>
                )}
                {!isEditing && (
                  <span
                    className="inline-block px-2 py-0.5 text-xs rounded-full mt-1"
                    style={{
                      backgroundColor: statusColors[selectedPreset.shareStatus].bg,
                      color: statusColors[selectedPreset.shareStatus].text,
                    }}
                  >
                    {selectedPreset.shareStatus.replace("_", " ")}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleStartEdit}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(selectedPreset.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            {isEditing ? (
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                className="mb-4"
              />
            ) : (
              selectedPreset.description && (
                <p className="text-sm text-slate-600 mb-4">{selectedPreset.description}</p>
              )
            )}

            {/* Default Categories */}
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                <Tags className="h-4 w-4" />
                Default Knowledge Categories
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Skills from these categories will be auto-selected when this persona is chosen
              </p>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {skillCategories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant={editCategories.includes(cat.name) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-colors",
                        editCategories.includes(cat.name)
                          ? "bg-blue-500 hover:bg-blue-600"
                          : "hover:bg-slate-100"
                      )}
                      onClick={() => toggleCategory(cat.name, editCategories, setEditCategories)}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedPreset.defaultCategories?.length > 0 ? (
                    selectedPreset.defaultCategories.map((cat) => (
                      <Badge key={cat} variant="secondary">
                        {cat}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No categories selected - all skills available</span>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="mb-4">
              <div className="text-sm font-medium text-slate-600 mb-2">Instructions</div>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-64 p-3 border rounded-lg text-sm font-mono resize-none"
                />
              ) : (
                <div className="bg-slate-900 rounded-lg p-3 max-h-64 overflow-auto">
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                    {selectedPreset.content}
                  </pre>
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="text-xs text-slate-400 space-y-1">
              {selectedPreset.createdByEmail && (
                <p>Created by: {selectedPreset.createdByEmail}</p>
              )}
              <p>Created: {new Date(selectedPreset.createdAt).toLocaleDateString()}</p>
              <p>Updated: {new Date(selectedPreset.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select a persona to view details
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Persona</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Security Expert"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Instructions</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write the instructions for this persona..."
                  className="w-full h-40 p-3 border rounded-lg text-sm resize-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <Tags className="h-4 w-4" />
                  Default Knowledge Categories
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Skills from these categories will be auto-selected when this persona is chosen
                </p>
                <div className="flex flex-wrap gap-2">
                  {skillCategories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant={newCategories.includes(cat.name) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-colors",
                        newCategories.includes(cat.name)
                          ? "bg-blue-500 hover:bg-blue-600"
                          : "hover:bg-slate-100"
                      )}
                      onClick={() => toggleCategory(cat.name, newCategories, setNewCategories)}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate({ name: newName, description: newDescription, content: newContent, defaultCategories: newCategories, requestShare: false })}
                disabled={!newName || !newContent || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
